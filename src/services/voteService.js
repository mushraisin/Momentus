import {
  duelRepo, usersRepo, walletRepo, reputationRepo, voteInboxRepo,
} from '../database/repositories.js';
import { configService } from './configService.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('vote');

/** Доба між голосами — від моменту самого голосу, а не від опівночі. */
export const COOLDOWN_MS = 24 * 3600_000;

/** Нагорода за місце в рейтингу, раз на добу. */
export const TOP_REWARD = [3, 2, 1];

/**
 * Голосування на сторінці рейтингу.
 *
 * Кожному показується пара випадкових учасників; одному можна віддати голос.
 * Голос нічого не коштує — навпаки, і той, за кого голосують, і той, хто
 * голосує, отримують по ✨1FP. Сенс у тому, щоб заходити в рейтинг було
 * приємно, а не лише корисно тим, хто вже нагорі.
 *
 * Нова пара випадає через добу після голосу. Саме після голосу, а не просто
 * раз на добу: інакше можна було б оновлювати сторінку, доки не випаде
 * «потрібний» учасник.
 */

/** Хто взагалі може брати участь: живі люди сервера, не боти й не сам голосуючий. */
async function candidates(guild, exceptId) {
  const rows = await usersRepo.all(guild.id).catch(() => []);
  const out = [];
  for (const r of rows) {
    if (r.user_id === exceptId) continue;
    // Бот міг потрапити в таблицю зі старих запусків — звіряємось із Discord.
    const m = guild.members.cache.get(r.user_id);
    if (m?.user?.bot) continue;
    out.push({ userId: r.user_id, username: m?.displayName ?? r.username ?? r.user_id });
  }
  return out;
}

/** Скільки людей показуємо на вибір. */
export const CHOICES = 3;

/**
 * Кілька випадкових і різних із списку.
 *
 * Досить одного: на маленькому сервері більше просто нема кого показати,
 * а вимога пари означала, що голосування там не з'являлося взагалі.
 */
function pickSome(list, n = CHOICES) {
  if (!list.length) return null;
  const pool = [...list];
  const out = [];
  while (out.length < Math.min(n, pool.length)) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}

/**
 * Кого показати цій людині: ті самі, поки вона не проголосувала й поки не
 * минула доба.
 * @returns {Promise<{people:object[],canVote:boolean,nextAt:number}|null>}
 */
export async function duelFor(guild, userId) {
  const cur = await duelRepo.get(guild.id, userId).catch(() => null);
  const votedAt = Number(cur?.voted_at ?? 0);
  const waiting = votedAt && Date.now() - votedAt < COOLDOWN_MS;

  // Ще не голосувала — лишаємо тих самих; проголосувала й доба не минула —
  // показуємо, коли буде новий вибір.
  if (cur && (waiting || !votedAt)) {
    const ids = [cur.a, cur.b, cur.c].filter(Boolean);
    const who = await namesOf(guild, ids);
    if (who) {
      return {
        people: who,
        canVote: !votedAt,
        nextAt: votedAt ? votedAt + COOLDOWN_MS : 0,
      };
    }
  }

  const list = await candidates(guild, userId);
  const some = pickSome(list);
  if (!some) return null;

  await duelRepo.set(guild.id, userId, some[0].userId,
    some[1]?.userId ?? null, some[2]?.userId ?? null).catch(() => {});
  return { people: some, canVote: true, nextAt: 0 };
}

/** Імена вибору; null — якщо когось із них уже немає серед учасників. */
async function namesOf(guild, ids) {
  const out = [];
  for (const id of ids) {
    const m = guild.members.cache.get(id);
    if (m?.user?.bot) return null;
    const row = await usersRepo.get(guild.id, id).catch(() => null);
    if (!row && !m) return null;
    out.push({ userId: id, username: m?.displayName ?? row?.username ?? id });
  }
  return out;
}

/**
 * Віддати голос. Обидва — і той, за кого голосують, і сам голосуючий —
 * отримують по ✨1FP: голос не має бути витратою.
 */
export async function castVote(guild, voterId, targetId) {
  const cur = await duelRepo.get(guild.id, voterId).catch(() => null);
  if (!cur) return { ok: false, reason: 'no duel' };
  if (![cur.a, cur.b, cur.c].filter(Boolean).includes(String(targetId))) {
    return { ok: false, reason: 'not in pair' };
  }
  if (String(targetId) === String(voterId)) return { ok: false, reason: 'self' };

  const votedAt = Number(cur.voted_at ?? 0);
  if (votedAt && Date.now() - votedAt < COOLDOWN_MS) {
    return { ok: false, reason: 'cooldown', nextAt: votedAt + COOLDOWN_MS };
  }

  await walletRepo.add(guild.id, targetId, 1);
  await walletRepo.add(guild.id, voterId, 1);
  await usersRepo.bump(guild.id, targetId, 'votes_got', 1).catch(() => {});
  await duelRepo.markVoted(guild.id, voterId);
  // адресат дізнається про це, коли наступного разу зайде на сайт
  await voteInboxRepo.add(guild.id, targetId, voterId).catch(() => {});

  const w = await walletRepo.get(guild.id, voterId);
  log.info(`${voterId} проголосував за ${targetId} — обом по 1 FP`);
  return { ok: true, balance: w.balance, nextAt: Date.now() + COOLDOWN_MS };
}

/**
 * Щоденна нагорода за місця в рейтингу: 3 / 2 / 1 ✨FP.
 * День запам'ятовуємо в конфізі гільдії, щоб перезапуск бота не видав удруге.
 */
export async function payoutTop(guild) {
  const today = new Date().toISOString().slice(0, 10);
  if (configService.get(guild.id, 'top.lastPayout') === today) return 0;

  const rows = await reputationRepo.leaderboard(guild.id, 10).catch(() => []);
  const top = rows
    .filter((r) => !guild.members.cache.get(r.user_id)?.user?.bot)
    .slice(0, TOP_REWARD.length);

  let paid = 0;
  for (const [i, r] of top.entries()) {
    await walletRepo.add(guild.id, r.user_id, TOP_REWARD[i]).catch(() => {});
    // людина дізнається про нагороду, коли наступного разу зайде на сайт
    await voteInboxRepo.add(guild.id, r.user_id, null, {
      kind: 'top', amount: TOP_REWARD[i], place: i + 1,
    }).catch(() => {});
    paid += TOP_REWARD[i];
  }

  await configService.set(guild.id, 'top.lastPayout', today);
  if (paid) log.info(`Нагороди за місця: ${top.length} учасник(ів), ${paid} FP`);
  return paid;
}
