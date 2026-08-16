import { walletRepo, itemsRepo, prefsRepo, activityRepo } from '../database/repositories.js';
import { OWNER_ID } from '../config/constants.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('shop');

/**
 * Косметика та ✨FP (Forge Points).
 *
 * Валюта нараховується за активність — раз на добу, за реальні дії, а не
 * за присутність. Куплене лишається назавжди: якщо людина перестала
 * бустити сервер, вона не втрачає те, за що вже заплатила, — але нове
 * з бустерських наборів купити вже не зможе.
 *
 * Каталог живе в коді, а не в базі: набори рідко змінюються, зате так
 * їх видно в одному місці й не треба ніякої адмінки.
 */

/** Скільки FP дає день активності. Стеля потрібна, щоб флуд не був вигідним. */
const DAILY = { perMessage: 0.4, perVoiceHour: 6, max: 40, floor: 3 };

/** Однотонні фони — безкоштовний набір, доступний усім. */
const SOLIDS = [
  ['solid.ink', 'Чорнило', '#05070d'],
  ['solid.slate', 'Сланець', '#101725'],
  ['solid.wine', 'Вино', '#1b0d14'],
  ['solid.moss', 'Мох', '#0b1710'],
  ['solid.dusk', 'Сутінки', '#150f22'],
  ['solid.sand', 'Пісок', '#191510'],
  ['solid.deep', 'Глибина', '#04121c'],
  ['solid.ash', 'Попіл', '#14161a'],
];

/**
 * Каталог. kind — на що впливає річ, booster — чи потрібен буст.
 * price 0 означає «безкоштовно», але річ усе одно треба «взяти» —
 * так у профілі видно, що людина її свідомо обрала.
 */
export const CATALOG = [
  ...SOLIDS.map(([id, name, color]) => ({
    id, name, kind: 'background', pack: 'solid', price: 0, booster: false,
    value: { type: 'solid', color },
  })),

  // Наступні набори — подяка тим, хто тримає сервер бустами.
  {
    id: 'grad.aurora', name: 'Аврора', kind: 'background', pack: 'gradient', price: 240, booster: true,
    value: { type: 'gradient', from: '#0a1424', to: '#221033', angle: 160 },
  },
  {
    id: 'grad.ember', name: 'Жар', kind: 'background', pack: 'gradient', price: 240, booster: true,
    value: { type: 'gradient', from: '#1a0b0b', to: '#2a1206', angle: 150 },
  },
  {
    id: 'grad.abyss', name: 'Безодня', kind: 'background', pack: 'gradient', price: 240, booster: true,
    value: { type: 'gradient', from: '#01080f', to: '#0b1c2e', angle: 200 },
  },
  {
    id: 'accent.gold', name: 'Золото', kind: 'accent', pack: 'accent', price: 180, booster: true,
    value: { color: '#e0b45c' },
  },
  {
    id: 'accent.mint', name: 'Мʼята', kind: 'accent', pack: 'accent', price: 180, booster: true,
    value: { color: '#4fd1a5' },
  },
  {
    id: 'accent.rose', name: 'Троянда', kind: 'accent', pack: 'accent', price: 180, booster: true,
    value: { color: '#ef6f9c' },
  },
  {
    id: 'feat.banner', name: 'Банер профілю', kind: 'feature', pack: 'profile', price: 320, booster: true,
    value: { feature: 'banner' },
  },
  {
    id: 'feat.about', name: 'Опис про себе', kind: 'feature', pack: 'profile', price: 120, booster: false,
    value: { feature: 'about' },
  },
];

const BY_ID = new Map(CATALOG.map((i) => [i.id, i]));

export const cosmeticsService = {
  CATALOG,
  DAILY,

  item(id) {
    return BY_ID.get(id) ?? null;
  },

  /** Буст сервера — головна умова доступу до платних наборів. */
  isBooster(member) {
    if (!member) return false;
    if (member.id === OWNER_ID) return true;              // власнику відкрито все
    return !!member.premiumSince || !!member.premiumSinceTimestamp;
  },

  /** Що людина може купити прямо зараз. */
  available(member) {
    const booster = this.isBooster(member);
    return CATALOG.filter((i) => !i.booster || booster);
  },

  wallet(guildId, userId) {
    return walletRepo.get(guildId, userId);
  },

  owned(guildId, userId) {
    return itemsRepo.owned(guildId, userId);
  },

  /**
   * Купити (або «взяти», якщо безкоштовно).
   * @returns {Promise<{ok:boolean, reason?:string, balance?:number}>}
   */
  async buy(guildId, userId, member, itemId) {
    const item = BY_ID.get(itemId);
    if (!item) return { ok: false, reason: 'unknown' };
    // member може не підвантажитись — тоді вважаємо, що бусту немає:
    // краще не пустити зайвий раз, ніж роздати бустерське всім
    if (item.booster && !this.isBooster(member) && userId !== OWNER_ID) {
      return { ok: false, reason: 'booster' };
    }
    if (await itemsRepo.has(guildId, userId, itemId)) return { ok: false, reason: 'owned' };

    if (item.price > 0) {
      const paid = await walletRepo.spend(guildId, userId, item.price);
      if (!paid) return { ok: false, reason: 'funds' };
    }
    await itemsRepo.give(guildId, userId, itemId, item.price);
    const w = await walletRepo.get(guildId, userId);
    log.info(`${userId} узяв «${item.name}» за ${item.price} FP`);
    return { ok: true, balance: w.balance };
  },

  /**
   * Одягнути річ. Порожнє значення знімає оформлення.
   * Перевіряємо володіння — інакше вигляд можна було б підмінити запитом.
   */
  async equip(guildId, userId, itemId) {
    if (!itemId) return prefsRepo.save(guildId, userId, { background: null });
    const item = BY_ID.get(itemId);
    if (!item) return null;
    if (!await itemsRepo.has(guildId, userId, itemId)) return null;

    if (item.kind === 'background') return prefsRepo.save(guildId, userId, { background: itemId });
    if (item.kind === 'accent') return prefsRepo.save(guildId, userId, { accent: item.value.color });
    return null;
  },

  /** Оформлення для сторінки: колір тла й акцент. */
  async look(guildId, userId) {
    const p = await prefsRepo.get(guildId, userId);
    const bg = p.background ? BY_ID.get(p.background) : null;
    return {
      about: p.about ?? '',
      banner: p.banner ?? null,
      accent: p.accent ?? null,
      background: bg ? { id: bg.id, ...bg.value } : null,
    };
  },

  /** Чи відкрита людині ця можливість (банер, опис тощо). */
  async canUse(guildId, userId, feature) {
    const item = CATALOG.find((i) => i.kind === 'feature' && i.value.feature === feature);
    if (!item) return false;
    if (userId === OWNER_ID) return true;
    return itemsRepo.has(guildId, userId, item.id);
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
      // навіть у тихий день позначаємо дату, щоб не рахувати те саме знову
      await walletRepo.add(guildId, userId, 0, day);
      return 0;
    }

    const raw = msgs * DAILY.perMessage + (voice / 60) * DAILY.perVoiceHour;
    const amount = Math.max(DAILY.floor, Math.min(DAILY.max, Math.round(raw)));
    await walletRepo.add(guildId, userId, amount, day);
    return amount;
  },
};
