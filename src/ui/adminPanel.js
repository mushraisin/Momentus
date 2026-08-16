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

/**
 * Головна адмін-панель.
 *
 * Розділи — кнопками, а не списком: у списку кожен перехід коштує два кліки.
 * Зверху — стан найважливішого, щоб не лазити по розділах перевіряти,
 * чи все привʼязано.
 */
export async function adminHome(guild) {
  const memberCount = await usersRepo.count(guild.id);
  const tiers = verificationService.tiers(guild.id);
  const bound = tiers.filter((t) => t.roleId).length;
  const cfg = configService.all(guild.id);

  const chan = (id) => (id ? `<#${id}>` : '`—`');
  const roles = (ids) => (ids?.length ? ids.map((r) => `<@&${r}>`).join(' ') : '`—`');

  const embed = baseEmbed()
    .setColor(COLORS.primary)
    .setTitle('Адміністрування')
    .setDescription([
      `**Панель:** ${chan(cfg['general.statsChannelId'])}`,
      `**Галерея:** ${chan(cfg['gallery.channelId'])} · **сховище:** ${chan(cfg['media.channelId'])}`,
      `**Кінотеатр:** ${chan(cfg['cinema.voiceChannelId'])}`,
      `**Лог модерації:** ${chan(cfg['general.modLogChannelId'])}`,
      `**Модератори:** ${roles(cfg['access.moderatorRoleIds'])}`,
    ].join('\n'))
    .addFields(
      { name: 'Учасників', value: `\`${memberCount}\``, inline: true },
      { name: 'Рівні ролей', value: `\`${bound}/${tiers.length}\``, inline: true },
      { name: 'Мова', value: `\`${(cfg['general.locale'] ?? 'uk').toUpperCase()}\``, inline: true },
    );

  const sections = Object.entries(GROUP_LABELS);

  return {
    embeds: [embed],
    components: [
      // розділи — по одному кліку
      ...rows(sections.map(([value, label]) => button({
        id: cid(NS.ADMIN, 'group', value),
        label: label.replace(/^\S+\s/, ''),
        emoji: label.split(' ')[0],
      }))),
      ...rows([
        button({ id: cid(NS.MOD, 'home'), label: 'Модерація', emoji: '🛡️', style: ButtonStyle.Danger }),
        button({ id: cid(NS.ADMIN, 'tiers'), label: 'Рівні ролей', emoji: '🎖️', style: ButtonStyle.Primary }),
        button({ id: cid(NS.ADMIN, 'site'), label: 'Сайт', emoji: '🌐' }),
        button({ id: cid(NS.ADMIN, 'deploy'), label: 'Опублікувати', emoji: '📢' }),
        button({ id: cid(NS.DEV, 'open'), label: 'Dev', emoji: '🧬' }),
      ]),
    ].slice(0, 5),
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

/**
 * Розділ налаштувань.
 *
 * Кожен тип поля редагується тим, чим зручно, а не текстом:
 *   вимикачі — кнопка одразу перемикає (без «true/false» руками);
 *   канали й ролі — нативні селектори Discord;
 *   числа й рядки — вікно вводу.
 * Значення в описі показані по-людськи: ✅/❌, #канал, @роль, «1 день».
 */
export function adminGroup(guild, group, page = 0) {
  const cfg = configService.all(guild.id);
  const fields = (configService.groups()[group] ?? []).filter((f) => f.key !== 'verification.tiers');

  const embed = baseEmbed()
    .setColor(COLORS.neutral)
    .setTitle(GROUP_LABELS[group] ?? group)
    .setDescription(fields.map((f) => `**${f.label}** → ${showValue(f, cfg[f.key])}`).join('\n') || '—');

  // Селектори займають цілий рядок, тож лишаємо місце для кнопок і навігації.
  const pickers = fields.filter((f) => f.type === 'channel' || f.type === 'roles').slice(0, 2);
  const pickerRows = pickers.map((f) => (f.type === 'channel'
    ? channelSelectRow({
      id: cid(NS.ADMIN, 'setChannel', f.key),
      placeholder: short(f.label),
      types: f.key.startsWith('cinema.')
        ? [ChannelType.GuildVoice, ChannelType.GuildStageVoice]
        : undefined,
    })
    : roleSelectRow({ id: cid(NS.ADMIN, 'addRole', f.key), placeholder: short(f.label) })));

  // Решта — кнопками. Вимикач міняє значення одразу, інші відкривають вікно.
  const rest = fields.filter((f) => !pickers.includes(f));
  const perPage = (4 - pickerRows.length) * 5;                  // рядки під кнопки × 5
  const pages = Math.max(1, Math.ceil(rest.length / perPage));
  const p = Math.min(Math.max(0, page), pages - 1);

  const btns = rest.slice(p * perPage, (p + 1) * perPage).map((f) => {
    // мов лише дві — кнопка їх просто чергує, вікно вводу тут зайве
    if (f.key === 'general.locale') {
      const code = String(cfg[f.key] ?? 'uk').toUpperCase();
      return button({
        id: cid(NS.ADMIN, 'cycleLang', String(group), String(p)),
        label: `Мова: ${code}`,
        emoji: '🌐',
        style: ButtonStyle.Primary,
      });
    }
    if (f.type === 'bool') {
      const on = !!cfg[f.key];
      return button({
        id: cid(NS.ADMIN, 'toggle', f.key, String(group), String(p)),
        label: short(f.label),
        emoji: on ? '✅' : '❌',
        style: on ? ButtonStyle.Success : ButtonStyle.Secondary,
      });
    }
    return button({ id: cid(NS.ADMIN, 'edit', f.key), label: short(f.label), emoji: '✏️' });
  });

  const nav = [button({ id: cid(NS.ADMIN, 'home'), label: 'Назад', emoji: '↩️' })];
  if (pages > 1) {
    nav.push(
      button({ id: cid(NS.ADMIN, 'group', group, String(p - 1)), label: '‹', disabled: p === 0 }),
      button({ id: cid(NS.ADMIN, 'group', group, String(p + 1)), label: '›', disabled: p >= pages - 1 }),
    );
    embed.setFooter({ text: `Сторінка ${p + 1} з ${pages}` });
  }
  // очистити список ролей — інакше зняти видане нічим
  for (const f of pickers) {
    if (f.type === 'roles' && (cfg[f.key] ?? []).length) {
      nav.push(button({ id: cid(NS.ADMIN, 'clearRoles', f.key), label: 'Очистити', emoji: '🧹' }));
    }
  }

  return {
    embeds: [embed],
    components: [...pickerRows, ...rows(btns), ...rows(nav)].slice(0, 5),
  };
}

/** Значення налаштування людською мовою. */
function showValue(field, val) {
  if (field.type === 'bool') return val ? '✅ увімкнено' : '❌ вимкнено';
  if (field.type === 'channel') return val ? `<#${val}>` : '`—`';
  if (field.type === 'roles') return (val ?? []).length ? val.map((r) => `<@&${r}>`).join(' ') : '`—`';
  if (field.type === 'json') return '`{…}`';
  if (val === '' || val === null || val === undefined) return '`—`';
  // хвилини й мілісекунди показуємо зрозуміло; «Minutes» буває і в середині ключа
  if (/Minutes/i.test(field.key) && Number(val) > 0) return `\`${humanMinutes(Number(val))}\``;
  if (/Ms$/.test(field.key) && Number(val) > 0) return `\`${humanMinutes(Number(val) / 60_000)}\``;
  return `\`${val}\``;
}

function humanMinutes(m) {
  if (m >= 1440) return `${+(m / 1440).toFixed(1)} дн.`;
  if (m >= 60) return `${+(m / 60).toFixed(1)} год`;
  if (m >= 1) return `${Math.round(m)} хв`;
  return `${Math.round(m * 60)} с`;
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
