import {
  usersRepo, traitsRepo, reputationRepo, activityRepo,
  modRepo, snapshotRepo,
} from '../database/repositories.js';
import { configService } from './configService.js';
import { PUNISHMENT_WEIGHT, PUNISHMENT_DECAY_MS } from '../config/constants.js';
import { bus, EVENTS } from '../core/eventBus.js';

/**
 * Перетворює сирі ознаки/активність/модерацію на 11 категорій репутації
 * та підсумковий AI Score (0..1000).
 */
export const reputationService = {
  /** Повний перерахунок репутації користувача. */
  async recompute(guildId, userId) {
    const user = await usersRepo.get(guildId, userId);
    if (!user) return null;
    const t = (await traitsRepo.get(guildId, userId)) ?? {};
    const weights = weightMap(guildId);

    const daysOnServer = daysBetween(user.joined_at ?? user.first_seen_at, Date.now());
    const messages30d = await activityRepo.sumSince(guildId, userId, 30, 'messages');
    const voice30d = await activityRepo.sumSince(guildId, userId, 30, 'voice_minutes');
    const activeDays = await activityRepo.activeDays(guildId, userId);
    const daily90 = await activityRepo.range(guildId, userId, 90);
    const modStats = await modRepo.stats(guildId, userId);
    const modHistory = await modRepo.history(guildId, userId, 100);

    // ── Категорії (0..100) ────────────────────
    const communication = avg([t.politeness, t.constructiveness, t.adequacy, t.respect, t.cultureLevel, t.friendliness]);
    const toxicity = avg([t.toxicity, t.insult, t.bullying, t.harassment, t.threat, t.profanity]);
    const conflict = avg([t.conflictSeeking, t.provocation, t.passiveAggression, t.sarcasm * 0.4]);
    const activity = activityScore({ messages30d, voice30d, activeDays, daysOnServer });
    const stability = stabilityScore(daily90, daysOnServer);
    const helpfulness = helpfulnessScore(t, user);
    const usefulness = usefulnessScore(t, user);
    const peer = peerScore(user);
    const violations = violationScore(modHistory);
    const behavior = clamp(100 - toxicity * 0.5 - conflict * 0.3 - violations * 0.4 + helpfulness * 0.15, 0, 100);
    const trust = trustScore({ behavior, stability, violations, daysOnServer, communication });

    const rep = {
      trust: round1(trust),
      activity: round1(activity),
      communication: round1(communication),
      helpfulness: round1(helpfulness),
      usefulness: round1(usefulness),
      stability: round1(stability),
      behavior: round1(behavior),
      conflict: round1(conflict),
      toxicity: round1(toxicity),
      violations: round1(violations),
      peer: round1(peer),
    };

    rep.ai_score = computeAiScore(rep, weights, {
      samples: t.samples ?? 0,
      activeDays,
      daysOnServer,
    });
    await reputationRepo.save(guildId, userId, rep);
    bus.emitSafe(EVENTS.REPUTATION_UPDATED, { guildId, userId, rep });
    return rep;
  },

  /** Зробити щоденний знімок (для трендів). */
  async snapshot(guildId, userId) {
    const rep = await reputationRepo.get(guildId, userId);
    if (rep) {
      await snapshotRepo.take(guildId, userId, rep);
      bus.emitSafe(EVENTS.SNAPSHOT_TAKEN, { guildId, userId });
    }
  },
};

// ─────────────────────────────────────────────
//  Складові оцінок
// ─────────────────────────────────────────────

function activityScore({ messages30d, voice30d, activeDays, daysOnServer }) {
  const msgPart = scale(messages30d, 400) * 0.5;         // 400 повідомл/міс = 100%
  const voicePart = scale(voice30d, 1200) * 0.2;          // 20 год/міс
  const consistency = daysOnServer > 0 ? scale(activeDays / Math.min(daysOnServer, 90) * 90, 60) * 0.3 : 0;
  return clamp(msgPart + voicePart + consistency, 0, 100);
}

