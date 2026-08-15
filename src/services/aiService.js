import { createLogger } from '../core/logger.js';
import { aiQueue } from '../core/queue.js';
import { caches } from '../core/cache.js';
import { aiUsageRepo } from '../database/repositories.js';
import { MESSAGE_TRAITS } from '../config/constants.js';
import { ruleAnalyzeBatch } from './analysis/ruleEngine.js';
import { ruleRecommendations, rulePrediction, ruleModerationAdvice } from './analysis/insightsEngine.js';
import { createOllamaProvider } from './ai/ollamaProvider.js';
import { createAnthropicProvider } from './ai/anthropicProvider.js';

const log = createLogger('ai');

const HARD_DISABLED = String(process.env.AI_DISABLED).toLowerCase() === 'true';

/**
 * Вибір провайдера ШІ:
 *   AI_PROVIDER=ollama    → локальна модель (Ollama), безкоштовно й офлайн;
 *   AI_PROVIDER=anthropic → хмара Anthropic;
 *   не задано             → anthropic, якщо є ANTHROPIC_API_KEY, інакше евристики.
 */
const provider = selectProvider();

function selectProvider() {
  if (HARD_DISABLED) return null;
  const kind = (process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'none')).toLowerCase();
  try {
    if (kind === 'ollama') {
      const p = createOllamaProvider();
      log.info(`AI-провайдер: Ollama (локально), модель ${p.model}. Переконайтесь, що "ollama serve" запущено.`);
      return p;
    }
    if (kind === 'anthropic') {
      const p = createAnthropicProvider();
      if (p) {
        log.info(`AI-провайдер: Anthropic (хмара), модель ${p.model}.`);
        return p;
      }
    }
  } catch (err) {
    log.warn('Не вдалося ініціалізувати AI-провайдер', err.message);
  }
  log.info('Аналітика: правило-рушій (без ШІ) — детермінований аналіз, офлайн.');
  return null;
}

// ─────────────────────────────────────────────
//  JSON-схеми для structured output
// ─────────────────────────────────────────────

/** Схема оцінок одного повідомлення: усі ознаки 0..100. */
const traitProps = Object.fromEntries(
  MESSAGE_TRAITS.map((t) => [t, { type: 'integer', minimum: 0, maximum: 100 }]),
);

const BATCH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'integer' },
          traits: { type: 'object', additionalProperties: false, properties: traitProps, required: MESSAGE_TRAITS },
          flag: { type: 'string', enum: ['ok', 'watch', 'toxic', 'spam', 'ad'] },
          summary: { type: 'string' },
        },
        required: ['id', 'traits', 'flag', 'summary'],
      },
    },
  },
  required: ['results'],
};

const RECOMMENDATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    good: { type: 'array', items: { type: 'string' } },
    bad: { type: 'array', items: { type: 'string' } },
    improve: { type: 'array', items: { type: 'string' } },
    topPositive: { type: 'string' },
    topNegative: { type: 'string' },
    trendNote: { type: 'string' },
  },
  required: ['good', 'bad', 'improve', 'topPositive', 'topNegative', 'trendNote'],
};

const PREDICTION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    goodModerator: { type: 'integer', minimum: 0, maximum: 100 },
    trustworthy: { type: 'integer', minimum: 0, maximum: 100 },
    adminPotential: { type: 'integer', minimum: 0, maximum: 100 },
    toxicityRisk: { type: 'integer', minimum: 0, maximum: 100 },
    behaviorTrend: { type: 'string', enum: ['improving', 'stable', 'declining'] },
    rationale: { type: 'string' },
  },
  required: ['goodModerator', 'trustworthy', 'adminPotential', 'toxicityRisk', 'behaviorTrend', 'rationale'],
};

const MOD_ADVICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reoffendProbability: { type: 'integer', minimum: 0, maximum: 100 },
    incidentType: { type: 'string', enum: ['accidental', 'systematic', 'ambiguous'] },
    hadSimilarCases: { type: 'boolean' },
    improved: { type: 'boolean' },
    recommendedAction: { type: 'string', enum: ['none', 'talk', 'note', 'warn', 'mute', 'timeout', 'kick', 'ban'] },
    softerSuggested: { type: 'boolean' },
    reasoning: { type: 'string' },
  },
  required: ['reoffendProbability', 'incidentType', 'hadSimilarCases', 'improved', 'recommendedAction', 'softerSuggested', 'reasoning'],
};

