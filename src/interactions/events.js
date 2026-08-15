import { Events, AuditLogEvent } from 'discord.js';
import { routeInteraction } from './router.js';
import { trackingService } from '../services/trackingService.js';
import { pipeline } from '../services/analysisPipeline.js';
import { usersRepo, modRepo } from '../database/repositories.js';
import { configService } from '../services/configService.js';
import { reputationService } from '../services/reputationService.js';
import { setupPanel } from '../ui/adminPanel.js';
import { offerPublish, removeByMessage } from '../services/galleryWatcher.js';
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
    usersRepo.ensure(member.guild.id, member.id, member.user.username, member.joinedTimestamp).catch(() => {});
  });

  client.on(Events.GuildCreate, (guild) => {
    postSetupPanel(client, guild);
  });

  // ── Облік нативних покарань (для метрики «Порушення») ──
  // Слухаємо audit log: тайм-аути/кіки/бани, зроблені будь-яким модератором чи ботом.
  client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
    try {
      const map = {
        [AuditLogEvent.MemberKick]: 'kick',
        [AuditLogEvent.MemberBanAdd]: 'ban',
      };
      let action = map[entry.action];

      // тайм-аут приходить як оновлення учасника
      if (!action && entry.action === AuditLogEvent.MemberUpdate) {
        const t = entry.changes?.find((c) => c.key === 'communication_disabled_until');
        if (t?.new) action = 'timeout';
      }
      if (!action) return;

      const userId = entry.targetId;
      if (!userId) return;

      await usersRepo.ensure(guild.id, userId, null, null);
      await modRepo.add({
        guildId: guild.id,
        userId,
        moderatorId: entry.executorId ?? 'unknown',
        action,
        reason: entry.reason ?? null,
        result: 'applied',
      });
      await reputationService.recompute(guild.id, userId);
      caches.profile.delete(`${guild.id}:${userId}`);
      log.info(`Зафіксовано покарання ${action} для ${userId}`);
    } catch (err) {
      log.warn('audit log обробка впала', err.message);
    }
  });

  log.info('Обробники подій зареєстровано.');
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
