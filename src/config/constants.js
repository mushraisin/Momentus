/**
 * Глобальні константи системи.
 * Тут НЕМАЄ змінних налаштувань — все, що може змінювати адміністратор,
 * живе в БД (таблиця `config`) і редагується через Admin Panel.
 */

/** Discord ID власника/розробника. Має повний доступ до всіх панелей. */
export const OWNER_ID = '574231866396114944';

/** Namespace-и для customId інтерактивних компонентів. */
export const NS = {
  PROFILE: 'pf',
  REP: 'rep',
  VERIFY: 'vf',
  ADMIN: 'adm',
  DEV: 'dev',
  GAL: 'gal',
};

/** Рівні доступу. */
export const ACCESS = {
  MEMBER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  OWNER: 3,
};

/** Категорії репутації. Порядок визначає порядок відображення. */
export const REPUTATION_CATEGORIES = [
  { key: 'trust', label: 'Довіра', emoji: '🟢', inverted: false },
  { key: 'activity', label: 'Активність', emoji: '🟢', inverted: false },
  { key: 'communication', label: 'Комунікація', emoji: '🟢', inverted: false },
  { key: 'helpfulness', label: 'Допомога іншим', emoji: '🟢', inverted: false },
  { key: 'usefulness', label: 'Корисність', emoji: '🟢', inverted: false },
  { key: 'stability', label: 'Стабільність', emoji: '🟡', inverted: false },
  { key: 'behavior', label: 'Поведінка', emoji: '🟡', inverted: false },
  { key: 'conflict', label: 'Конфліктність', emoji: '🟠', inverted: true },
  { key: 'toxicity', label: 'Токсичність', emoji: '🔴', inverted: true },
  { key: 'violations', label: 'Порушення правил', emoji: '🔴', inverted: true },
  { key: 'peer', label: 'Серед учасників', emoji: '🔵', inverted: false },
];

/** Ознаки, які AI оцінює в кожному повідомленні (0..100). */
export const MESSAGE_TRAITS = [
  'politeness',
  'toxicity',
  'insult',
  'bullying',
  'harassment',
  'passiveAggression',
  'sarcasm',
  'threat',
  'profanity',
  'constructiveness',
  'adequacy',
  'helpfulness',
  'friendliness',
  'respect',
  'positiveImpact',
  'cultureLevel',
  'provocation',
  'flood',
  'spam',
  'advertising',
  'conflictSeeking',
];

/** Типи модераційних дій. */
export const PUNISHMENT = {
  NOTE: 'note',
  WARN: 'warn',
  MUTE: 'mute',
  TIMEOUT: 'timeout',
  KICK: 'kick',
  BAN: 'ban',
  UNPUNISH: 'unpunish',
  PRAISE: 'praise',
  REWARD: 'reward',
};

/** Ваги покарань при розрахунку категорії `violations`. */
export const PUNISHMENT_WEIGHT = {
  [PUNISHMENT.NOTE]: 0,
  [PUNISHMENT.WARN]: 8,
  [PUNISHMENT.MUTE]: 14,
  [PUNISHMENT.TIMEOUT]: 12,
  [PUNISHMENT.KICK]: 25,
  [PUNISHMENT.BAN]: 45,
};

/** Період «згасання» покарання (мс) — після нього вплив прямує до нуля. */
export const PUNISHMENT_DECAY_MS = 90 * 24 * 60 * 60 * 1000; // 90 днів

/** Максимальна кількість елементів на сторінці пагінації. */
export const PAGE_SIZE = 8;