// ─────────────────────────────────────────────
//  Обгортка виклику з structured output
// ─────────────────────────────────────────────

async function callStructured({ system, prompt, schema, label, maxTokens = 1500 }) {
  try {
    const { data, usage } = await provider.generate({ system, prompt, schema, maxTokens });
    aiUsageRepo.record({ inTokens: usage?.in ?? 0, outTokens: usage?.out ?? 0 }).catch(() => {});
    return data;
  } catch (err) {
    err.aiLabel = label;
    throw err;
  }
}

// ─────────────────────────────────────────────
//  Публічний API
// ─────────────────────────────────────────────

export const aiService = {
  get enabled() {
    return !!provider;
  },

  get providerName() {
    return provider?.name ?? 'heuristic';
  },

  /**
   * Аналіз пакета повідомлень.
   * @param {Array<{id:number,userId:string,content:string}>} messages
   * @returns {Promise<Array<{id,userId,traits,flag,summary}>>}
   */
  async analyzeBatch(messages, signalsMap) {
    if (!messages.length) return [];
    if (!provider) return ruleAnalyzeBatch(messages, signalsMap);

    const byId = new Map(messages.map((m) => [m.id, m]));
    const prompt = buildBatchPrompt(messages);

    try {
      return await aiQueue.push(
        async () => {
          const data = await callStructured({
            system: BATCH_SYSTEM,
            prompt,
            schema: BATCH_SCHEMA,
            label: 'batch',
            maxTokens: Math.min(400 + messages.length * 120, 4000),
          });
          return data.results.map((r) => ({
            id: r.id,
            userId: byId.get(r.id)?.userId,
            traits: r.traits,
            flag: r.flag,
            summary: r.summary,
          })).filter((r) => r.userId);
        },
        { label: `batch:${messages.length}`, priority: 1 },
      );
    } catch (err) {
      aiUsageRepo.record({ error: true }).catch(() => {});
      log.warn('Пакетний аналіз впав — використовую правило-рушій', err.message);
      return ruleAnalyzeBatch(messages, signalsMap);
    }
  },

  /** Персональні рекомендації по профілю (ШІ або правило-рушій). */
  async recommendations(profile) {
    const cacheKey = `rec:${profile.guildId}:${profile.userId}`;
    const cached = caches.aiAnalysis.get(cacheKey);
    if (cached) return cached;
    if (!provider) return ruleRecommendations(profile);

    try {
      const data = await aiQueue.push(
        () => callStructured({
          system: 'Ти — AI Community Manager. Пиши українською, коротко, доброзичливо, по суті. Кожен пункт — одне речення.',
          prompt: buildRecommendationPrompt(profile),
          schema: RECOMMENDATION_SCHEMA,
          label: 'recommendation',
        }),
        { label: 'rec', priority: 2 },
      );
      return caches.aiAnalysis.set(cacheKey, data);
    } catch (err) {
      log.warn('recommendations впало — правило-рушій', err.message);
      return ruleRecommendations(profile);
    }
  },

  /** Прогноз потенціалу та ризиків (ШІ або правило-рушій). */
  async prediction(profile) {
    const cacheKey = `pred:${profile.guildId}:${profile.userId}`;
    const cached = caches.aiAnalysis.get(cacheKey);
    if (cached) return cached;
    if (!provider) return rulePrediction(profile);

    try {
      const data = await aiQueue.push(
        () => callStructured({
          system: 'Ти — AI-аналітик спільноти. Оцінюй чесно й обережно. Пиши українською.',
          prompt: buildPredictionPrompt(profile),
          schema: PREDICTION_SCHEMA,
          label: 'prediction',
        }),
        { label: 'pred', priority: 2 },
      );
      return caches.aiAnalysis.set(cacheKey, data);
    } catch (err) {
      log.warn('prediction впало — правило-рушій', err.message);
      return rulePrediction(profile);
    }
  },

  /** Порада модератору перед покаранням (ШІ або правило-рушій). */
  async moderationAdvice(profile, context) {
    if (!provider) return ruleModerationAdvice(profile, context);
    try {
      return await aiQueue.push(
        () => callStructured({
          system: 'Ти — асистент модератора. Рекомендуй пропорційну реакцію. Остаточне рішення — за людиною. Пиши українською.',
          prompt: buildModAdvicePrompt(profile, context),
          schema: MOD_ADVICE_SCHEMA,
          label: 'mod_advice',
        }),
        { label: 'mod', priority: 3 },
      );
    } catch (err) {
      log.warn('moderationAdvice впало — правило-рушій', err.message);
      return ruleModerationAdvice(profile, context);
    }
  },
};

