import { ButtonStyle } from 'discord.js';
import { button, cid, rows } from '../ui/components.js';
import { NS } from '../config/constants.js';
import { configService } from '../services/configService.js';
import { galleryRepo } from '../database/repositories.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('gallery');

/**
 * Галерея живе з одного Discord-каналу.
 *
 * Адміністратор вказує канал; щойно туди прилітає фото, GIF чи відео — бот
 * питає автора, чи публікувати це на сайті. Файл уже лежить у Discord, тож
 * нікуди не перезаливаємо: у базі зберігаємо лише посилання на вкладення,
 * а протухле посилання сайт оновлює сам.
 */
const KINDS = {
  image: /^image\/(png|jpe?g|webp|avif)$/i,
  gif: /^image\/gif$/i,
  video: /^video\/(mp4|webm|quicktime)$/i,
};

/** Канал-джерело галереї. */
export function galleryChannelId(guildId) {
  return configService.get(guildId, 'gallery.channelId') || '';
}

function kindOf(mime) {
  for (const [kind, re] of Object.entries(KINDS)) if (re.test(mime ?? '')) return kind === 'gif' ? 'image' : kind;
  return null;
}

/** Час протухання підпису з параметра ?ex= (hex-секунди Unix). */
function expiryOf(url) {
  try {
    const ex = new URL(url).searchParams.get('ex');
    if (ex) return parseInt(ex, 16) * 1000;
  } catch { /* некоректний URL — нижче фолбек */ }
  return Date.now() + 3600_000;
}

/**
 * Нове повідомлення в каналі галереї — пропонуємо автору опублікувати.
 * Питаємо один раз на повідомлення, навіть якщо вкладень кілька.
 */
export async function offerPublish(message) {
  const id = galleryChannelId(message.guild.id);
  if (!id || message.channelId !== id) return;

  const files = [...message.attachments.values()].filter((a) => kindOf(a.contentType));
  if (!files.length) return;

  const word = files.length > 1 ? `${files.length} файли` : 'це';
  try {
    const ask = await message.reply({
      content: `Опублікувати ${word} в галереї на сайті?`,
      components: rows([
        button({ id: cid(NS.GAL, 'pub', message.id), label: 'Опублікувати', emoji: '🖼️', style: ButtonStyle.Success }),
        button({ id: cid(NS.GAL, 'skip', message.id), label: 'Не треба', style: ButtonStyle.Secondary }),
      ]),
      allowedMentions: { repliedUser: false },
    });

    // Автор не відповів — питання зникає саме, щоб канал лишався галереєю.
    setTimeout(() => {
      ask.fetch()
        .then((m) => (m.components?.length ? m.delete() : null))
        .catch(() => {});
    }, 10 * 60_000);
  } catch (err) {
    log.warn('Не вдалося запитати автора', err.message);
  }
}

/**
 * Автор погодився — переносимо вкладення в галерею сайту.
 * @returns {Promise<number>} скільки опубліковано
 */
export async function publishFrom(message, user) {
  const files = [...message.attachments.values()].filter((a) => kindOf(a.contentType));
  let n = 0;

  for (const a of files) {
    await galleryRepo.add({
      guildId: message.guild.id,
      userId: user.id,
      username: message.member?.displayName ?? user.username,
      avatar: user.avatar ?? null,
      title: message.content?.slice(0, 120).trim() || null,
      kind: kindOf(a.contentType),
      mime: a.contentType,
      sizeBytes: a.size,
      // файл уже в Discord — зберігаємо лише посилання на нього
      storage: 'discord',
      objectKey: `${message.channelId}/${message.id}`,
      url: a.url,
      urlExpires: expiryOf(a.url),
    });
    n += 1;
  }

  if (n) log.info(`Галерея: ${user.username} опублікував ${n} файл(ів) із каналу`);
  return n;
}

/**
 * Завантаження з сайту: бот сам кидає файл у канал галереї, і вже звідти
 * він живе далі. Так усе медіа лежить в одному місці, незалежно від того,
 * звідки його надіслали.
 * @returns {Promise<{key:string,url:string,expires:number}>}
 */
export async function postToChannel(guild, { buffer, filename, authorName, caption }) {
  const id = galleryChannelId(guild.id);
  if (!id) throw new Error('канал галереї не налаштовано');

  const channel = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null);
  if (!channel?.isTextBased?.()) throw new Error('канал галереї недоступний');

  const note = caption ? `**${authorName}** · ${caption}` : `**${authorName}**`;
  const msg = await channel.send({
    content: `${note}\n-# із сайту`,
    files: [{ attachment: buffer, name: filename }],
    allowedMentions: { parse: [] },
  });

  const att = [...msg.attachments.values()][0];
  if (!att) throw new Error('вкладення не створилось');

  return { key: `${channel.id}/${msg.id}`, url: att.url, expires: expiryOf(att.url) };
}

/** Повідомлення видалили в Discord — прибираємо публікацію й із сайту. */
export async function removeByMessage(message) {
  const id = galleryChannelId(message.guild?.id ?? '');
  if (!id || message.channelId !== id) return;

  const key = `${message.channelId}/${message.id}`;
  const items = await galleryRepo.list(message.guild.id, { limit: 200 }).catch(() => []);
  const mine = items.filter((i) => i.object_key === key);
  for (const item of mine) await galleryRepo.remove(Number(item.id)).catch(() => {});
  if (mine.length) log.info(`Галерея: прибрано ${mine.length} публікацію(ї) — повідомлення видалено`);
}
