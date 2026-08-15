import { ButtonStyle } from 'discord.js';
import { NS, REPUTATION_CATEGORIES } from '../config/constants.js';
import { button, cid, rows, linkButton } from './components.js';
import * as E from './embeds.js';
import * as cards from './cards.js';
import { profileService } from '../services/profileService.js';
import { verificationService } from '../services/verificationService.js';

/**
 * Панелі. Доступні лише три дії: Профіль, Репутація, Перевірка.
 * Основний вигляд — картки-зображення; ембеди лише як резерв.
 */

/** Адреса сайту для кнопки-посилання. */
const SITE_URL = () => process.env.WEB_PUBLIC_URL || 'https://moments.zadrypanka.xyz';

/** Хаб у каналі статистики. */
export function hubPanel(guild) {
  return {
    embeds: [E.hubEmbed(guild)],
    components: rows([
      button({ id: cid(NS.PROFILE, 'open'), label: 'Профіль', emoji: '👤', style: ButtonStyle.Primary }),
      button({ id: cid(NS.REP, 'open'), label: 'Репутація', emoji: '📊' }),
      button({ id: cid(NS.VERIFY, 'run'), label: 'Перевірка', emoji: '🛡️', style: ButtonStyle.Success }),
      linkButton({ label: 'Сайт', url: SITE_URL(), emoji: '🌐' }),
      linkButton({ label: 'Кінотеатр', url: `${SITE_URL().replace(/\/$/, '')}/cinema`, emoji: '🎬' }),
    ]),
  };
}

/** Ряд навігації між розділами + посилання на сайт. */
function nav(active) {
  const mk = (ns, action, label, emoji) =>
    button({
      id: cid(ns, action),
      label,
      emoji,
      style: active === ns ? ButtonStyle.Primary : ButtonStyle.Secondary,
    });
  return rows([
    mk(NS.PROFILE, 'open', 'Профіль', '👤'),
    mk(NS.REP, 'open', 'Репутація', '📊'),
    mk(NS.VERIFY, 'run', 'Перевірка', '🛡️'),
    linkButton({ label: 'Сайт', url: SITE_URL(), emoji: '🌐' }),
  ]);
}

/** Профіль користувача. */
export async function profileView(guild, userId, user) {
  const profile = await profileService.build(guild.id, userId, { fresh: true });
  if (!profile) return { content: 'Даних ще немає.', embeds: [], files: [], components: nav(NS.PROFILE) };

  const member = await fetchMember(guild, userId);
  const role = await currentRole(guild, member);
  const username = member?.displayName ?? user?.displayName ?? user?.username ?? profile.username ?? '';
  const avatarUrl = (member ?? user)?.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? null;

  const card = await cards.profileCard(profile, {
    username,
    avatarUrl,
    roleName: role?.name,
    roleColor: role?.color,
    accent: memberAccent(member),
  });

  return card
    ? { files: [card], embeds: [], components: nav(NS.PROFILE) }
    : { embeds: [E.profileEmbed(profile, { username, tierName: role?.name })], files: [], components: nav(NS.PROFILE) };
}

/** Деталізація репутації. */
export async function reputationView(guild, userId) {
  const profile = await profileService.build(guild.id, userId, { fresh: true });
  if (!profile) return { content: 'Даних ще немає.', embeds: [], files: [], components: nav(NS.REP) };

  const member = await fetchMember(guild, userId);

  const categories = REPUTATION_CATEGORIES.map((c) => {
    const value = profile.rep[c.key] ?? 0;
    return {
      key: c.key,
      label: c.inverted ? `${c.label} ↓` : c.label,
      value,
      level: c.inverted ? 100 - value : value,
    };
  });

  const card = await cards.reputationCard(profile, categories, { accent: memberAccent(member) });
  return card
    ? { files: [card], embeds: [], components: nav(NS.REP) }
    : { embeds: [E.reputationEmbed(profile, categories)], files: [], components: nav(NS.REP) };
}

/** Перевірка: оцінка + видача/зняття ролі. */
export async function verificationView(guild, member, user) {
  const profile = await profileService.build(guild.id, member.id, { fresh: true });
  if (!profile) return { content: 'Даних ще немає.', embeds: [], files: [], components: nav(NS.VERIFY) };

  const ev = await verificationService.apply(member, profile);
  const username = member?.displayName ?? user?.displayName ?? user?.username ?? profile.username ?? '';
  const avatarUrl = (member ?? user)?.displayAvatarURL?.({ extension: 'png', size: 256 }) ?? null;

  // показуємо реальні назви та кольори ролей Discord, а не внутрішні назви рівнів
  await ensureRoles(guild);
  for (const r of ev.results) r.display = roleDisplay(guild, r.tier);
  if (ev.earned) ev.earned.display = roleDisplay(guild, ev.earned.tier);

  const card = await cards.verificationCard(ev, {
    username,
    avatarUrl,
    accent: memberAccent(member),
  });
  return card
    ? { files: [card], embeds: [], components: nav(NS.VERIFY) }
    : { embeds: [E.verificationEmbed(ev, username)], files: [], components: nav(NS.VERIFY) };
}

/**
 * Реальна роль Discord для рівня: її справжня назва й колір.
 * Якщо роль не привʼязана або видалена — повертаємо назву рівня як запасну.
 */
function roleDisplay(guild, tier) {
  const role = tier?.roleId ? guild.roles.cache.get(tier.roleId) : null;
  if (!role) return { name: tier?.name ?? '—', color: tier?.color ?? null };
  return {
    name: role.name,
    // роль без кольору (0) — беремо колір рівня, щоб не було чорного
    color: role.color ? role.hexColor : (tier?.color ?? null),
  };
}

/** Найвища привʼязана роль рівня — для показу в профілі. */
async function currentRole(guild, member) {
  try {
    if (!member) return null;
    await ensureRoles(guild);
    const tier = verificationService.tiers(guild.id).find((t) => t.roleId && member.roles.cache.has(t.roleId));
    return tier ? roleDisplay(guild, tier) : null;
  } catch {
    return null;
  }
}

/**
 * Колірний тон картки — за НАЙВИЩОЮ кольоровою роллю учасника (будь-якою).
 * `displayHexColor` у discord.js — це саме колір найвищої ролі з кольором.
 */
function memberAccent(member) {
  const c = member?.displayHexColor;
  return c && c !== '#000000' ? c : null;
}

async function fetchMember(guild, userId) {
  try {
    return guild.members.cache.get(userId) ?? await guild.members.fetch(userId);
  } catch {
    return null;
  }
}

/** Кеш ролей може бути порожнім — підтягуємо, інакше не побачимо назв/кольорів. */
async function ensureRoles(guild) {
  if (guild.roles.cache.size <= 1) await guild.roles.fetch().catch(() => {});
}
