import { Events, AuditLogEvent } from 'discord.js';
import { routeInteraction } from './router.js';
import { trackingService } from '../services/trackingService.js';
import { pipeline } from '../services/analysisPipeline.js';
import { usersRepo, modRepo } from '../database/repositories.js';
import { configService } from '../services/configService.js';
import { reputationService } from '../services/reputationService.js';
import { setupPanel } from '../ui/adminPanel.js';
import { offerPublish, removeByMessage } from '../services/galleryWatcher.js';
import { punishmentService } from '../services/punishmentService.js';
import { staffWatch } from '../services/staffWatch.js';
import { caches } from '../core/cache.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('events');

/** Реєстрація всіх gateway-обробників. */
export function registerEvents(client) {
  pipeline.attach(client);

  client.on(Events.InteractionCreate, routeInteraction);

  // ── Повідомлення ──────────────────────────
  client.on(Events.MessageCreate, (message) => {
    if (!message.guild || message.author.bot) return;
    trackingService.message(message.guild.id, message).catch((e) => log.warn('track.message', e.message));
    // медіа в каналі галереї — питаємо автора, чи публікувати на сайті
    offerPublish(message).catch((e) => log.warn('gallery.offer', e.message));
    try {
      pipeline.enqueue(message.guild.id, message);
    } catch (err) {
      log.warn('pipeline.enqueue впав', err.message);
    }
  });

  client.on(Events.MessageDelete, (message) => {
    if (!message.guild) return;
    // публікацію прибрали в Discord — прибираємо й із сайту
    removeByMessage(message).catch(() => {});
    if (message.author?.bot) return;
    trackingService.messageDeleted(message.guild.id, message.author?.id).catch(() => {});
  });

  // ── Реакції ───────────────────────────────
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    try {
      if (reaction.partial) await reaction.fetch();
      const guildId = reaction.message.guildId;
      if (!guildId) return;
      await trackingService.reactionGiven(guildId, user.id);
      await trackingService.reactionReceived(guildId, reaction.message.author?.id, user.id);
    } catch { /* ignore */ }
  });

  // ── Голосові канали ───────────────────────
  const voiceJoin = new Map();
  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const userId = newState.id;
    const guildId = newState.guild.id;
    const key = `${guildId}:${userId}`;
    if (!oldState.channelId && newState.channelId) {
      voiceJoin.set(key, Date.now());
    } else if (oldState.channelId && !newState.channelId) {
      const start = voiceJoin.get(key);
      if (start) {
        const minutes = Math.floor((Date.now() - start) / 60_000);
        trackingService.voiceMinutes(guildId, userId, minutes).catch(() => {});
        voiceJoin.delete(key);
      }
    }
  });

  // ── Учасники ──────────────────────────────
  client.on(Events.GuildMemberAdd, (member) => {
    // Боти не учасники спільноти: без цього вони потрапляли б у рейтинг,
    // у вибір для голосування та в усі підрахунки на сайті.
    if (member.user?.bot) return;
    usersRepo.ensure(member.guild.id, member.id, member.user.username, member.joinedTimestamp).catch(() => {});
  });

  // Новий канал — одразу розставляємо в ньому заборони мутів,
  // інакше покараний зміг би писати саме там.
  client.on(Events.ChannelCreate, async (channel) => {
    if (!channel.guild) return;
    for (const kind of ['text', 'voice']) {
      const roleId = configService.get(channel.guild.id, `moderation.${kind}MuteRoleId`);
      const role = roleId ? channel.guild.roles.cache.get(roleId) : null;
      if (!role) continue;
      await punishmentService.syncOverwrites(channel.guild, role, kind, channel).catch(() => {});
    }
  });

  client.on(Events.GuildCreate, (guild) => {
    postSetupPanel(client, guild);
  });

  // ── Облік нативних дій персоналу ──────────
  // Ролі з правами Discord працюють повз бота, але слід лишається в журналі
  // аудиту. Звідси беремо і покарання учасників (для метрики «Порушення»),
  // і самі дії модераторів (для нагляду за зловживанням правами).
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    try {
      const executorId = entry.executorId ?? 'unknown';

      // 0) покарання зняли прямо в Discord — повертаємо й попереджаємо
      for (const kind of readLift(entry, guild)) {
        await staffWatch.unauthorizedLift(guild, {
          moderatorId: executorId, targetId: entry.targetId, kind,
        }).catch((e) => log.warn('відкат зняття впав', e.message));
      }

      const seen = readAudit(entry);
      if (!seen) return;
      const { action, punishment, count } = seen;
      const targetId = entry.targetId ?? null;

      // 1) покарання учасника — у журнал і в репутацію
      if (punishment && targetId) {
        await usersRepo.ensure(guild.id, targetId, null, null);
        await modRepo.add({
          guildId: guild.id,
          userId: targetId,
          moderatorId: executorId,
          action: punishment,
          reason: entry.reason ?? null,
          result: 'applied',
        });
        await reputationService.recompute(guild.id, targetId);
        caches.profile.delete(`${guild.id}:${targetId}`);
        log.info(`Зафіксовано покарання ${punishment} для ${targetId}`);
      }

      // 2) сама дія — на рахунок модератора; забагато за раз → авто-попередження
      const flagged = await staffWatch.record(guild, {
        moderatorId: executorId, targetId, action, count,
      });
      if (flagged) log.info(`Персонал ${executorId}: ${flagged.reason}`);
    } catch (err) {
      log.warn('audit log обробка впала', err.message);
    }
  });

  log.info('Обробники подій зареєстровано.');
}