/**
 * ДОПОМОГА ІНШИМ (0..100) — з двох незалежних джерел:
 *  а) стиль повідомлень (правило-рушій: пояснення, поради, посилання, конектори);
 *  б) РЕАЛЬНІ акти допомоги — коли учаснику дякували або він відповідав
 *     на запитання (лічильник help_count, наповнюється у trackingService).
 * Реальні акти важать більше, ніж стиль.
 */
function helpfulnessScore(t, user) {
  const style = avg([t.helpfulness, t.positiveImpact]);          // 0..100
  const acts = scale(user.help_count, 60);                        // 60 актів = 100%
  const density = user.total_messages > 0
    ? scale((user.help_count / user.total_messages) * 100, 12)    // 12% повідомлень з допомогою = 100%
    : 0;
  return clamp(style * 0.35 + acts * 0.45 + density * 0.20, 0, 100);
}

/**
 * КОРИСНІСТЬ (0..100) — цінність внеску для спільноти:
 *  • змістовність повідомлень (конструктивність, позитивний вплив);
 *  • акти допомоги;
 *  • «якість» контенту — скільки реакцій припадає на повідомлення;
 *  • середня довжина повідомлення (дуже короткі — менш корисні).
 * Прибрано мертвий показник projects_joined, який завжди був 0.
 */
function usefulnessScore(t, user) {
  const content = avg([t.constructiveness, t.positiveImpact]);
  const acts = scale(user.help_count, 80);
  const reactionRate = user.total_messages > 0
    ? scale((user.reactions_received / user.total_messages) * 100, 25) // 0.25 реакції/повідомл. = 100%
    : 0;
  const avgLen = user.total_messages > 0 ? user.total_chars / user.total_messages : 0;
  const depth = scale(avgLen, 120); // 120 символів у середньому = 100%

  return clamp(content * 0.40 + acts * 0.25 + reactionRate * 0.20 + depth * 0.15, 0, 100);
}

/**
 * СТАБІЛЬНІСТЬ (0..100) — регулярність присутності, а не просто сума днів:
 *  • покриття останніх 30 днів (головне);
 *  • покриття 90 днів;
 *  • відсутність довгих перерв (найдовша пауза між активними днями);
 *  • стаж як невеликий бонус.
 */
function stabilityScore(daily90, daysOnServer) {
  if (daysOnServer < 3) return 35;

  const days = daily90.filter((d) => (d.messages ?? 0) > 0).map((d) => d.day).sort();
  if (!days.length) return 20;

  const today = Date.now();
  const within = (n) => days.filter((d) => (today - Date.parse(d)) / 86400_000 <= n).length;

  const window30 = Math.min(daysOnServer, 30);
  const window90 = Math.min(daysOnServer, 90);
  const cover30 = window30 > 0 ? within(30) / window30 : 0;
  const cover90 = window90 > 0 ? within(90) / window90 : 0;

  // найдовша перерва між активними днями (в межах вікна спостереження)
  let maxGap = 0;
  for (let i = 1; i < days.length; i++) {
    const gap = (Date.parse(days[i]) - Date.parse(days[i - 1])) / 86400_000 - 1;
    if (gap > maxGap) maxGap = gap;
  }
  const sinceLast = (today - Date.parse(days[days.length - 1])) / 86400_000;
  const gapPenalty = clamp(Math.max(maxGap, sinceLast) * 2.2, 0, 45); // 20+ днів паузи = -45

  const tenure = scale(daysOnServer, 365) * 0.15;

  return clamp(cover30 * 55 + cover90 * 30 + tenure - gapPenalty, 0, 100);
}

function peerScore(user) {
  const received = scale(user.reactions_received, 300) * 0.6;
  const social = scale(user.distinct_peers, 60) * 0.4;
  return clamp(40 + received + social - 40, 0, 100);
}

function violationScore(rows) {
  let raw = 0;
  const now = Date.now();
  for (const r of rows) {
    const weight = PUNISHMENT_WEIGHT[r.action] ?? 0;
    if (!weight) continue;
    if (r.reverted_at) continue;
    const age = now - r.created_at;
    const decay = Math.max(0, 1 - age / PUNISHMENT_DECAY_MS); // лінійне згасання
    const repeatMul = 1 + Math.min((r.repeat_index - 1) * 0.25, 1); // повтори важать більше
    raw += weight * decay * repeatMul;
  }
  return clamp(raw, 0, 100);
}

