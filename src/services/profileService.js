import {
  usersRepo, traitsRepo, reputationRepo, activityRepo,
  modRepo, snapshotRepo,
} from '../database/repositories.js';
import { caches } from '../core/cache.js';
import { REPUTATION_CATEGORIES } from '../config/constants.js';

/**
 * Збирає повний, готовий до рендеру профіль користувача:
 * зʼєднує users + traits + reputation + активність + модерацію + тренди.
 */
export const profileService = {
  async build(guildId, userId, { fresh = false } = {}) {
    const key = `${guildId}:${userId}`;
    if (!fresh) {
      const cached = caches.profile.get(key);
      if (cached) return cached;
    }

    const user = await usersRepo.get(guildId, userId);
    if (!user) return null;

    const traits = (await traitsRepo.get(guildId, userId)) ?? {};
    const rep = (await reputationRepo.get(guildId, userId)) ?? {};
    const modStats = (await modRepo.stats(guildId, userId)) ?? {};

    const daysOnServer = daysBetween(user.joined_at ?? user.first_seen_at, Date.now());
    const messages30d = await activityRepo.sumSince(guildId, userId, 30, 'messages');
    const messages7d = await activityRepo.sumSince(guildId, userId, 7, 'messages');
    const messages1d = await activityRepo.sumSince(guildId, userId, 1, 'messages');
    const voiceMinutes = user.voice_minutes;
    const activeDays = await activityRepo.activeDays(guildId, userId);

    // тренд: різниця з найближчим знімком місячної давнини
    const snapMonth = await snapshotRepo.nearest(guildId, userId, 30);
    const snapWeek = await snapshotRepo.nearest(guildId, userId, 7);
    const monthAgo = snapMonth ? JSON.parse(snapMonth.payload) : null;
    const toxicityDrop = monthAgo ? round1((monthAgo.toxicity ?? 0) - (rep.toxicity ?? 0)) : 0;
    const scoreDeltaWeek = snapWeek ? (rep.ai_score ?? 0) - snapWeek.ai_score : 0;
    const scoreDeltaMonth = snapMonth ? (rep.ai_score ?? 0) - snapMonth.ai_score : 0;

    // Дані для графіків готуємо тут, щоб embed-и лишалися синхронними й «чистими».
    const scoreHistory = (await snapshotRepo.history(guildId, userId, 60)).map((h) => h.ai_score);
    const dailyMessages = (await activityRepo.range(guildId, userId, 14)).map((d) => d.messages);

    const profile = {
      guildId,
      userId,
      username: user.username,
      daysOnServer,
      joinedAt: user.joined_at ?? user.first_seen_at,

      totalMessages: user.total_messages,
      messages30d,
      messages7d,
      messages1d,
      voiceMinutes,
      activeDays,
      reactionsReceived: user.reactions_received,
      reactionsGiven: user.reactions_given,
      helpCount: user.help_count,
      nightMessages: user.night_messages,
      distinctPeers: user.distinct_peers,

      aiScore: rep.ai_score ?? 500,
      rep: pickRep(rep),
      traitsShort: shortTraits(traits),

      punishments: (modStats.total ?? 0),
      mod: modStats,

      toxicityDrop,
      scoreDeltaWeek,
      scoreDeltaMonth,

      scoreHistory,
      dailyMessages,

    };

    caches.profile.set(key, profile);
    return profile;
  },

  /** Кольорові категорії з рівнями для рендеру. */
  categorizedReputation(profile) {
    return REPUTATION_CATEGORIES.map((c) => {
      const value = profile.rep[c.key] ?? 0;
      const level = c.inverted ? 100 - value : value;
      return { ...c, value, level, tier: tierFor(level) };
    });
  },
};

function pickRep(rep) {
  const keys = ['trust', 'activity', 'communication', 'helpfulness', 'usefulness', 'stability', 'behavior', 'conflict', 'toxicity', 'violations', 'peer'];
  const out = {};
  for (const k of keys) out[k] = round1(rep[k] ?? 0);
  return out;
}

function shortTraits(t) {
  return {
    toxicity: round1(t.toxicity ?? 0),
    helpfulness: round1(t.helpfulness ?? 0),
    politeness: round1(t.politeness ?? 0),
    constructiveness: round1(t.constructiveness ?? 0),
    conflictSeeking: round1(t.conflictSeeking ?? 0),
    samples: t.samples ?? 0,
  };
}

function tierFor(level) {
  if (level >= 85) return 'excellent';
  if (level >= 70) return 'good';
  if (level >= 50) return 'ok';
  if (level >= 30) return 'weak';
  return 'poor';
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
function daysBetween(a, b) {
  return Math.max(0, Math.floor((b - a) / 86400_000));
}
