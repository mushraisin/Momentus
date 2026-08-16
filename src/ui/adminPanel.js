import { ButtonStyle, ChannelType } from 'discord.js';
import { NS } from '../config/constants.js';
import { button, cid, rows, selectRow, channelSelectRow, roleSelectRow } from './components.js';
import { baseEmbed } from './embeds.js';
import { COLORS } from './theme.js';
import { configService } from '../services/configService.js';
import { verificationService } from '../services/verificationService.js';
import { LANGS } from '../i18n/index.js';
import { usersRepo } from '../database/repositories.js';
import { bgQueue } from '../core/queue.js';

const GROUP_LABELS = {
  general: '⚙️ Загальне',
  access: '🔑 Доступ',
  verification: '🛡️ Перевірка',
  weights: '⚖️ Ваги',
  ai: '🤖 Аналіз',
  media: '🎬 Галерея й кінотеатр',
  privacy: '🔒 Приватність',
};

/** Первинне налаштування: привʼязка каналу. */
export function setupPanel(guild) {
  const embed = baseEmbed()
    .setColor(COLORS.primary)
    .setTitle('Налаштування')
    .setDescription('Оберіть канал для панелі.')
    .setFooter({ text: guild.name });

  return {
    embeds: [embed],
    components: [
      channelSelectRow({ id: cid(NS.ADMIN, 'bindChannel'), placeholder: 'Канал для панелі…' }),
      ...rows([
        button({ id: cid(NS.ADMIN, 'bindHere'), label: 'Тут', emoji: '📢', style: ButtonStyle.Success }),
        button({ id: cid(NS.ADMIN, 'home'), label: 'Налаштування', emoji: '⚙️' }),
      ]),
    ],
  };
}

/** Головна адмін-панель. */
export async function adminHome(guild) {
  const memberCount = await usersRepo.count(guild.id);
  const tiers = verificationService.tiers(guild.id);
  const bound = tiers.filter((t) => t.roleId).length;

  const embed = baseEmbed()
    .setColor(COLORS.primary)
    .setTitle('Адміністрування')
    .addFields(
      { name: 'Учасників', value: `\`${memberCount}\``, inline: true },
      { name: 'Рівнів', value: `\`${tiers.length}\` (привʼязано ${bound})`, inline: true },
    );

  const lang = configService.get(guild.id, 'general.locale');

  return {
    embeds: [embed],
    components: [
      selectRow({
        id: cid(NS.ADMIN, 'group'),
        placeholder: 'Розділ…',
        options: Object.entries(GROUP_LABELS).map(([value, label]) => ({ value, label })),
      }),
      selectRow({
        id: cid(NS.ADMIN, 'lang'),
        placeholder: 'Мова бота…',
        options: Object.values(LANGS).map((l) => ({
          value: l.code,
          label: `${l.short} — ${l.name}`,
          default: l.code === lang,
        })),
      }),
      ...rows([
        button({ id: cid(NS.MOD, 'home'), label: 'Модерація', emoji: '🛡️', style: ButtonStyle.Danger }),
        button({ id: cid(NS.ADMIN, 'tiers'), label: 'Рівні ролей', emoji: '🎖️', style: ButtonStyle.Primary }),
        button({ id: cid(NS.ADMIN, 'site'), label: 'Сайт', emoji: '🌐' }),
        button({ id: cid(NS.ADMIN, 'deploy'), label: 'Опублікувати панель', emoji: '📢' }),
        button({ id: cid(NS.DEV, 'open'), label: 'Dev', emoji: '🧬' }),
      ]),
    ],
  };
}

