import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder, RoleSelectMenuBuilder, ChannelType,
} from 'discord.js';

/**
 * customId кодуємо як `ns:action:arg1:arg2`.
 * Це дозволяє одному роутеру розбирати всі взаємодії без зайвого стану.
 */
export function cid(ns, action, ...args) {
  return [ns, action, ...args].join(':');
}

export function parseCid(customId) {
  const [ns, action, ...args] = customId.split(':');
  return { ns, action, args };
}

/** Кнопка-хелпер. */
export function button({ id, label, style = ButtonStyle.Secondary, emoji, disabled = false }) {
  const b = new ButtonBuilder().setCustomId(id).setStyle(style).setDisabled(disabled);
  if (label) b.setLabel(label);
  if (emoji) b.setEmoji(emoji);
  return b;
}

export function linkButton({ label, url, emoji }) {
  const b = new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel(label);
  if (emoji) b.setEmoji(emoji);
  return b;
}

/** Розкладає кнопки по рядах (макс. 5 у ряд, макс. 5 рядів). */
export function rows(buttons) {
  const out = [];
  for (let i = 0; i < buttons.length; i += 5) {
    out.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  }
  return out.slice(0, 5);
}

export function selectRow({ id, placeholder, options, min = 1, max = 1, disabled = false }) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(id)
    .setPlaceholder(placeholder)
    .setMinValues(min)
    .setMaxValues(max)
    .setDisabled(disabled)
    .addOptions(
      options.slice(0, 25).map((o) => {
        const opt = new StringSelectMenuOptionBuilder()
          .setLabel(o.label.slice(0, 100))
          .setValue(o.value)
          .setDefault(!!o.default);
        if (o.description) opt.setDescription(o.description.slice(0, 100));
        if (o.emoji) opt.setEmoji(o.emoji);
        return opt;
      }),
    );
  return new ActionRowBuilder().addComponents(menu);
}

/** Нативний селектор каналу (без потреби копіювати ID). */
export function channelSelectRow({ id, placeholder, types = [ChannelType.GuildText, ChannelType.GuildAnnouncement] }) {
  const menu = new ChannelSelectMenuBuilder()
    .setCustomId(id)
    .setPlaceholder(placeholder)
    .setChannelTypes(types)
    .setMinValues(1)
    .setMaxValues(1);
  return new ActionRowBuilder().addComponents(menu);
}

/** Нативний селектор ролі (без копіювання ID). */
export function roleSelectRow({ id, placeholder }) {
  const menu = new RoleSelectMenuBuilder()
    .setCustomId(id)
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1);
  return new ActionRowBuilder().addComponents(menu);
}

/** Рядок навігації пагінації. */
export function pager(ns, action, page, totalPages, extra = '') {
  const mk = (act, label, emoji, disabled) =>
    button({ id: cid(ns, action, act, String(page), extra), label, emoji, disabled, style: ButtonStyle.Secondary });
  return new ActionRowBuilder().addComponents(
    mk('first', null, '⏮️', page <= 0),
    mk('prev', null, '◀️', page <= 0),
    button({ id: cid(ns, 'noop'), label: `${page + 1}/${Math.max(totalPages, 1)}`, disabled: true }),
    mk('next', null, '▶️', page >= totalPages - 1),
    mk('last', null, '⏭️', page >= totalPages - 1),
  );
}

export { ButtonStyle };
