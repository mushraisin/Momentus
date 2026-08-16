import { ButtonStyle } from 'discord.js';
import { NS, ACCESS } from '../config/constants.js';
import { button, cid, rows, selectRow, userSelectRow } from './components.js';
import { baseEmbed } from './embeds.js';
import { COLORS } from './theme.js';
import { punishmentService, KIND_LABEL, WARN_LIMIT } from '../services/punishmentService.js';
import { modRepo } from '../database/repositories.js';
import { accessService } from '../services/accessService.js';
import { staffWatch } from '../services/staffWatch.js';

/** Готові терміни — щоб не вписувати число щоразу. */
export const DURATIONS = [
  { value: '10', label: '10 хвилин' },
  { value: '60', label: 'година' },
  { value: '360', label: '6 годин' },
  { value: '1440', label: 'доба' },
  { value: '10080', label: 'тиждень' },
  { value: '0', label: 'назавжди (до зняття)' },
];

const KIND_EMOJI = { text: '💬', voice: '🔊', full: '⛔' };

/** Головний екран: обираємо, кого модеруємо. */
export function modHome(guild, member) {
  const level = accessService.level(member);
  const limit = punishmentService.limitMinutes(guild.id, level);

  const embed = baseEmbed()
    .setColor(COLORS.warn ?? COLORS.neutral)
    .setTitle('🛡️ Модерація')
    .setDescription('Панель модерації.')
    .addFields({
      name: 'Ваш ліміт',
      value: limit ? `до ${fmtMinutes(limit)}` : 'без обмежень',
      inline: true,
    });

  return {
    embeds: [embed],
    components: [
      userSelectRow({ id: cid(NS.MOD, 'pick'), placeholder: 'Кого модеруємо…' }),
      ...rows([
        button({ id: cid(NS.MOD, 'active'), label: 'Чинні покарання', emoji: '📋' }),
        // це вікно бачить лише той, хто його відкрив, тож «назад» тут не потрібне
        button({ id: cid(NS.MOD, 'close'), label: 'Закрити', emoji: '✖️' }),
      ]),
    ],
  };
}

/** Картка учасника: чинні покарання, історія й дії. */
export async function modTarget(guild, targetId, member) {
  const level = accessService.level(member);
  const target = guild.members.cache.get(targetId) ?? await guild.members.fetch(targetId).catch(() => null);
  const active = await punishmentService.forUser(guild.id, targetId);
  const warns = await punishmentService.warnings(guild.id, targetId);
  const history = await modRepo.history(guild.id, targetId, 5);

  const embed = baseEmbed()
    .setColor(active.length ? COLORS.danger : COLORS.neutral)
    .setTitle(target?.displayName ?? targetId)
    .setThumbnail(target?.user?.displayAvatarURL({ extension: 'png', size: 128 }) ?? null);

  embed.addFields({
    name: 'Зараз діє',
    value: active.length
      ? active.map((p) => `${KIND_EMOJI[p.kind]} ${KIND_LABEL[p.kind]} — ${untilText(p.until)}`).join('\n')
      : 'нічого',
  });

  // попередження живуть 72 години й згасають самі
  embed.addFields({
    name: `Попередження ${warns.length}/${WARN_LIMIT}`,
    value: warns.length
      ? warns.map((w, i) => `**${i + 1}.** ${w.reason ? `${String(w.reason).slice(0, 50)} · ` : ''}згасне ${untilText(w.expiresAt)}`).join('\n')
      : 'немає',
  });

  // якщо людина сама щось модерувала нативними правами — показуємо її рахунок
  const staff = await staffWatch.score(guild.id, targetId).catch(() => null);
  if (staff?.actions) {
    embed.addFields({
      name: 'Дії з правами Discord',
      value: `${staff.actions} за вікно нагляду · вага ${staff.score}/${staff.limit}`,
      inline: true,
    });
  }

  if (history.length) {
    embed.addFields({
      name: 'Останні дії',
      value: history.map((h) => {
        const when = new Date(Number(h.created_at)).toLocaleDateString('uk-UA');
        const who = h.moderator_id === 'system' ? 'система' : `<@${h.moderator_id}>`;
        return `\`${when}\` ${h.action}${h.reason ? ` — ${String(h.reason).slice(0, 60)}` : ''} · ${who}`;
      }).join('\n').slice(0, 1000),
    });
  }

  // Кік і бан доступні за налаштуванням; модератору їх можна закрити.
  const canKick = level >= ACCESS.ADMIN || accessService.level(member) >= ACCESS.MODERATOR;

  return {
    embeds: [embed],
    components: [
      ...rows([
        button({ id: cid(NS.MOD, 'ask', targetId, 'text'), label: 'Текст', emoji: '💬' }),
        button({ id: cid(NS.MOD, 'ask', targetId, 'voice'), label: 'Голос', emoji: '🔊' }),
        button({ id: cid(NS.MOD, 'ask', targetId, 'full'), label: 'Повний', emoji: '⛔', style: ButtonStyle.Danger }),
        button({
          id: cid(NS.MOD, 'lift', targetId, 'all'),
          label: 'Зняти все',
          emoji: '✅',
          style: ButtonStyle.Success,
          disabled: !active.length,
        }),
      ]),
      ...rows([
        button({ id: cid(NS.MOD, 'warn', targetId), label: 'Попередження', emoji: '⚠️' }),
        button({
          id: cid(NS.MOD, 'unwarn', targetId, 'one'),
          label: 'Зняти одне',
          emoji: '➖',
          disabled: !warns.length,
        }),
        button({
          id: cid(NS.MOD, 'unwarn', targetId, 'all'),
          label: 'Зняти всі',
          emoji: '🧹',
          disabled: !warns.length,
        }),
        button({ id: cid(NS.MOD, 'kick', targetId), label: 'Кік', emoji: '👢', disabled: !canKick }),
        button({ id: cid(NS.MOD, 'home'), label: 'Назад', emoji: '↩️' }),
      ]),
    ],
  };
}