/** Керування рівнями ролей: перегляд, пріоритети, редагування, додавання. */
export function tiersPanel(guild) {
  const tiers = verificationService.tiers(guild.id);

  const lines = tiers.map((t, i) => {
    const role = t.roleId ? `<@&${t.roleId}>` : '`не привʼязано`';
    return `**${i + 1}.** ${t.name} — ${role} · пріоритет \`${t.priority ?? 0}\``;
  });

  const embed = baseEmbed()
    .setColor(COLORS.gold)
    .setTitle('Рівні ролей')
    .setDescription(lines.join('\n') || 'Порожньо.')
    .setFooter({ text: 'Видається найвищий рівень, вимоги якого виконано' });

  const componentRows = [];

  if (tiers.length) {
    componentRows.push(selectRow({
      id: cid(NS.ADMIN, 'tierPick'),
      placeholder: 'Редагувати рівень…',
      options: tiers.map((t) => ({
        value: t.key,
        label: t.name.slice(0, 100),
        description: t.roleId ? `priority ${t.priority ?? 0}` : 'роль не привʼязана',
      })),
    }));
  }

  componentRows.push(...rows([
    button({ id: cid(NS.ADMIN, 'tierAdd'), label: 'Додати рівень', emoji: '➕', style: ButtonStyle.Success }),
    button({ id: cid(NS.ADMIN, 'home'), label: 'Назад', emoji: '↩️' }),
  ]));

  return { embeds: [embed], components: componentRows.slice(0, 5) };
}

/** Панель конкретного рівня: роль, вимоги, пріоритет — усе без JSON. */
export function tierDetail(guild, key) {
  const tier = verificationService.tiers(guild.id).find((t) => t.key === key);
  if (!tier) return tiersPanel(guild);

  const LABELS = {
    minScore: 'Рейтинг', minTrust: 'Довіра', minCommunication: 'Комунікація',
    minHelpfulness: 'Допомога', minStability: 'Стабільність', minActivity: 'Активність',
    maxToxicity: 'Токсичність ≤', maxConflict: 'Конфліктність ≤', maxViolations: 'Порушення ≤',
    minDays: 'Днів на сервері', minMessages: 'Повідомлень', minActiveDays: 'Активних днів',
    minSamples: 'Оцінених повідомл.',
  };
  const req = Object.entries(tier.req ?? {}).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  const reqText = req.length
    ? req.map(([k, v]) => `${LABELS[k] ?? k}: **${v}**`).join(' · ')
    : 'без вимог';

  const embed = baseEmbed()
    .setColor(hexToInt(tier.color) ?? COLORS.gold)
    .setTitle(tier.name)
    .addFields(
      { name: 'Роль', value: tier.roleId ? `<@&${tier.roleId}>` : '`не обрано`', inline: true },
      { name: 'Пріоритет', value: `\`${tier.priority ?? 0}\``, inline: true },
      { name: 'Вимоги', value: reqText.slice(0, 1000) },
    );

  return {
    embeds: [embed],
    components: [
      roleSelectRow({ id: cid(NS.ADMIN, 'tierRole', key), placeholder: 'Обрати роль для цього рівня…' }),
      ...rows([
        button({ id: cid(NS.ADMIN, 'tierName', key), label: 'Назва / пріоритет', emoji: '✏️', style: ButtonStyle.Primary }),
        button({ id: cid(NS.ADMIN, 'tierReq', key, 'core'), label: 'Вимоги: активність', emoji: '📈' }),
        button({ id: cid(NS.ADMIN, 'tierReq', key, 'behavior'), label: 'Вимоги: поведінка', emoji: '🛡️' }),
      ]),
      ...rows([
        button({ id: cid(NS.ADMIN, 'tierUp', key), label: 'Пріоритет +', emoji: '⬆️' }),
        button({ id: cid(NS.ADMIN, 'tierDown', key), label: 'Пріоритет −', emoji: '⬇️' }),
        button({ id: cid(NS.ADMIN, 'tierDelete', key), label: 'Видалити', emoji: '🗑️', style: ButtonStyle.Danger }),
        button({ id: cid(NS.ADMIN, 'tiers'), label: 'Назад', emoji: '↩️' }),
      ]),
    ],
  };
}

function hexToInt(hex) {
  if (!hex) return null;
  const n = parseInt(String(hex).replace('#', ''), 16);
  return Number.isFinite(n) ? n : null;
}

