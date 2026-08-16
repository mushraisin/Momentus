import {
  walletRepo, itemsRepo, prefsRepo, activityRepo, assetsRepo,
} from '../database/repositories.js';
import { configService } from './configService.js';
import { OWNER_ID } from '../config/constants.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('shop');

/**
 * Косметика та ✨FP (Forge Points).
 *
 * Купується НАБІР цілком, а не окрема річ: у магазині ти його «отримуєш»,
 * а що саме вдягти з нього — вирішуєш уже в профілі. Так магазин лишається
 * коротким, а вибір живе там, де його видно на власній сторінці.
 *
 * Ціни можна міняти з сайту — вони лежать у конфізі гільдії й перекривають
 * значення з коду, тож правка не потребує перезапуску.
 */

/** Скільки FP дає день активності. Стеля потрібна, щоб флуд не був вигідним. */
const DAILY = { perMessage: 0.4, perVoiceHour: 6, max: 40, floor: 3 };

const solid = (id, name, color) => ({ id, name, kind: 'background', value: { type: 'solid', color } });
const grad = (id, name, from, to, angle = 160) =>
  ({ id, name, kind: 'background', value: { type: 'gradient', from, to, angle } });
const motion = (id, name, from, to) =>
  ({ id, name, kind: 'background', value: { type: 'motion', from, to } });
const accent = (id, name, color) => ({ id, name, kind: 'accent', value: { color } });
const frame = (id, name, color, style) => ({ id, name, kind: 'frame', value: { color, style } });
/** Стиль карток — впливає на всі вікна сайту: «Про себе», статистику, списки. */
const card = (id, name, value) => ({ id, name, kind: 'card', value });

/**
 * Каталог наборів. `booster` — потрібен буст сервера, `price` — типова ціна
 * (адміністратор може змінити). Набір «custom» особливий: він не дає готових
 * речей, а відкриває можливість поставити фоном власну публікацію з галереї.
 */
