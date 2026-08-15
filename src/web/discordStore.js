import { createLogger } from '../core/logger.js';
import { configService } from '../services/configService.js';

const log = createLogger('media');

/**
 * Сховище медіа в самому Discord: бот заливає файл у прихований канал,
 * у БД лишається лише id повідомлення й посилання на вкладення.
 *
 * Чому так: обсяг фактично безлімітний і безкоштовний, вихідного трафіку
 * теж немає — на відміну від 10 GB у R2 чи роздутої Turso.
 *
 * Підступ: з кінця 2023 посилання на вкладення підписані (?ex=&is=&hm=)
 * і живуть близько доби. Тому зберігаємо час протухання і перед віддачею
 * перезапитуємо повідомлення, отримуючи свіже посилання.
 */
export const discordStore = {
  /** Канал-сховище налаштовано? */
  channelId(guildId) {
    return configService.get(guildId, 'media.channelId') || process.env.MEDIA_CHANNEL_ID || '';
  },

  configured(guildId) {
    return !!this.channelId(guildId);
  },

  /** Ліміт вкладення залежить від рівня бустів сервера. */
  uploadLimitMb(guild) {
    switch (guild?.premiumTier) {
      case 3: return 100;
      case 2: return 50;
      default: return 10;
    }
  },

  /**
   * Залити файл. @returns {Promise<{key:string,url:string,expires:number}>}
   */
  async put(guild, buffer, filename) {
    const id = this.channelId(guild.id);
    if (!id) throw new Error('канал-сховище не налаштовано');

    const channel = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
    if (!channel?.isTextBased?.()) throw new Error('канал-сховище недоступний');

    const msg = await channel.send({ files: [{ attachment: buffer, name: filename }] });
    const att = [...msg.attachments.values()][0];
    if (!att) throw new Error('вкладення не створилось');

    return { key: `${channel.id}/${msg.id}`, url: att.url, expires: expiryOf(att.url) };
  },

  /** Свіже посилання замість протухлого. */
  async refresh(guild, key) {
    const [channelId, messageId] = String(key ?? '').split('/');
    if (!channelId || !messageId) return null;

    const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased?.()) return null;

    const msg = await channel.messages.fetch(messageId).catch(() => null);
    const att = msg ? [...msg.attachments.values()][0] : null;
    if (!att) return null;

    return { url: att.url, expires: expiryOf(att.url) };
  },

  /** Видалити повідомлення разом із файлом. */
  async remove(guild, key) {
    const [channelId, messageId] = String(key ?? '').split('/');
    if (!channelId || !messageId) return false;
    try {
      const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
      const msg = await channel?.messages?.fetch(messageId).catch(() => null);
      await msg?.delete();
      return true;
    } catch (err) {
      log.warn('Не вдалося видалити медіа з каналу', err.message);
      return false;
    }
  },
};

/**
 * Час протухання підпису з параметра ?ex= (hex-секунди Unix).
 * Якщо параметра немає — вважаємо, що посилання живе годину.
 */
function expiryOf(url) {
  try {
    const ex = new URL(url).searchParams.get('ex');
    if (ex) return parseInt(ex, 16) * 1000;
  } catch { /* некоректний URL — нижче фолбек */ }
  return Date.now() + 3600_000;
}

/** Безпечне імʼя файлу для Discord. */
export function safeName(base, ext) {
  const clean = String(base ?? 'clip').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 40) || 'clip';
  return `${clean}.${ext}`;
}