/** Керування сайтом: адреса, сторінки, кастомний CSS — усе з Turso. */
export async function sitePanel(guild) {
  const { sitePagesRepo, siteAssetsRepo } = await import('../database/repositories.js');
  const pages = await sitePagesRepo.list(guild.id, false).catch(() => []);
  const assets = await siteAssetsRepo.list(guild.id).catch(() => []);
  const url = process.env.WEB_PUBLIC_URL || `порт ${process.env.SERVER_PORT || process.env.WEB_PORT || 8080}`;

  const embed = baseEmbed()
    .setColor(COLORS.primary)
    .setTitle('🌐 Сайт спільноти')
    .setDescription(`Адреса: \`${url}\``)
    .addFields(
      {
        name: 'Сторінки',
        value: pages.length
          ? pages.map((p) => `${p.published ? '🟢' : '⚪'} \`/${p.slug}\` — ${p.title}`).join('\n')
          : '`немає`',
      },
      {
        name: 'Файли (CSS, лого)',
        value: assets.length ? assets.map((a) => `\`${a.path}\``).join(' · ') : '`немає`',
      },
    );

  const componentRows = [];
  if (pages.length) {
    componentRows.push(selectRow({
      id: cid(NS.ADMIN, 'pagePick'),
      placeholder: 'Редагувати сторінку…',
      options: pages.map((p) => ({
        value: p.slug,
        label: p.title.slice(0, 100),
        description: `/${p.slug}${p.published ? '' : ' (чернетка)'}`,
      })),
    }));
  }
  componentRows.push(...rows([
    button({ id: cid(NS.ADMIN, 'pageAdd'), label: 'Нова сторінка', emoji: '➕', style: ButtonStyle.Success }),
    button({ id: cid(NS.ADMIN, 'cssEdit'), label: 'Кастомний CSS', emoji: '🎨' }),
    button({ id: cid(NS.ADMIN, 'home'), label: 'Назад', emoji: '↩️' }),
  ]));

  return { embeds: [embed], components: componentRows.slice(0, 5) };
}

/** Список полів обраної групи конфігурації. */
export function adminGroup(guild, group) {
  const cfg = configService.all(guild.id);
  const fields = configService.groups()[group] ?? [];

  const embed = baseEmbed()
    .setColor(COLORS.neutral)
    .setTitle(GROUP_LABELS[group] ?? group)
    .setDescription(fields.map((f) => {
      const val = cfg[f.key];
      const shown = typeof val === 'object' ? '`{…}`' : `\`${val === '' ? '—' : val}\``;
      return `**${f.label}** → ${shown}`;
    }).join('\n') || '—');

  // Канали обираємо нативним селектором — вписувати ID руками незручно.
  // Кожен селектор займає окремий рядок, тому беремо максимум три.
  const channelFields = fields.filter((f) => f.type === 'channel').slice(0, 3);
  const channelRows = channelFields.map((f) => channelSelectRow({
    id: cid(NS.ADMIN, 'setChannel', f.key),
    placeholder: short(f.label),
    types: f.key.startsWith('cinema.')
      ? [ChannelType.GuildVoice, ChannelType.GuildStageVoice]
      : undefined,
  }));

  const editButtons = fields
    .filter((f) => f.key !== 'verification.tiers' && !channelFields.includes(f))
    .slice(0, 20)
    .map((f) => button({ id: cid(NS.ADMIN, 'edit', f.key), label: short(f.label) }));

  const componentRows = [...channelRows, ...rows(editButtons)];
  componentRows.push(rows([button({ id: cid(NS.ADMIN, 'home'), label: 'Назад', emoji: '↩️' })])[0]);
  return { embeds: [embed], components: componentRows.slice(0, 5) };
}

/** Developer Panel. */
export async function devPanel(guild) {
  const embed = baseEmbed()
    .setColor(COLORS.danger)
    .setTitle('Dev')
    .addFields(
      { name: 'Черга', value: `\`${bgQueue.pending}\``, inline: true },
      { name: 'RSS', value: `\`${(process.memoryUsage().rss / 1048576).toFixed(0)} MB\``, inline: true },
      { name: 'Uptime', value: `\`${Math.floor(process.uptime() / 60)} хв\``, inline: true },
    );

  return {
    embeds: [embed],
    components: rows([
      button({ id: cid(NS.DEV, 'recalcAll'), label: 'Перерахувати', emoji: '♻️', style: ButtonStyle.Primary }),
      button({ id: cid(NS.DEV, 'snapshotAll'), label: 'Знімок', emoji: '📸' }),
      button({ id: cid(NS.DEV, 'backup'), label: 'Бекап', emoji: '💾' }),
      button({ id: cid(NS.ADMIN, 'home'), label: 'Назад', emoji: '↩️' }),
    ]),
  };
}

function short(label) {
  return label.length > 22 ? `${label.slice(0, 20)}…` : label;
}
