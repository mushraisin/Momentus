import { aiService } from './aiService.js';
import { reputationService } from './reputationService.js';
import { profileService } from './profileService.js';
import { verificationService } from './verificationService.js';
import { configService } from './configService.js';
import {
  traitsRepo, samplesRepo, aiUsageRepo,
} from '../database/repositories.js';
import { caches } from '../core/cache.js';
import { bus, EVENTS } from '../core/eventBus.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('pipeline');

/**
 * Буферизує повідомлення й періодично прогонить їх через AI пакетами.
 * Після аналізу: оновлює EMA ознак → перераховує репутацію → досягнення → ролі.
 */
class AnalysisPipeline {
  #buffers = new Map();   // guildId → [{id,userId,content,signals}]
  #behavior = new Map();  // userId → { times:number[], recent:string[] }
  #seq = 1;
  #timer = null;
  #clientRef = null;

  attach(client) {
    this.#clientRef = client;
  }

  /** Поставити повідомлення в чергу на аналіз. */
  enqueue(guildId, msg) {
    const cfg = configService.all(guildId);
    if (!cfg['ai.enabled']) return;
    const content = msg.content ?? '';
    if (content.length < (cfg['ai.minMessageLength'] ?? 3)) return;

    if (cfg['privacy.storeMessageContent']) {
      samplesRepo.add(guildId, msg.author.id, msg.channelId, content).catch(() => {});
    }

    const signals = this.#behaviorSignals(msg.author.id, content);

    const buf = this.#buffers.get(guildId) ?? [];
    buf.push({
      id: this.#seq++,
      userId: msg.author.id,
      content,
      channelId: msg.channelId,
      memberId: msg.member?.id,
      signals,
    });
    this.#buffers.set(guildId, buf);

    if (buf.length >= (cfg['ai.batchSize'] ?? 12)) {
      this.flush(guildId);
    } else {
      this.#scheduleFlush(cfg['ai.batchIntervalMs'] ?? 45_000);
    }
  }

  #scheduleFlush(intervalMs) {
    if (this.#timer) return;
    this.#timer = setTimeout(() => {
      this.#timer = null;
      this.flushAll();
    }, intervalMs);
  }

  flushAll() {
    for (const guildId of [...this.#buffers.keys()]) this.flush(guildId);
  }

  async flush(guildId) {
    const buf = this.#buffers.get(guildId);
    if (!buf || !buf.length) return;
    this.#buffers.set(guildId, []);

    // денний бюджет AI
    const cfg = configService.all(guildId);
    const usage = await aiUsageRepo.todayStats();
    if (aiService.enabled && usage.calls >= (cfg['ai.dailyCallBudget'] ?? 4000)) {
      log.warn('Досягнуто денного бюджету AI — пакет пропущено');
      return;
    }

    const signalsMap = new Map(buf.map((m) => [m.id, m.signals ?? {}]));
    let results;
    try {
      results = await aiService.analyzeBatch(buf, signalsMap);
    } catch (err) {
      log.error('analyzeBatch критично впав', err.message);
      return;
    }

    const affected = new Set();
    for (const r of results) {
      if (!r?.userId || !r.traits) continue;
      await traitsRepo.applySample(guildId, r.userId, r.traits);
      affected.add(r.userId);
      bus.emitSafe(EVENTS.MESSAGE_ANALYZED, { guildId, userId: r.userId, flag: r.flag, summary: r.summary });

      if (cfg['ai.autoModerate'] && r.traits.toxicity >= (cfg['ai.autoModerateThreshold'] ?? 85)) {
        bus.emitSafe('automod:candidate', { guildId, userId: r.userId, flag: r.flag, traits: r.traits });
      }
    }

    for (const userId of affected) {
      await this.#postProcess(guildId, userId);
    }
  }

  /**
   * Перерахунок для одного користувача: репутація → (за потреби) авто-перевірка ролей.
   * Авто-перевірка лише ЗНІМАЄ/понижує невідповідні ролі та підтверджує наявні —
   * підвищення користувач ініціює кнопкою «Перевірка».
   */
  async #postProcess(guildId, userId) {
    await reputationService.recompute(guildId, userId);
    caches.profile.delete(`${guildId}:${userId}`);

    if (!configService.get(guildId, 'verification.autoRecheck')) return;

    const member = await this.#fetchMember(guildId, userId);
    if (!member) return;
    // якщо в користувача немає жодної рівневої ролі — нічого перевіряти
    const tiers = verificationService.tiers(guildId);
    const holdsAny = tiers.some((t) => t.roleId && member.roles.cache.has(t.roleId));
    if (!holdsAny) return;

    const profile = await profileService.build(guildId, userId, { fresh: true });
    if (!profile) return;
    try {
      await verificationService.apply(member, profile);
    } catch (err) {
      log.warn('auto-verify впав', err.message);
    }
  }

  /** Поведінкові сигнали (частота/дублікати) — вхід для правило-рушія. */
  #behaviorSignals(userId, content) {
    const now = Date.now();
    const b = this.#behavior.get(userId) ?? { times: [], recent: [] };

    // частота: скільки повідомлень за останні 10 секунд
    b.times = b.times.filter((t) => now - t < 10_000);
    b.times.push(now);
    const burst = b.times.length;

    // дублікат: чи бачили (майже) такий самий текст серед останніх 5
    const norm = content.toLowerCase().replace(/\s+/g, ' ').trim();
    const duplicate = norm.length > 0 && b.recent.includes(norm);
    b.recent.push(norm);
    if (b.recent.length > 5) b.recent.shift();

    this.#behavior.set(userId, b);
    // легке обмеження мапи
    if (this.#behavior.size > 5000) {
      const firstKey = this.#behavior.keys().next().value;
      this.#behavior.delete(firstKey);
    }
    return { burst, duplicate };
  }

  async #fetchMember(guildId, userId) {
    if (!this.#clientRef) return null;
    try {
      const guild = this.#clientRef.guilds.cache.get(guildId) ?? await this.#clientRef.guilds.fetch(guildId);
      return guild.members.cache.get(userId) ?? await guild.members.fetch(userId);
    } catch {
      return null;
    }
  }
}

export const pipeline = new AnalysisPipeline();