/** Другий крок: на скільки. */
export function modDuration(guild, targetId, kind, member) {
  const level = accessService.level(member);
  const limit = punishmentService.limitMinutes(guild.id, level);

  const options = [
    ...DURATIONS
      .filter((d) => punishmentService.withinLimit(guild.id, level, Number(d.value)))
      .map((d) => ({ value: d.value, label: d.label })),
    // своє значення: відкриє вікно, де можна вписати «90хв», «3год», «2д»
    { value: 'custom', label: 'Свій час…' },
  ];

  const embed = baseEmbed()
    .setColor(COLORS.neutral)
    .setTitle(`${KIND_EMOJI[kind]} ${cap(KIND_LABEL[kind])}`)
    .setDescription(`Кому: <@${targetId}>\nОберіть термін — далі попросимо причину.`)
    .setFooter({ text: limit ? `Ваш ліміт: до ${fmtMinutes(limit)}` : 'Без обмежень' });

  return {
    embeds: [embed],
    components: [
      selectRow({
        id: cid(NS.MOD, 'dur', targetId, kind),
        placeholder: 'Термін…',
        options,
      }),
      ...rows([button({ id: cid(NS.MOD, 'pickAgain', targetId), label: 'Назад', emoji: '↩️' })]),
    ],
  };
}

/** Список усіх, хто зараз під покаранням. */
export async function modActive(guild) {
  const list = await punishmentService.forGuild(guild.id);
  const embed = baseEmbed()
    .setColor(COLORS.neutral)
    .setTitle('📋 Чинні покарання')
    .setDescription(list.length
      ? list.map((p) => `${KIND_EMOJI[p.kind]} <@${p.userId}> — ${KIND_LABEL[p.kind]}, ${untilText(p.until)}`)
        .join('\n').slice(0, 3800)
      : 'Зараз нікого не покарано.');

  return {
    embeds: [embed],
    components: rows([button({ id: cid(NS.MOD, 'home'), label: 'Назад', emoji: '↩️' })]),
  };
}

// ─────────────────────────────────────────────
function untilText(until) {
  if (!until) return 'до зняття';
  const left = until - Date.now();
  if (left <= 0) return 'ось-ось спаде';
  return `ще ${fmtMinutes(Math.round(left / 60_000))}`;
}

export function fmtMinutes(m) {
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440} дн.`;
  if (m >= 60 && m % 60 === 0) return `${m / 60} год`;
  return `${m} хв`;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