export const PACKS = [
  {
    id: 'pack.solid', name: 'Однотонні фони', price: 0, booster: false,
    hint: 'Вісім спокійних кольорів — безкоштовно для всіх',
    items: [
      solid('solid.ink', 'Чорнило', '#05070d'),
      solid('solid.slate', 'Сланець', '#101725'),
      solid('solid.wine', 'Вино', '#1b0d14'),
      solid('solid.moss', 'Мох', '#0b1710'),
      solid('solid.dusk', 'Сутінки', '#150f22'),
      solid('solid.sand', 'Пісок', '#191510'),
      solid('solid.deep', 'Глибина', '#04121c'),
      solid('solid.ash', 'Попіл', '#14161a'),
    ],
  },
  {
    id: 'pack.gradient', name: 'Градієнти', price: 240, booster: true,
    hint: 'Мʼякий перехід кольору замість рівного тла',
    items: [
      grad('grad.aurora', 'Аврора', '#0a1424', '#221033'),
      grad('grad.ember', 'Жар', '#1a0b0b', '#2a1206', 150),
      grad('grad.abyss', 'Безодня', '#01080f', '#0b1c2e', 200),
      grad('grad.violet', 'Фіалка', '#0d0a1e', '#1e1140', 175),
    ],
  },
  {
    id: 'pack.motion', name: 'Живі фони', price: 420, booster: true,
    hint: 'Колір повільно переливається — тло дихає разом зі сторінкою',
    items: [
      motion('motion.tide', 'Приплив', '#061321', '#0b2740'),
      motion('motion.nebula', 'Туманність', '#120a24', '#2a1046'),
      motion('motion.forge', 'Горн', '#1d0c07', '#3a1a08'),
    ],
  },
  {
    id: 'pack.accent', name: 'Акцентні кольори', price: 180, booster: true,
    hint: 'Колір кнопок, підсвітки й активних вкладок на всьому сайті',
    items: [
      accent('accent.gold', 'Золото', '#e0b45c'),
      accent('accent.mint', 'Мʼята', '#4fd1a5'),
      accent('accent.rose', 'Троянда', '#ef6f9c'),
      accent('accent.ice', 'Крига', '#6fc7ef'),
    ],
  },
  {
    id: 'pack.frame', name: 'Рамки аватара', price: 300, booster: true,
    hint: 'Кільце навколо аватара — видно і в профілі, і в рейтингу',
    items: [
      frame('frame.gold', 'Золота', '#e0b45c', 'glow'),
      frame('frame.mint', 'Мʼятна', '#4fd1a5', 'glow'),
      frame('frame.spin', 'Обертова', '#6b7cff', 'spin'),
      frame('frame.pulse', 'Пульс', '#ef6f9c', 'pulse'),
    ],
  },
  {
    id: 'pack.cardsFree', name: 'Прозорі вікна', price: 0, booster: false,
    hint: 'Скляні картки на всьому сайті — безкоштовно для всіх',
    items: [
      card('card.glass', 'Прозорі', {
        bg: 'rgba(22,27,40,.34)', line: 'rgba(255,255,255,.10)', blur: 20, radius: 18,
      }),
    ],
  },
  {
    id: 'pack.cards', name: 'Стилі вікон', price: 260, booster: true,
    hint: 'Вигляд усіх карток сайту: щільні, контурні, мʼякі чи майже невидимі',
    items: [
      card('card.dense', 'Щільні', {
        bg: 'rgba(10,13,22,.94)', line: 'rgba(255,255,255,.09)', blur: 0, radius: 14,
      }),
      card('card.outline', 'Контурні', {
        bg: 'rgba(8,11,19,.35)', line: 'rgba(255,255,255,.28)', blur: 8, radius: 16,
      }),
      card('card.soft', 'Мʼякі', {
        bg: 'rgba(26,31,46,.78)', line: 'rgba(255,255,255,.06)', blur: 16, radius: 26,
        shadow: '0 22px 60px rgba(0,0,0,.45)',
      }),
      card('card.ghost', 'Майже невидимі', {
        bg: 'rgba(255,255,255,.03)', line: 'rgba(255,255,255,.06)', blur: 26, radius: 20,
      }),
      card('card.sharp', 'Різкі', {
        bg: 'rgba(14,18,28,.88)', line: 'rgba(255,255,255,.14)', blur: 4, radius: 6,
      }),
    ],
  },
  {
    id: 'pack.custom', name: 'Власний контент', price: 1, booster: true,
    hint: 'Заливайте свої картинки — по 1 ✨FP за штуку, до трьох у кожній категорії',
    custom: true,
    // ціна тут — за кожне завантаження, а не разова покупка набору
    perUpload: true,
    slots: ['background', 'banner'],
    items: [],
  },
];

/** Скільки своїх картинок можна тримати в кожній категорії. */
export const UPLOAD_LIMIT = 3;

/** Пласка мапа речей: id → {…item, pack}. */
const ITEMS = new Map();
for (const p of PACKS) for (const it of p.items) ITEMS.set(it.id, { ...it, pack: p.id });
const BY_PACK = new Map(PACKS.map((p) => [p.id, p]));

