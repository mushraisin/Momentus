import {
  ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} from 'discord.js';
import { NS } from '../config/constants.js';
import { CONFIG_SCHEMA } from '../config/defaults.js';
import { cid } from './components.js';
import { configService } from '../services/configService.js';
import { verificationService } from '../services/verificationService.js';

function input({ id, label, value = '', style = TextInputStyle.Short, required = false, placeholder }) {
  const max = style === TextInputStyle.Paragraph ? 4000 : 200;
  const t = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label.slice(0, 45))
    .setStyle(style)
    .setRequired(required)
    .setMaxLength(max);
  if (value !== '' && value !== null && value !== undefined) t.setValue(String(value).slice(0, max));
  if (placeholder) t.setPlaceholder(placeholder.slice(0, 100));
  return new ActionRowBuilder().addComponents(t);
}

/** Редагування довільного поля конфігурації. */
export function configModal(guildId, key) {
  const schema = CONFIG_SCHEMA[key];
  if (!schema) return null;
  const current = configService.get(guildId, key);
  const isJson = schema.type === 'json' || schema.type === 'roles';
  const value = isJson ? JSON.stringify(current) : String(current ?? '');

  const hint = {
    bool: 'true / false', int: 'ціле число', float: 'число',
    roles: 'ID через кому', json: 'JSON', channel: 'ID каналу', string: 'текст',
  }[schema.type];

  return new ModalBuilder()
    .setCustomId(cid(NS.ADMIN, 'save', key))
    .setTitle(schema.label.slice(0, 45))
    .addComponents(input({
      id: 'value',
      label: `Значення (${hint})`,
      value,
      style: isJson ? TextInputStyle.Paragraph : TextInputStyle.Short,
      placeholder: hint,
    }));
}

/** Групи вимог — по 5 полів (ліміт Discord на модалку). */
export const REQ_GROUPS = {
  core: {
    title: 'Вимоги: активність',
    fields: [
      ['minScore', 'Мін. рейтинг (0-1000)'],
      ['minDays', 'Мін. днів на сервері'],
      ['minMessages', 'Мін. повідомлень'],
      ['minActiveDays', 'Мін. активних днів'],
      ['minSamples', 'Мін. оцінених повідомлень'],
    ],
  },
  behavior: {
    title: 'Вимоги: поведінка',
    fields: [
      ['minTrust', 'Мін. довіра (0-100)'],
      ['minCommunication', 'Мін. комунікація (0-100)'],
      ['minHelpfulness', 'Мін. допомога (0-100)'],
      ['maxToxicity', 'Макс. токсичність (0-100)'],
      ['maxViolations', 'Макс. порушення (0-100)'],
    ],
  },
};

/** Назва + пріоритет рівня. */
export function tierNameModal(guildId, key) {
  const tier = key ? verificationService.tiers(guildId).find((t) => t.key === key) : null;
  const isNew = !tier;

  return new ModalBuilder()
    .setCustomId(cid(NS.ADMIN, 'saveName', key ?? ''))
    .setTitle(isNew ? 'Новий рівень' : 'Назва та пріоритет')
    .addComponents(
      input({ id: 'name', label: 'Назва рівня', value: tier?.name ?? '', required: true, placeholder: 'напр. Довірена' }),
      input({ id: 'priority', label: 'Пріоритет (більше = вищий)', value: tier?.priority ?? 5, required: true, placeholder: '1-99' }),
      input({ id: 'color', label: 'Колір HEX (необовʼязково)', value: tier?.color ?? '#5865f2', placeholder: '#5865f2' }),
    );
}

/** Сторінка сайту (зберігається в Turso). */
export async function pageModal(guildId, slug) {
  const { sitePagesRepo } = await import('../database/repositories.js');
  const page = slug ? await sitePagesRepo.get(guildId, slug) : null;

  return new ModalBuilder()
    .setCustomId(cid(NS.ADMIN, 'savePage', slug ?? ''))
    .setTitle(page ? `Сторінка: ${page.title}`.slice(0, 45) : 'Нова сторінка')
    .addComponents(
      input({ id: 'slug', label: 'Адреса (латиниця, напр. rules)', value: page?.slug ?? '', required: true, placeholder: 'rules' }),
      input({ id: 'title', label: 'Назва в меню', value: page?.title ?? '', required: true }),
      input({
        id: 'body',
        label: 'Вміст (HTML)',
        value: page?.body ?? '<p>Текст сторінки</p>',
        style: TextInputStyle.Paragraph,
        required: true,
      }),
      input({ id: 'published', label: 'Опубліковано? (true/false)', value: page ? String(!!page.published) : 'true' }),
    );
}

/** Кастомний CSS сайту (зберігається в Turso як «файл» /custom.css). */
export async function cssModal(guildId) {
  const { siteAssetsRepo } = await import('../database/repositories.js');
  const asset = await siteAssetsRepo.get(guildId, '/custom.css');

  return new ModalBuilder()
    .setCustomId(cid(NS.ADMIN, 'saveCss'))
    .setTitle('Кастомний CSS сайту')
    .addComponents(input({
      id: 'css',
      label: 'CSS (порожнє = прибрати)',
      value: asset?.content ?? ':root{ --accent:#6b7cff }',
      style: TextInputStyle.Paragraph,
    }));
}

/** Модалка групи вимог: кожне поле окремо, порожнє = не перевіряти. */
export function tierReqModal(guildId, key, group) {
  const tier = verificationService.tiers(guildId).find((t) => t.key === key);
  if (!tier) return null;
  const g = REQ_GROUPS[group];
  if (!g) return null;

  const modal = new ModalBuilder()
    .setCustomId(cid(NS.ADMIN, 'saveReq', key, group))
    .setTitle(`${g.title}`.slice(0, 45));

  for (const [field, label] of g.fields) {
    modal.addComponents(input({
      id: field,
      label,
      value: tier.req?.[field] ?? '',
      placeholder: 'порожнє = не перевіряти',
    }));
  }
  return modal;
}