function trustScore({ behavior, stability, violations, daysOnServer, communication }) {
  const base = behavior * 0.4 + stability * 0.2 + communication * 0.2;
  const tenure = scale(daysOnServer, 365) * 0.2;
  return clamp(base + tenure - violations * 0.5, 0, 100);
}

/**
 * Загальний рейтинг (0..1000) — суворий:
 *  1) зважена сума позитивних категорій;
 *  2) НЕЛІНІЙНИЙ штраф за негатив (високі значення карають непропорційно сильно);
 *  3) жорсткі «стелі» — токсичність/порушення обмежують максимально можливий бал;
 *  4) множник довіри до оцінки: мало даних → бал притиснутий донизу.
 */
function computeAiScore(rep, weights, ctx = {}) {
  const positives = [
    ['trust', rep.trust], ['activity', rep.activity], ['communication', rep.communication],
    ['helpfulness', rep.helpfulness], ['usefulness', rep.usefulness], ['stability', rep.stability],
    ['behavior', rep.behavior], ['peer', rep.peer],
  ];

  let posSum = 0;
  let posW = 0;
  for (const [key, val] of positives) {
    const w = weights[key] ?? 1;
    posSum += val * w;
    posW += w;
  }
  const base = posW > 0 ? posSum / posW : 40; // 0..100

  // 2) нелінійний штраф: (x/100)^1.5 — дрібниці майже не карають, системні проблеми карають різко
  const nl = (v, w) => Math.pow(Math.max(0, v) / 100, 1.5) * 100 * w;
  const penalty =
    nl(rep.toxicity, weights.toxicity ?? 1.6) * 1.0 +
    nl(rep.violations, weights.violations ?? 1.5) * 0.9 +
    nl(rep.conflict, weights.conflict ?? 1.1) * 0.6;

  let score = (base * 10) - penalty * 3.2;

  // 3) стелі: не можна мати високий рейтинг з поганою поведінкою
  if (rep.toxicity > 25) score = Math.min(score, 700);
  if (rep.toxicity > 45) score = Math.min(score, 500);
  if (rep.violations > 20) score = Math.min(score, 650);
  if (rep.violations > 45) score = Math.min(score, 420);
  if (rep.conflict > 45) score = Math.min(score, 600);

  // 4) довіра до оцінки: потрібні і час, і обсяг проаналізованих повідомлень
  score *= confidence(ctx);

  return Math.round(clamp(score, 0, 1000));
}

/**
 * Множник довіри 0.45..1.0 — новачки з малою вибіркою не можуть одразу мати топовий бал.
 * Зростає з кількістю проаналізованих повідомлень, активних днів і стажу.
 */
function confidence({ samples = 0, activeDays = 0, daysOnServer = 0 }) {
  const s = Math.min(samples / 300, 1);      // 300 оцінених повідомлень = повна довіра
  const d = Math.min(activeDays / 45, 1);    // 45 активних днів
  const t = Math.min(daysOnServer / 90, 1);  // 90 днів на сервері
  return 0.45 + 0.55 * (s * 0.5 + d * 0.3 + t * 0.2);
}

// ─────────────────────────────────────────────
//  Утиліти
// ─────────────────────────────────────────────

function weightMap(guildId) {
  const cfg = configService.all(guildId);
  const out = {};
  for (const [k, v] of Object.entries(cfg)) {
    if (k.startsWith('weights.')) out[k.slice('weights.'.length)] = v;
  }
  return out;
}

function avg(arr) {
  const nums = arr.filter((x) => typeof x === 'number' && Number.isFinite(x));
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function scale(v, full) {
  return clamp((v / full) * 100, 0, 100);
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function round1(v) {
  return Math.round(v * 10) / 10;
}
function daysBetween(a, b) {
  return Math.max(0, Math.floor((b - a) / 86400_000));
}
