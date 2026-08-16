import { PermissionFlagsBits, ChannelType } from 'discord.js';
import { punishRepo, modRepo, warnRepo, reputationRepo } from '../database/repositories.js';
import { reputationService } from './reputationService.js';
import { configService } from './configService.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('mod');

/**
 * Три різні покарання, бо «мут» буває різний:
 *
 *   text  — не пише в текстових каналах (у тому числі в чатах голосових),
 *           але сидіти в голосовому й говорити може;
 *   voice — не говорить у голосових, але лишається в каналі й пише;
 *   full  — рідний timeout Discord: ні писати, ні говорити, ні бути в голосовому.
 *
 * Перші два тримаються на службових ролях із забороною прав по каналах —
 * їх бот створює сам і сам розставляє при появі нових каналів.
 */
export const MUTE_KINDS = ['text', 'voice', 'full'];

const ROLE_NAMES = {
  text: 'Мут: текст',
  voice: 'Мут: голос',
};

const CFG_KEY = { text: 'moderation.textMuteRoleId', voice: 'moderation.voiceMuteRoleId' };

/** Discord не дає timeout довше 28 діб. */
const MAX_TIMEOUT_MS = 28 * 86400_000;

export const punishmentService = {
  /**
   * Скільки хвилин може видати цей рівень доступу.
   * 0 — без обмежень.
   */
  limitMinutes(guildId, level) {
    const cfg = configService.all(guildId);
    if (level >= 3) return 0;                                   // власник
    if (level >= 2) return Number(cfg['moderation.maxMinutesAdmin'] ?? 0);
    return Number(cfg['moderation.maxMinutesModerator'] ?? 1440);
  },

  /** Чи вкладається запит у ліміт рівня. */
  withinLimit(guildId, level, minutes) {
    const max = this.limitMinutes(guildId, level);
    if (!max) return true;
    if (!minutes) return false;                                 // «назавжди» — лише без обмежень
    return minutes <= max;
  },

  /**
   * Роль для мутів. Створюємо один раз і запам'ятовуємо в конфізі,
   * права по каналах розставляємо тут же.
   */
  async ensureRole(guild, kind) {
    const key = CFG_KEY[kind];
    if (!key) return null;

    const savedId = configService.get(guild.id, key);
    let role = savedId ? guild.roles.cache.get(savedId) : null;

    if (!role) {
      role = guild.roles.cache.find((r) => r.name === ROLE_NAMES[kind]) ?? null;
    }
    if (!role) {
      role = await guild.roles.create({
        name: ROLE_NAMES[kind],
        color: 0x4a4f5c,
        permissions: [],
        mentionable: false,
        reason: 'Службова роль для мутів',
      });
      log.info(`Створено роль «${role.name}»`);
    }
    if (role.id !== savedId) await configService.set(guild.id, key, role.id);

    await this.syncOverwrites(guild, role, kind).catch((e) => log.warn('overwrites', e.message));
    return role;
  },

  /** Розставити заборони по всіх каналах (і по нових теж — через подію). */
  async syncOverwrites(guild, role, kind, only = null) {
    const channels = only ? [only] : [...guild.channels.cache.values()];

    for (const ch of channels) {
      const isVoice = ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice;
      const isText = ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildForum
        || ch.type === ChannelType.GuildAnnouncement;
      if (!isVoice && !isText) continue;

      const deny = {};
      if (kind === 'text') {
        // писати не можна ніде — включно з чатом усередині голосового каналу
        deny[PermissionFlagsBits.SendMessages] = false;
        deny[PermissionFlagsBits.SendMessagesInThreads] = false;
        deny[PermissionFlagsBits.CreatePublicThreads] = false;
        deny[PermissionFlagsBits.CreatePrivateThreads] = false;
        deny[PermissionFlagsBits.AddReactions] = false;
      } else if (isVoice) {
        // голос забираємо, присутність і текст лишаємо
        deny[PermissionFlagsBits.Speak] = false;
        deny[PermissionFlagsBits.Stream] = false;
        deny[PermissionFlagsBits.RequestToSpeak] = false;
      } else {
        continue;
      }

      const current = ch.permissionOverwrites?.cache?.get(role.id);
      if (current) continue;                                     // вже стоїть
      await ch.permissionOverwrites.create(role, deny, { reason: 'Мут' }).catch(() => {});
    }
  },

  /**
   * Видати покарання.
   * @param {object} opts kind: text|voice|full, minutes: 0 — назавжди
   */
  async apply(guild, member, { kind, minutes, reason, moderatorId }) {
    const until = minutes ? Date.now() + minutes * 60_000 : null;

    if (kind === 'full') {
      // рідний timeout: сам знімається, сам виганяє з голосового
      const ms = Math.min(minutes ? minutes * 60_000 : MAX_TIMEOUT_MS, MAX_TIMEOUT_MS);
      await member.timeout(ms, reason ?? 'Без причини');
    } else {
      const role = await this.ensureRole(guild, kind);
      if (!role) throw new Error('не вдалося підготувати роль');
      await member.roles.add(role, reason ?? 'Мут');
      // голосовий мут діє одразу, лише якщо оновити стан у каналі
      if (kind === 'voice' && member.voice?.channelId) {
        await member.voice.setMute(true, reason ?? 'Мут').catch(() => {});
      }
    }

    await punishRepo.set({
      guildId: guild.id, userId: member.id, kind, until, reason, moderatorId,
    });
    // Будь-яке покарання анулює попередження — зокрема й мут за 3/3,
    // інакше людина вийшла б із мута й одразу отримала наступний.
    await warnRepo.clear(guild.id, member.id).catch(() => {});
    // Порушення впливають на репутацію, тож перераховуємо одразу.
    await reputationService.recompute(guild.id, member.id).catch(() => {});
    await modRepo.add({
      guildId: guild.id,
      userId: member.id,
      moderatorId,
      action: `mute.${kind}`,
      reason,
      durationMs: minutes ? minutes * 60_000 : null,
      result: 'applied',
    });

    return { kind, until };
  },

  /** Зняти покарання (одне або всі). */
  async lift(guild, userId, kind, moderatorId = 'system') {
    const member = guild.members.cache.get(userId)
      ?? await guild.members.fetch(userId).catch(() => null);

    const kinds = kind === 'all' ? MUTE_KINDS : [kind];
    for (const k of kinds) {
      if (member) {
        if (k === 'full') {
          await member.timeout(null).catch(() => {});
        } else {
          const roleId = configService.get(guild.id, CFG_KEY[k]);
          if (roleId && member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId, 'Знято мут').catch(() => {});
          }
          if (k === 'voice' && member.voice?.channelId) {
            await member.voice.setMute(false, 'Знято мут').catch(() => {});
          }
        }
      }
      await punishRepo.remove(guild.id, userId, k);
    }

    await modRepo.add({
      guildId: guild.id, userId, moderatorId, action: 'unmute', result: 'applied',
    }).catch(() => {});
    return true;
  },

  /** Зняти все, чий час вийшов. Викликає планувальник. */
  async liftExpired(client) {
    const due = await punishRepo.expired().catch(() => []);
    for (const p of due) {
      const guild = client.guilds.cache.get(p.guildId);
      if (!guild) {
        await punishRepo.remove(p.guildId, p.userId, p.kind);
        continue;
      }
      await this.lift(guild, p.userId, p.kind, 'system').catch(() => {});
      log.info(`Час вийшов: знято ${p.kind} з ${p.userId}`);
    }
    return due.length;
  },

  /** Чинні покарання учасника. */
  forUser(guildId, userId) {
    return punishRepo.forUser(guildId, userId);
  },

  /** Чинні попередження (згаслі не рахуються). */
  warnings(guildId, userId) {
    return warnRepo.active(guildId, userId);
  },

  /**
   * Видати попередження. Три чинні одночасно — і людина автоматично
   * отримує повний мут, після якого список обнуляється.
   *
   * @returns {Promise<{count:number, auto:null|{minutes:number}}>}
   */
  async warn(guild, member, { reason, moderatorId }) {
    await warnRepo.add(guild.id, member.id, { reason, moderatorId });
    await modRepo.add({
      guildId: guild.id, userId: member.id, moderatorId,
      action: 'warn', reason, result: 'applied',
    });

    const active = await warnRepo.active(guild.id, member.id);
    if (active.length < WARN_LIMIT) return { count: active.length, auto: null };

    // поріг досягнуто — рахуємо строк і застосовуємо
    const minutes = await autoMuteMinutes(guild, member.id, active);
    await this.apply(guild, member, {
      kind: 'full',
      minutes,
      reason: `${WARN_LIMIT}/${WARN_LIMIT} попереджень`,
      moderatorId: 'system',
    });
    return { count: active.length, auto: { minutes } };
  },

  /** Зняти попередження вручну: одне або всі. */
  async liftWarn(guildId, userId, { all = false, id = null } = {}) {
    if (all) await warnRepo.clear(guildId, userId);
    else await warnRepo.removeOne(guildId, userId, id);

    const left = await warnRepo.active(guildId, userId);
    await modRepo.add({
      guildId, userId, moderatorId: 'system',
      action: 'warn.lift', result: 'applied',
      note: all ? 'усі' : 'одне',
    }).catch(() => {});
    return left.length;
  },

  /** Усі чинні покарання гільдії. */
  forGuild(guildId, limit = 50) {
    return punishRepo.active(guildId, limit);
  },

  /**
   * Сповіщення: лог-канал і ЛС покараному. Помилки тут не критичні —
   * покарання вже застосоване, а лист міг і не дійти.
   */
  async notify(guild, { target, moderator, kind, minutes, reason, note = null, lifted = false }) {
    const label = KIND_LABEL[kind] ?? kind;
    const warnLike = kind === 'warn';
    const color = lifted ? 0x43c47b : (warnLike ? 0xf0a742 : 0xef5350);
    const icon = lifted ? '✅' : (warnLike ? '⚠️' : '⛔');
    // у попередження строку немає — воно просто згасає за 72 години
    const term = lifted || warnLike ? '' : (minutes ? `на ${fmtMin(minutes)}` : 'до зняття');
    // без пояснень у дужках: або згадка людини, або просто «Система»
    const by = moderator === 'system' ? 'Система' : `<@${moderator}>`;

    const logId = configService.get(guild.id, 'general.modLogChannelId');
    if (logId) {
      const ch = guild.channels.cache.get(logId);
      if (ch?.isTextBased?.()) {
        await ch.send({
          embeds: [{
            color,
            title: lifted ? '✅ Покарання знято' : `${icon} ${cap(label)}`,
            description: [
              `**Кому:** <@${target.id}>`,
              `**Хто:** ${by}`,
              term ? `**Термін:** ${term}` : null,
              warnLike && !lifted ? '**Згасне:** через 72 год' : null,
              `**Причина:** ${reason || '—'}`,
              note ? `**Деталі:** ${note}` : null,
            ].filter(Boolean).join('\n'),
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});
      }
    }

    if (!lifted && configService.get(guild.id, 'moderation.dmOnPunish')) {
      await target.send({
        embeds: [{
          color,
          title: `${cap(label)} на сервері ${guild.name}`,
          description: [
            term ? `**Термін:** ${term}` : null,
            warnLike ? 'Попередження згасне саме через 72 години.' : null,
            `**Причина:** ${reason || 'не вказана'}`,
            note ? `**Деталі:** ${note}` : null,
          ].filter(Boolean).join('\n'),
        }],
      }).catch(() => {});
    }
  },
};

/** Людські назви для журналу й повідомлень. */
export const KIND_LABEL = {
  text: 'текстовий мут',
  voice: 'голосовий мут',
  full: 'повний мут',
  warn: 'попередження',
  kick: 'виганяння з сервера',
  ban: 'бан',
};

/** Скільки чинних попереджень призводять до автоматичного мута. */
export const WARN_LIMIT = 3;

/**
 * Строк автоматичного мута: від години до дванадцяти.
 *
 * Враховуємо три речі:
 *   темп — три попередження за годину гірші, ніж три за три доби;
 *   історію — хто вже мав покарання, отримує довше;
 *   репутацію — низький рейтинг додає, високий пом'якшує.
 */
async function autoMuteMinutes(guild, userId, warns) {
  const MIN = 60;
  const MAX = 720;

  // темп: 0 — розтягнуто на всі 72 години, 1 — усі три поспіль
  const spanMs = (warns.at(-1)?.createdAt ?? Date.now()) - (warns[0]?.createdAt ?? Date.now());
  const pace = 1 - Math.min(1, spanMs / warnRepo.TTL_MS);

  // історія: рахуємо попередні покарання, окрім самих попереджень
  const past = await modRepo.history(guild.id, userId, 50).catch(() => []);
  const serious = past.filter((h) => /^(mute\.|kick|ban|timeout)/.test(String(h.action))).length;
  const history = Math.min(1, serious / 5);

  // репутація: чим нижча, тим суворіше
  let rep = 0.5;
  try {
    const row = await reputationRepo.get(guild.id, userId);
    if (row?.ai_score != null) rep = 1 - Math.min(1, Math.max(0, Number(row.ai_score) / 1000));
  } catch { /* немає даних — лишаємо середину */ }

  const weight = pace * 0.45 + history * 0.3 + rep * 0.25;
  const raw = MIN + weight * (MAX - MIN);
  return Math.min(MAX, Math.max(MIN, Math.round(raw / 15) * 15));   // кратно 15 хв
}

function fmtMin(m) {
  if (m >= 1440 && m % 1440 === 0) return `${m / 1440} дн.`;
  if (m >= 60 && m % 60 === 0) return `${m / 60} год`;
  return `${m} хв`;
}

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
