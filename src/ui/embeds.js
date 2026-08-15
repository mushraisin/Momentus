import { EmbedBuilder } from 'discord.js';
import { COLORS, scoreColor } from './theme.js';

/**
 * Ембеди — мінімальний набір. Основний вигляд дають картки-зображення (cards.js);
 * ці ембеди використовуються як резерв, якщо рендер недоступний.
 */

export function baseEmbed() {
  return new EmbedBuilder().setColor(COLORS.neutral);
}

/** Хаб у каналі статистики. */
export function hubEmbed(guild) {
  return baseEmbed()
    .setColor(COLORS.primary)
    .setTitle('Профіль спільноти')
    .setDescription('Перегляньте свій профіль, репутацію або пройдіть перевірку на роль.')
    .setFooter({ text: guild.name, iconURL: guild.iconURL() ?? undefined });
}

/** Резервний профіль (без картинки). */
export function profileEmbed(profile, { username, tierName } = {}) {
  const e = baseEmbed()
    .setColor(scoreColor(profile.aiScore))
    .setTitle(username ?? 'Профіль')
    .setDescription(`Рейтинг: **${profile.aiScore} / 1000**${tierName ? `\nРівень: **${tierName}**` : ''}`)
    .addFields(
      { name: 'Повідомлень', value: `${profile.totalMessages}`, inline: true },
      { name: 'За 30 днів', value: `${profile.messages30d}`, inline: true },
      { name: 'Голосові', value: `${Math.round(profile.voiceMinutes / 60)} год`, inline: true },
      { name: 'Днів на сервері', value: `${profile.daysOnServer}`, inline: true },
      { name: 'Активних днів', value: `${profile.activeDays}`, inline: true },
      { name: 'Довіра', value: `${Math.round(profile.rep.trust)}`, inline: true },
    );
  return e;
}

/** Резервна репутація (без картинки). */
export function reputationEmbed(profile, categories) {
  const e = baseEmbed()
    .setColor(scoreColor(profile.aiScore))
    .setTitle('Репутація')
    .setDescription(`Загальний рейтинг: **${profile.aiScore} / 1000**`);
  for (const c of categories) {
    e.addFields({ name: c.label, value: `${Math.round(c.value)} / 100`, inline: true });
  }
  return e;
}

/** Резерв для перевірки (без картинки). */
export function verificationEmbed(ev, username) {
  const earned = ev.earned?.tier;
  const e = baseEmbed()
    .setColor(earned ? COLORS.success : COLORS.neutral)
    .setTitle('Перевірка')
    .setDescription(`${username ?? ''}\nРівень: **${earned ? earned.name : 'не досягнуто'}**`);
  for (const r of ev.results) {
    const done = r.checks.filter((c) => c.ok).length;
    e.addFields({ name: r.tier.name, value: `${done}/${r.checks.length || 0}`, inline: true });
  }
  return e;
}
