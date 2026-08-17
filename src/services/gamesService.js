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

/**
 * Раз на стільки зараховуємо накопичене. Хвилина, а не пʼять: інакше після
 * старту гри в профілі довго не було взагалі нічого, і здавалося, що стеження
 * не працює.
 */
const FLUSH_MS = 60_000;
let timer = null;
let seenAny = false;

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

/** Почати відлік для однієї людини. */
function begin(guildId, userId, game) {
  open.set(userId, { guildId, game, since: Date.now() });
  if (!seenAny) {
    seenAny = true;
    log.info(`Присутність надходить — перша гра: «${game}». Стеження працює.`);
  }
}

export function startGames(client) {
  stopGames();
  if (!gamesEnabled()) return null;

  // Намір привілейований: без дозволу в Developer Portal Discord не надішле
  // жодної присутності, і стеження мовчки нічого не рахуватиме.
  const hasIntent = !!client.options?.intents?.has?.('GuildPresences');
  if (!hasIntent) {
    log.warn('TRACK_GAMES=true, але наміру GuildPresences немає — перезапустіть бота');
  }

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
      close(userId).then(() => begin(guildId, userId, game)).catch(() => {});
    } catch { /* присутність — річ ненадійна, падати через неї не варто */ }
  });

  // Ті, хто вже грає на момент запуску, події не надішлють — присутність
  // приходить лише при ЗМІНІ. Тож підбираємо їх із кешу одразу.
  let already = 0;
  for (const guild of client.guilds?.cache?.values?.() ?? []) {
    for (const p of guild.presences?.cache?.values?.() ?? []) {
      const game = playingOf(p);
      const userId = p?.userId ?? p?.user?.id;
      if (game && userId && !open.has(userId)) { begin(guild.id, userId, game); already++; }
    }
  }

  timer = setInterval(() => flush().catch(() => {}), FLUSH_MS);
  log.info(`Стеження за іграми увімкнено${already ? `, вже грають: ${already}` : ''}`
    + ' — години рахуються з цього моменту');
  return timer;
}

/** Що людина грає прямо зараз і скільки вже триває сесія. */
export function playingNow(guildId, userId) {
  const s = open.get(userId);
  if (!s || s.guildId !== guildId) return null;
  return { game: s.game, minutes: (Date.now() - s.since) / 60_000 };
}

export function stopGames() {
  if (timer) clearInterval(timer);
  timer = null;
  open.clear();
}

/**
 * Ігри людини для сторінки профілю.
 *
 * Поточна сесія додається до збереженого: інакше людина запускає гру, йде
 * в профіль — і не бачить нічого, бо в базу ще нічого не записано. Саме
 * через це здавалося, що стеження не працює зовсім.
 */
export async function gamesOf(guildId, userId, limit = 6) {
  if (!gamesEnabled()) return null;

  const rows = await gamesRepo.list(guildId, userId, 50).catch(() => []);
  const list = rows.map((r) => ({
    game: r.game,
    minutes: Number(r.minutes) || 0,
    lastSeen: Number(r.last_seen) || 0,
    now: false,
  }));

  const live = playingNow(guildId, userId);
  if (live) {
    const found = list.find((g) => g.game === live.game);
    if (found) { found.minutes += live.minutes; found.now = true; } else {
      list.push({ game: live.game, minutes: live.minutes, lastSeen: Date.now(), now: true });
    }
  }

  return list
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, limit)
    .map((g) => ({ ...g, hours: Math.round(g.minutes / 6) / 10 }));
}
