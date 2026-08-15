import { configService } from './configService.js';
import { roleRepo } from '../database/repositories.js';
import { DEFAULT_TIERS, evaluateTier, sortedTiers } from '../config/roleTiers.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('verify');

/**
 * «Перевірка»: визначає найвищий рівень, вимоги якого учасник виконує,
 * видає відповідну роль і ЗНІМАЄ ролі рівнів, яким він більше не відповідає.
 * Гістерезис (`verification.demotionMargin`) не дає ролі «блимати» на межі.
 */
export const verificationService = {
  /** Список рівнів з конфігу (або дефолтні). */
  tiers(guildId) {
    const raw = configService.get(guildId, 'verification.tiers');
    const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_TIERS;
    return sortedTiers(list);
  },

  /** Метрики профілю у пласкому вигляді для перевірки вимог. */
  metricsOf(profile) {
    const r = profile.rep ?? {};
    return {
      score: profile.aiScore ?? 0,
      trust: r.trust ?? 0,
      communication: r.communication ?? 0,
      helpfulness: r.helpfulness ?? 0,
      stability: r.stability ?? 0,
      activity: r.activity ?? 0,
      toxicity: r.toxicity ?? 0,
      conflict: r.conflict ?? 0,
      violations: r.violations ?? 0,
      days: profile.daysOnServer ?? 0,
      messages: profile.totalMessages ?? 0,
      activeDays: profile.activeDays ?? 0,
      samples: profile.traitsShort?.samples ?? 0,
    };
  },

  /**
   * Обчислити результат перевірки без застосування.
   * @returns {{ metrics, tiers, earned, current, next, missing }}
   */
  evaluate(guildId, profile, currentRoleIds = []) {
    const metrics = this.metricsOf(profile);
    const tiers = this.tiers(guildId);
    const margin = Number(configService.get(guildId, 'verification.demotionMargin') ?? 5);

    const results = tiers.map((t) => {
      const strict = evaluateTier(t, metrics, 0);
      const held = !!t.roleId && currentRoleIds.includes(t.roleId);
      // для вже виданої ролі застосовуємо послаблення (гістерезис)
      const keep = held ? evaluateTier(t, metrics, margin) : strict;
      return { tier: t, pass: strict.pass, keepPass: keep.pass, checks: strict.checks, held };
    });

    const earned = results.find((r) => r.pass) ?? null;              // найвищий досягнутий
    const current = results.find((r) => r.held) ?? null;             // що зараз має
    // наступний рівень для прогресу: перший вище за earned
    const idxEarned = earned ? results.indexOf(earned) : results.length;
    const next = idxEarned > 0 ? results[idxEarned - 1] : null;
    const missing = next ? next.checks.filter((c) => !c.ok) : [];

    return { metrics, results, earned, current, next, missing, margin };
  },

  /**
   * Застосувати результат: видати потрібну роль, зняти невідповідні.
   * @param {import('discord.js').GuildMember} member
   * @returns {Promise<{ granted, removed, kept, earned }>}
   */
  async apply(member, profile) {
    const guildId = member.guild.id;
    const currentRoleIds = [...member.roles.cache.keys()];
    const ev = this.evaluate(guildId, profile, currentRoleIds);

    const granted = [];
    const removed = [];
    let kept = null;

    for (const r of ev.results) {
      const roleId = r.tier.roleId;
      if (!roleId) continue;
      const has = currentRoleIds.includes(roleId);
      const isTarget = ev.earned && r.tier.key === ev.earned.tier.key;

      if (isTarget) {
        if (!has && await addRole(member, roleId)) {
          granted.push(r.tier);
          await roleRepo.set(guildId, member.id, r.tier.key, 'applied', { roleId, reason: 'перевірка пройдена' });
        } else if (has) {
          kept = r.tier;
        }
        continue;
      }

      // не цільовий рівень: знімаємо, якщо він у користувача і вимоги (з гістерезисом) не виконані
      if (has && !r.keepPass) {
        if (await removeRole(member, roleId)) {
          removed.push(r.tier);
          await roleRepo.set(guildId, member.id, r.tier.key, 'removed', { roleId, reason: 'вимоги більше не виконуються' });
        }
      } else if (has && r.keepPass) {
        kept = kept ?? r.tier;
      }
    }

    return { ...ev, granted, removed, kept };
  },
};

async function addRole(member, roleId) {
  try {
    await member.roles.add(roleId, 'Перевірка репутації');
    return true;
  } catch (err) {
    log.warn(`Не вдалося видати роль ${roleId}`, err.message);
    return false;
  }
}

async function removeRole(member, roleId) {
  try {
    await member.roles.remove(roleId, 'Пониження за результатами перевірки');
    return true;
  } catch (err) {
    log.warn(`Не вдалося зняти роль ${roleId}`, err.message);
    return false;
  }
}
