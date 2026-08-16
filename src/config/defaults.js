/**
 * Значення конфігурації за замовчуванням.
 * Кожен ключ редагується через Admin Panel → «Конфігурація» (без жодних команд).
 * Тип `type` визначає, як поле рендериться в модальному вікні.
 */

export const CONFIG_SCHEMA = {
  // ── Загальне ──────────────────────────────
  'general.locale': { type: 'string', default: 'uk', label: 'Мова інтерфейсу (uk/en)', group: 'general' },
  // Два різні канали: у першому живе панель для всіх, у другому — налаштування
  // бота, які бачити стороннім ні до чого.
  'general.statsChannelId': { type: 'channel', default: '', label: 'Канал панелі (для всіх)', group: 'general' },
  'general.adminChannelId': { type: 'channel', default: '', label: 'Канал налаштувань (адмін)', group: 'general' },
  'general.modPanelChannelId': { type: 'channel', default: '', label: 'Канал панелі модерації', group: 'general' },
  'general.modLogChannelId': { type: 'channel', default: '', label: 'Канал лог-модерації', group: 'general' },
  'general.systemLogChannelId': { type: 'channel', default: '', label: 'Системний лог', group: 'general' },

  // ── Доступ ────────────────────────────────
  'access.adminRoleIds': { type: 'roles', default: [], label: 'Ролі адміністраторів', group: 'access' },
  'access.moderatorRoleIds': { type: 'roles', default: [], label: 'Ролі модераторів', group: 'access' },

  // ── AI ────────────────────────────────────
  'ai.enabled': { type: 'bool', default: true, label: 'AI-аналіз увімкнено', group: 'ai' },
  'ai.model': { type: 'string', default: 'claude-opus-5', label: 'Модель', group: 'ai' },
  'ai.effort': { type: 'string', default: 'low', label: 'Effort (low/medium/high/xhigh/max)', group: 'ai' },
  'ai.batchSize': { type: 'int', default: 12, label: 'Повідомлень у пакеті аналізу', group: 'ai' },
  'ai.batchIntervalMs': { type: 'int', default: 45_000, label: 'Інтервал флашу пакета (мс)', group: 'ai' },
  'ai.minMessageLength': { type: 'int', default: 3, label: 'Мін. довжина повідомлення для аналізу', group: 'ai' },
  'ai.dailyCallBudget': { type: 'int', default: 4000, label: 'Ліміт AI-викликів на добу', group: 'ai' },
  'ai.autoModerate': { type: 'bool', default: false, label: 'AI виконує покарання автоматично', group: 'ai' },
  'ai.autoModerateThreshold': { type: 'int', default: 85, label: 'Поріг токсичності для авто-дії', group: 'ai' },

  // ── Ваги AI Score (сума нормалізується) ───
  'weights.trust': { type: 'float', default: 1.4, label: 'Вага: Довіра', group: 'weights' },
  'weights.activity': { type: 'float', default: 1.0, label: 'Вага: Активність', group: 'weights' },
  'weights.communication': { type: 'float', default: 1.2, label: 'Вага: Комунікація', group: 'weights' },
  'weights.helpfulness': { type: 'float', default: 1.3, label: 'Вага: Допомога', group: 'weights' },
  'weights.usefulness': { type: 'float', default: 1.0, label: 'Вага: Корисність', group: 'weights' },
  'weights.stability': { type: 'float', default: 0.9, label: 'Вага: Стабільність', group: 'weights' },
  'weights.behavior': { type: 'float', default: 1.2, label: 'Вага: Поведінка', group: 'weights' },
  'weights.conflict': { type: 'float', default: 1.1, label: 'Вага: Конфліктність (мінус)', group: 'weights' },
  'weights.toxicity': { type: 'float', default: 1.6, label: 'Вага: Токсичність (мінус)', group: 'weights' },
  'weights.violations': { type: 'float', default: 1.5, label: 'Вага: Порушення (мінус)', group: 'weights' },
  'weights.peer': { type: 'float', default: 0.8, label: 'Вага: Репутація серед учасників', group: 'weights' },

  // ── Перевірка / рівні ролей ───────────────
  'verification.tiers': { type: 'json', default: [], label: 'Рівні ролей (JSON)', group: 'verification' },
  'verification.demotionMargin': { type: 'int', default: 5, label: 'Гістерезис утримання ролі', group: 'verification' },
  'verification.cooldownMinutes': { type: 'int', default: 10, label: 'Пауза між перевірками (хв)', group: 'verification' },
  'verification.autoRecheck': { type: 'bool', default: true, label: 'Авто-перевірка при зміні репутації', group: 'verification' },

  // ── Магазин косметики ─────────────────────
  // Роль бустера Discord видає сам, щойно людина дала серверу буст.
  'general.boosterRoleIds': { type: 'roles', default: [], label: 'Ролі бустерів', group: 'general' },
  // Ціни наборів: {'pack.gradient': 240, …}. Правляться на сайті адміністратором.
  'shop.prices': { type: 'json', default: {}, label: 'Ціни наборів', group: 'general' },

  // ── Модерація ─────────────────────────────
  'moderation.aiAdvice': { type: 'bool', default: true, label: 'AI-поради перед покаранням', group: 'moderation' },
  'moderation.requireReason': { type: 'bool', default: true, label: 'Причина обовʼязкова', group: 'moderation' },
  'moderation.defaultTimeoutMinutes': { type: 'int', default: 60, label: 'Timeout за замовчуванням (хв)', group: 'moderation' },
  'moderation.dmOnPunish': { type: 'bool', default: true, label: 'Повідомляти користувача в ЛС', group: 'moderation' },
  // Ліміти покарань за рівнем доступу. 0 — без обмежень.
  'moderation.maxMinutesModerator': { type: 'int', default: 1440, label: 'Ліміт мута для модератора (хв)', group: 'moderation' },
  'moderation.maxMinutesAdmin': { type: 'int', default: 0, label: 'Ліміт мута для адміністратора (хв)', group: 'moderation' },
  'moderation.allowKickModerator': { type: 'bool', default: false, label: 'Модератор може кікати', group: 'moderation' },
  'moderation.allowBanModerator': { type: 'bool', default: false, label: 'Модератор може банити', group: 'moderation' },
  // Службові ролі мутів — бот створює й запам'ятовує їх сам.
  'moderation.textMuteRoleId': { type: 'string', default: '', label: 'Роль текстового мута', group: 'moderation' },
  'moderation.voiceMuteRoleId': { type: 'string', default: '', label: 'Роль голосового мута', group: 'moderation' },
  // ── Нагляд за тими, хто має права Discord ──
  // Рахуємо дії персоналу (відключення з голосового, серверні мути, кіки, бани)
  // і, якщо в короткому вікні їх забагато, автоматично видаємо попередження.
  'moderation.staffWatch': { type: 'bool', default: true, label: 'Стежити за діями персоналу', group: 'moderation' },
  'moderation.staffWindowMin': { type: 'int', default: 10, label: 'Вікно нагляду (хв)', group: 'moderation' },
  'moderation.staffLimit': { type: 'int', default: 10, label: 'Поріг ваги дій у вікні', group: 'moderation' },
  'moderation.staffSameTargetLimit': { type: 'int', default: 4, label: 'Поріг дій по одній людині', group: 'moderation' },
  'moderation.staffExemptRoles': { type: 'roles', default: [], label: 'Ролі поза наглядом', group: 'moderation' },

  // ── Галерея та кінотеатр ──────────────────
  // Канал-сховище: бот заливає туди медіа й тримає лише посилання.
  // Місце фактично безлімітне, на відміну від БД чи диска хоста.
  'media.channelId': { type: 'channel', default: '', label: 'Приватне сховище медіа', group: 'media' },
  // Канал-джерело галереї: усе медіа звідси бот пропонує опублікувати на сайті.
  'gallery.channelId': { type: 'channel', default: '', label: 'Канал галереї', group: 'media' },
  'cinema.voiceChannelId': { type: 'channel', default: '', label: 'Голосовий канал кінотеатру', group: 'media' },
  'cinema.enabled': { type: 'bool', default: true, label: 'Кінотеатр увімкнено', group: 'media' },
  // Кому дозволено правити сеанс і чергу, окрім адміністраторів.
  'cinema.editorIds': { type: 'roles', default: [], label: 'Хто керує сеансом', group: 'media' },
  // Кому заборонено навіть ставити на паузу (решті в залі — можна).
  'cinema.blockedIds': { type: 'roles', default: [], label: 'Без права паузи', group: 'media' },
  // Тимчасове закриття залу: до якого часу (мс). 0 — відкрито.
  'cinema.lockUntil': { type: 'int', default: 0, label: 'Зал зачинено до (мс)', group: 'media' },

  // ── Приватність ───────────────────────────
  'privacy.storeMessageContent': { type: 'bool', default: false, label: 'Зберігати текст повідомлень', group: 'privacy' },
  'privacy.retentionDays': { type: 'int', default: 180, label: 'Термін зберігання аналітики (днів)', group: 'privacy' },
  'privacy.publicLeaderboard': { type: 'bool', default: true, label: 'Публічний рейтинг', group: 'privacy' },
};
