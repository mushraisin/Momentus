import { ActivityType } from 'discord.js';
import { gamesRepo } from '../database/repositories.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('games');

/**
 * Скільки часу учасники проводять в іграх.
 *
 * ВАЖЛИВО про можливості Discord: «наіграних годин» у його API немає — це
 * вигадка Steam. Discord показує лише те, у що людина грає ПРЯМО ЗАРАЗ
 * (presence). Тому години рахує сам бот: бачить, що гра почалась, бачить,
 * що скінчилась, і додає різницю. Через це:
 *
 *   • статистика починається з дня, коли стеження увімкнули — минулого немає;
 *   • у кого статус прихований, того не видно взагалі;
 *   • поки бот лежить, час не рахується.
 *
 * Стеження вимкнене за замовчуванням. Щоб увімкнути, потрібні дві речі
 * одночасно: TRACK_GAMES=true у налаштуваннях і дозвіл «Presence Intent»
 * у Discord Developer Portal. Без дозволу в порталі бот із цим наміром
 * просто не підключиться — саме тому вмикати доводиться свідомо.
 */
export function gamesEnabled() {
  return String(process.env.TRACK_GAMES).toLowerCase() === 'true';
}

/** userId → { guildId, game, since } — незакриті сесії. */
const open = new Map();

/** Раз на стільки скидаємо накопичене, щоб перезапуск не з'їдав годину. */
const FLUSH_MS = 5 * 60_000;
let timer = null;

/** Назва гри з присутності: беремо саме гру, а не музику чи стрім. */
function playingOf(presence) {
  const act = (presence?.activities ?? []).find((a) => a.type === ActivityType.Playing);
  const name = act?.name?.trim();
  // «Custom Status» приходить тим самим списком — це не гра
  if (!name || name.toLowerCase() === 'custom status') return null;
  return name.slice(0, 80);
}

/** Закрити відкриту сесію й записати її тривалість. */
async function close(userId, until = Date.now()) {
  const s = open.get(userId);
  if (!s) return;
  open.delete(userId);
  const minutes = (until - s.since) / 60_000;
  // менше хвилини не пишемо: це шум від перемикань статусу
  if (minutes < 1) return;
  await gamesRepo.add(s.guildId, userId, s.game, minutes).catch(() => {});
}

/**
 * Періодично зараховуємо те, що вже награно, і починаємо відлік наново.
 * Інакше багатогодинна сесія пропала б, якби бот перезапустили посеред неї.
 */
async function flush() {
  const now = Date.now();
  for (const [userId, s] of [...open]) {
    const minutes = (now - s.since) / 60_000;
    if (minutes < 1) continue;
    await gamesRepo.add(s.guildId, userId, s.game, minutes).catch(() => {});
    s.since = now;
  }
}

export function startGames(client) {
  stopGames();
  if (!gamesEnabled()) return null;

  client.on('presenceUpdate', (_old, presence) => {
    try {
      const userId = presence?.userId ?? presence?.user?.id;
      const guildId = presence?.guild?.id;
      if (!userId || !guildId) return;

      const game = playingOf(presence);
      const cur = open.get(userId);

      if (!game) { close(userId).catch(() => {}); return; }
      if (cur && cur.game === game) return;          // та сама гра — нічого не змінилось

      // змінили гру: попередню закриваємо, нову починаємо
      close(userId).then(() => open.set(userId, { guildId, game, since: Date.now() }))
        .catch(() => {});
    } catch { /* присутність — річ ненадійна, падати через неї не варто */ }
  });

  timer = setInterval(() => flush().catch(() => {}), FLUSH_MS);
  log.info('Стеження за іграми увімкнено — години рахуються з цього моменту');
  return timer;
}

export function stopGames() {
  if (timer) clearInterval(timer);
  timer = null;
  open.clear();
}

/** Ігри людини для сторінки профілю. */
export async function gamesOf(guildId, userId, limit = 6) {
  if (!gamesEnabled()) return null;
  const rows = await gamesRepo.list(guildId, userId, limit).catch(() => []);
  return rows.map((r) => ({
    game: r.game,
    minutes: Number(r.minutes) || 0,
    hours: Math.round((Number(r.minutes) || 0) / 6) / 10,
    lastSeen: Number(r.last_seen) || 0,
  }));
}