export const cosmeticsService = {
  PACKS,
  DAILY,

  pack(id) {
    return BY_PACK.get(id) ?? null;
  },

  item(id) {
    return ITEMS.get(id) ?? null;
  },

  /** Ціна набору: спершу з конфігу гільдії, потім із коду. */
  price(guildId, packId) {
    const map = configService.get(guildId, 'shop.prices') ?? {};
    const own = Number(map?.[packId]);
    if (Number.isFinite(own) && own >= 0) return Math.round(own);
    return BY_PACK.get(packId)?.price ?? 0;
  },

  /** Набори з актуальними цінами — саме це показує сторінка. */
  catalog(guildId) {
    return PACKS.map((p) => ({ ...p, price: this.price(guildId, p.id) }));
  },

  async setPrice(guildId, packId, value) {
    if (!BY_PACK.has(packId)) return false;
    const map = { ...(configService.get(guildId, 'shop.prices') ?? {}) };
    map[packId] = Math.max(0, Math.round(Number(value) || 0));
    await configService.set(guildId, 'shop.prices', map);
    return true;
  },

  /**
   * Бустер — той, хто дав серверу хоч один буст.
   * Discord сам видає таким людям окрему роль; її id можна вказати в
   * налаштуваннях, і тоді перевірка працює навіть без кешу premiumSince.
   */
  isBooster(guildId, member) {
    if (!member) return false;
    if (member.id === OWNER_ID) return true;
    if (member.premiumSince || member.premiumSinceTimestamp) return true;
    const roles = configService.get(guildId, 'general.boosterRoleIds') ?? [];
    return roles.some((id) => member.roles?.cache?.has(id));
  },

  wallet(guildId, userId) {
    return walletRepo.get(guildId, userId);
  },

  owned(guildId, userId) {
    return itemsRepo.owned(guildId, userId);
  },

  /** Купити набір цілком. Вибір усередині — уже в профілі. */
  async buy(guildId, userId, member, packId) {
    const pack = BY_PACK.get(packId);
    if (!pack) return { ok: false, reason: 'unknown' };
    if (pack.booster && !this.isBooster(guildId, member) && userId !== OWNER_ID) {
      return { ok: false, reason: 'booster' };
    }
    if (await itemsRepo.has(guildId, userId, packId)) return { ok: false, reason: 'owned' };

    const price = this.price(guildId, packId);
    if (price > 0 && !await walletRepo.spend(guildId, userId, price)) {
      return { ok: false, reason: 'funds' };
    }
    await itemsRepo.give(guildId, userId, packId, price);
    const w = await walletRepo.get(guildId, userId);
    log.info(`${userId} отримав набір «${pack.name}» за ${price} FP`);
    return { ok: true, balance: w.balance, pack: packId };
  },

  /** Чи є в людини набір, до якого належить річ. */
  async ownsItem(guildId, userId, itemId) {
    const it = ITEMS.get(itemId);
    if (!it) return false;
    if (userId === OWNER_ID) return true;
    return itemsRepo.has(guildId, userId, it.pack);
  },

  /**
   * Вдягнути річ або зняти оформлення (порожнє значення).
   * Тип визначає, куди вона лягає: фон, акцент чи рамка аватара.
   */
  async equip(guildId, userId, itemId) {
    if (!itemId) return prefsRepo.save(guildId, userId, { background: null });
    const it = ITEMS.get(itemId);
    if (!it) return null;
    if (!await this.ownsItem(guildId, userId, itemId)) return null;

    if (it.kind === 'background') return prefsRepo.save(guildId, userId, { background: itemId });
    if (it.kind === 'accent') return prefsRepo.save(guildId, userId, { accent: it.value.color });
    // рамка й стиль вікон живуть у layout — окремих колонок під них немає
    if (it.kind === 'frame' || it.kind === 'card') {
      const layout = { ...(await prefsRepo.get(guildId, userId)).layout ?? {} };
      layout[it.kind] = itemId;
      return prefsRepo.save(guildId, userId, { layout });
    }
    return null;
  },

  /** Скинути окреме оформлення: background | accent | frame | card | banner. */
  async clear(guildId, userId, what) {
    if (what === 'accent') return prefsRepo.save(guildId, userId, { accent: null });
    if (what === 'banner') return prefsRepo.save(guildId, userId, { banner: null });
    if (what === 'frame' || what === 'card') {
      const layout = { ...(await prefsRepo.get(guildId, userId)).layout ?? {} };
      delete layout[what];
      return prefsRepo.save(guildId, userId, { layout });
    }
    return prefsRepo.save(guildId, userId, { background: null });
  },

  UPLOAD_LIMIT,

  /**
   * Свої картинки заливають лише бустери й лише через магазин —
   * по одному FP за штуку, не більше трьох у кожній категорії.
   */
  canUpload(guildId, member, userId = member?.id) {
    return userId === OWNER_ID || this.isBooster(guildId, member);
  },

  /** Скільки ще можна залити в цю категорію. */
  async uploadsLeft(guildId, userId, kind) {
    const list = await assetsRepo.list(guildId, userId, kind, 50);
    return Math.max(0, UPLOAD_LIMIT - list.length);
  },

  /**
   * Скільки коштує одна своя картинка: символічний ✨1FP, а якщо
   * адміністратор поставив свою ціну — половина від неї.
   */
  uploadPrice(guildId) {
    const base = this.price(guildId, 'pack.custom');
    return Math.max(1, Math.ceil(base / 2));
  },

  /**
   * Оплатити завантаження. Гроші списуються лише коли місце є
   * і людина справді має право заливати.
   */
  async payUpload(guildId, userId, member, kind) {
    if (!this.canUpload(guildId, member, userId)) return { ok: false, reason: 'booster' };
    if (!await this.uploadsLeft(guildId, userId, kind)) return { ok: false, reason: 'limit' };

    const price = this.uploadPrice(guildId);
    if (price > 0 && !await walletRepo.spend(guildId, userId, price)) {
      return { ok: false, reason: 'funds' };
    }
    return { ok: true, price };
  },

  /**
   * Поставити власну картинку фоном або банером.
   *
   * Джерело одне — завантажений файл, який лежить у приватному каналі-сховищі.
   * Публікації з галереї сюди не беремо: галерея — це спільна вітрина,
   * а оформлення профілю має бути окремим і приватним.
   */
  async setOwnImage(guildId, userId, { slot = 'background', asset = null } = {}) {
    if (!asset) {
      await prefsRepo.save(guildId, userId, { [slot]: null });
      return { ok: true };
    }

    const a = await assetsRepo.meta(Number(asset));
    if (!a || a.guild_id !== guildId || a.user_id !== userId) return { ok: false, reason: 'not yours' };

    const ref = `asset:${a.id}`;
    await prefsRepo.save(guildId, userId, { [slot]: ref });
    return { ok: true, ref };
  },

  /** Адреса картинки за посиланням із налаштувань. */
  imageUrl(ref) {
    if (!ref) return null;
    if (String(ref).startsWith('asset:')) return `/asset/${String(ref).slice(6)}`;
    return null;
  },

  /** Оформлення для сторінок: фон, акцент, рамка, банер, опис. */
  async look(guildId, userId) {
    const p = await prefsRepo.get(guildId, userId);
    let background = null;

    if (p.background?.startsWith('own:') || p.background?.startsWith('asset:')) {
      background = { id: p.background, type: 'image', url: this.imageUrl(p.background) };
    } else if (p.background) {
      const it = ITEMS.get(p.background);
      if (it) background = { id: it.id, ...it.value };
    }

    const frameId = p.layout?.frame ?? null;
    const fr = frameId ? ITEMS.get(frameId) : null;
    const cardId = p.layout?.card ?? null;
    const cd = cardId ? ITEMS.get(cardId) : null;

    return {
      about: p.about ?? '',
      banner: p.banner ?? null,
      bannerUrl: this.imageUrl(p.banner),
      accent: p.accent ?? null,
      background,
      frame: fr ? { id: fr.id, ...fr.value } : null,
      card: cd ? { id: cd.id, ...cd.value } : null,
      // Де саме показувати оформлення: на всьому сайті чи лише у своєму профілі.
      // За замовчуванням — скрізь, бо саме цього від нього й чекають.
      scope: {
        background: p.layout?.scope?.background !== 'profile',
        accent: p.layout?.scope?.accent !== 'profile',
        card: p.layout?.scope?.card !== 'profile',
      },
      layout: p.layout ?? null,
    };
  },

  /**
   * Щоденне нарахування за вчорашню активність.
   * Один раз на добу на людину — повторний виклик нічого не додасть.
   */
  async grantDaily(guildId, userId, day = new Date().toISOString().slice(0, 10)) {
    const w = await walletRepo.get(guildId, userId);
    if (w.lastGrant === day) return 0;

    const msgs = await activityRepo.sumSince(guildId, userId, 1, 'messages').catch(() => 0);
    const voice = await activityRepo.sumSince(guildId, userId, 1, 'voice_minutes').catch(() => 0);
    if (!msgs && !voice) {
      await walletRepo.add(guildId, userId, 0, day);
      return 0;
    }

    const raw = msgs * DAILY.perMessage + (voice / 60) * DAILY.perVoiceHour;
    const amount = Math.max(DAILY.floor, Math.min(DAILY.max, Math.round(raw)));
    await walletRepo.add(guildId, userId, amount, day);
    return amount;
  },
};
