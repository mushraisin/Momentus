import { usersRepo, activityRepo } from '../database/repositories.js';
import { caches } from '../core/cache.js';
import { isGratitude, isQuestion, isHelpful } from './analysis/ruleEngine.js';
import { reputationService } from './reputationService.js';

/**
 * Легкий облік «сирих» подій активності (без AI): повідомлення, реакції, войс.
 * Викликається з gateway-обробників. Методи async — БД тепер асинхронна;
 * важливо await-ити ensure() перед bump(), щоб рядок користувача вже існував.
 */
export const trackingService = {
  async message(guildId, message) {
    const userId = message.author.id;
    await usersRepo.ensure(guildId, userId, message.author.username, message.member?.joinedTimestamp);
    await usersRepo.bump(guildId, userId, 'total_messages', 1);
    await usersRepo.bump(guildId, userId, 'total_chars', (message.content ?? '').length);

    const hour = new Date().getUTCHours();
    if (hour >= 2 && hour < 5) await usersRepo.bump(guildId, userId, 'night_messages', 1);

    await activityRepo.bump(guildId, userId, 'messages', 1);
    await activityRepo.bump(guildId, userId, 'chars', (message.content ?? '').length);

    await trackPeers(guildId, message);
    await trackHelp(guildId, message);

    // рейтинг оновиться сам найближчим проходом — кнопку тиснути не треба
    reputationService.markDirty(guildId, userId);
  },

  async reactionReceived(guildId, authorId, giverId) {
    if (!authorId || authorId === giverId) return;
    await usersRepo.ensure(guildId, authorId, null, null);
    await usersRepo.bump(guildId, authorId, 'reactions_received', 1);
    await activityRepo.bump(guildId, authorId, 'reactions_in', 1);
    caches.profile.delete(`${guildId}:${authorId}`);
  },

  async reactionGiven(guildId, giverId) {
    await usersRepo.ensure(guildId, giverId, null, null);
    await usersRepo.bump(guildId, giverId, 'reactions_given', 1);
    await activityRepo.bump(guildId, giverId, 'reactions_out', 1);
  },

  async voiceMinutes(guildId, userId, minutes) {
    if (minutes <= 0) return;
    await usersRepo.ensure(guildId, userId, null, null);
    await usersRepo.bump(guildId, userId, 'voice_minutes', minutes);
    await activityRepo.bump(guildId, userId, 'voice_minutes', minutes);
  },

  async messageDeleted(guildId, userId) {
    if (!userId) return;
    await usersRepo.bump(guildId, userId, 'deleted_messages', 1);
  },

  async helped(guildId, userId) {
    await usersRepo.ensure(guildId, userId, null, null);
    await usersRepo.bump(guildId, userId, 'help_count', 1);
  },
};

/**
 * Реальні акти допомоги — без ШІ, з поведінки:
 *  1) хтось відповів/звернувся до X зі словами подяки → X допоміг (сильний сигнал);
 *  2) X написав змістовну відповідь на чиєсь запитання → зараховуємо акт допомоги.
 * Захист від накрутки: не можна дякувати самому собі й ботам,
 * і не більше одного зарахування на пару «дякує → кому» за годину.
 */
async function trackHelp(guildId, message) {
  const authorId = message.author.id;
  const content = message.content ?? '';
  if (!content) return;

  // 1) подяка на адресу конкретної людини
  const target = message.mentions?.repliedUser ?? message.mentions?.users?.first() ?? null;
  if (target && target.id !== authorId && !target.bot && isGratitude(content)) {
    const key = `thx:${guildId}:${authorId}:${target.id}`;
    if (!caches.profile.get(key)) {
      caches.profile.set(key, 1, 3600_000); // 1 год антифрод
      await usersRepo.ensure(guildId, target.id, null, null);
      await usersRepo.bump(guildId, target.id, 'help_count', 1);
      caches.profile.delete(`${guildId}:${target.id}`);
    }
    return;
  }

  // 2) змістовна відповідь на запитання іншого учасника
  const replied = message.mentions?.repliedUser;
  if (replied && replied.id !== authorId && !replied.bot && isHelpful(content) && content.length > 40) {
    const ref = message.reference?.messageId;
    const key = `ans:${guildId}:${authorId}:${ref ?? replied.id}`;
    if (!caches.profile.get(key)) {
      caches.profile.set(key, 1, 1800_000);
      await usersRepo.bump(guildId, authorId, 'help_count', 1);
    }
  }
}

/** Груба евристика «нових знайомств»: перша взаємодія у гілці згадок. */
async function trackPeers(guildId, message) {
  const userId = message.author.id;
  const mentioned = message.mentions?.users;
  if (!mentioned || mentioned.size === 0) return;
  const key = `peers:${guildId}:${userId}`;
  const known = caches.profile.getOrSet(key, () => new Set(), 6 * 3600_000);
  let added = 0;
  for (const [id] of mentioned) {
    if (id === userId) continue;
    if (!known.has(id)) {
      known.add(id);
      added++;
    }
  }
  if (added > 0) {
    await usersRepo.bump(guildId, userId, 'distinct_peers', added);
    await activityRepo.bump(guildId, userId, 'new_peers', added);
  }
}