// ─────────────────────────────────────────────
//  Промпти
// ─────────────────────────────────────────────

const BATCH_SYSTEM = `Ти — AI-модератор культури спілкування. Оцінюєш КОНТЕКСТ повідомлення, а не наявність окремих слів.
Для кожного повідомлення вистав усі ознаки як цілі 0..100:
- позитивні (politeness, constructiveness, adequacy, helpfulness, friendliness, respect, positiveImpact, cultureLevel): вище = краще;
- негативні (toxicity, insult, bullying, harassment, passiveAggression, sarcasm, threat, profanity, provocation, flood, spam, advertising, conflictSeeking): вище = гірше.
Сарказм чи лайка в дружньому контексті — низька токсичність. Прихована агресія без лайки — висока.
flag: ok | watch | toxic | spam | ad. summary — 1 коротке речення українською.
Відповідай ЛИШЕ за схемою.`;

function buildBatchPrompt(messages) {
  const lines = messages.map((m) => `#${m.id}: ${truncate(m.content, 400)}`).join('\n');
  return `Оціни повідомлення (id збережи):\n${lines}`;
}

function buildRecommendationPrompt(p) {
  return [
    `Профіль користувача (0..100, крім ai_score 0..1000):`,
    `AI Score: ${p.aiScore}`,
    `Репутація: ${JSON.stringify(p.rep)}`,
    `Ознаки (EMA): ${JSON.stringify(p.traitsShort)}`,
    `Активність: ${p.messages30d} повідомл./30дн, ${p.voiceMinutes} хв войсу, реакцій отримано ${p.reactionsReceived}.`,
    `Тренд токсичності: ${p.toxicityDrop >= 0 ? 'знизилась' : 'зросла'} на ${Math.abs(p.toxicityDrop)} за місяць.`,
    `Покарань: ${p.punishments}. Днів на сервері: ${p.daysOnServer}.`,
    `Дай: що добре (good), що погано (bad), що покращити (improve), головний плюс/мінус, короткий коментар тренду.`,
  ].join('\n');
}

function buildPredictionPrompt(p) {
  return [
    `Оціни потенціал і ризики користувача.`,
    `AI Score: ${p.aiScore}/1000. Репутація: ${JSON.stringify(p.rep)}.`,
    `Днів на сервері: ${p.daysOnServer}. Покарань: ${p.punishments}. Тренд токсичності за місяць: ${p.toxicityDrop}.`,
    `Оціни ймовірності (0..100) стати хорошим модератором, довіри, потенціалу адміна, ризику токсичності; тренд поведінки.`,
  ].join('\n');
}

function buildModAdvicePrompt(p, ctx) {
  return [
    `Модератор розглядає покарання.`,
    `Тип дії, що розглядається: ${ctx.action}.`,
    `Причина: ${ctx.reason ?? '—'}.`,
    `Історія покарань: warns=${p.mod.warns ?? 0}, mutes=${p.mod.mutes ?? 0}, timeouts=${p.mod.timeouts ?? 0}, kicks=${p.mod.kicks ?? 0}, bans=${p.mod.bans ?? 0}.`,
    `Повторюваність цієї дії раніше: ${ctx.repeatIndex ?? 1}.`,
    `Поточна токсичність: ${p.rep.toxicity}, конфліктність: ${p.rep.conflict}, тренд токсичності: ${p.toxicityDrop}.`,
    `Днів після останнього покарання: ${ctx.daysSinceLast ?? 'н/д'}.`,
    `Порадь: ймовірність повторення, тип (accidental/systematic/ambiguous), чи були схожі випадки, чи покращився, рекомендована дія, чи варто мʼякше.`,
  ].join('\n');
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