/**
 * Розібрати запис журналу аудиту.
 *
 * @returns {null|{action:string, punishment:string|null, count:number}}
 *   action     — що зробив модератор (для нагляду);
 *   punishment — чи це покарання учасника (для журналу й репутації).
 */
function readAudit(entry) {
  const A = AuditLogEvent;
  const count = Number(entry.extra?.count ?? 1) || 1;

  switch (entry.action) {
    case A.MemberKick:
      return { action: 'kick', punishment: 'kick', count: 1 };
    case A.MemberBanAdd:
      return { action: 'ban', punishment: 'ban', count: 1 };
    case A.MemberDisconnect:
      // Discord не каже, кого саме відключили — лише скільки людей
      return { action: 'voice.disconnect', punishment: null, count };
    case A.MemberMove:
      return { action: 'voice.move', punishment: null, count };
    case A.MessageBulkDelete:
      return { action: 'message.bulkDelete', punishment: null, count };
    case A.MemberUpdate: {
      // тайм-аут, серверний мут і оглушення приходять як зміни полів учасника
      const ch = (key) => entry.changes?.find((c) => c.key === key);
      const t = ch('communication_disabled_until');
      if (t?.new) return { action: 'timeout', punishment: 'timeout', count: 1 };
      const mute = ch('mute');
      if (mute?.new === true) return { action: 'voice.mute', punishment: null, count: 1 };
      const deaf = ch('deaf');
      if (deaf?.new === true) return { action: 'voice.deafen', punishment: null, count: 1 };
      return null;
    }
    default:
      return null;
  }
}

/**
 * Які покарання бота зняли прямо в Discord, повз панель.
 *
 * Timeout видно як обнулення `communication_disabled_until`, службові мути —
 * як зняття ролі. Хто зняв, ми беремо з того самого запису.
 *
 * @returns {string[]} види покарань: full | text | voice
 */
function readLift(entry, guild) {
  const out = [];

  if (entry.action === AuditLogEvent.MemberUpdate) {
    const t = entry.changes?.find((c) => c.key === 'communication_disabled_until');
    if (t && (t.new == null || new Date(t.new).getTime() <= Date.now())) out.push('full');
  }

  if (entry.action === AuditLogEvent.MemberRoleUpdate) {
    const removed = entry.changes?.find((c) => c.key === '$remove')?.new ?? [];
    for (const kind of ['text', 'voice']) {
      const roleId = configService.get(guild.id, `moderation.${kind}MuteRoleId`);
      if (roleId && removed.some((r) => (r?.id ?? r) === roleId)) out.push(kind);
    }
  }

  return out;
}

/** Надіслати первинне налаштування, якщо канал панелі ще не привʼязано. */
export async function postSetupPanel(client, guild) {
  try {
    await configService.load(guild.id);
    if (configService.get(guild.id, 'general.statsChannelId')) return;

    const me = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
    const canSend = (ch) =>
      ch?.isTextBased?.() && (!me || ch.permissionsFor(me)?.has(['ViewChannel', 'SendMessages']));

    let channel = guild.systemChannel && canSend(guild.systemChannel) ? guild.systemChannel : null;
    if (!channel) channel = guild.channels.cache.find((c) => canSend(c));
    if (!channel) {
      log.warn(`Немає доступного каналу для налаштування у «${guild.name}».`);
      return;
    }

    await channel.send(setupPanel(guild));
    log.info(`Налаштування надіслано у «${guild.name}» → #${channel.name}.`);
  } catch (err) {
    log.warn('postSetupPanel впав', err.message);
  }
}
