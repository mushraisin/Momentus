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
/**
 * Категорії магазину. Порядок тут — порядок у списку ліворуч.
 * `custom` наповнюють самі учасники, решта — з каталогу нижче.
 */
export const CATEGORIES = [
  { id: 'bg', name: 'Фони', hint: 'Тло сторінок: рівний колір, градієнт або живий перелив' },
  { id: 'banner', name: 'Банери', hint: 'Смуга вгорі картки профілю' },
  { id: 'art', name: 'Ілюстрації', hint: 'Картинки для вітрини у вашому профілі' },
  { id: 'accent', name: 'Акцентні кольори', hint: 'Колір кнопок, підсвітки й активних вкладок' },
  { id: 'frame', name: 'Рамки', hint: 'Кільце навколо аватара' },
  { id: 'card', name: 'Вікна', hint: 'Вигляд карток: щільні, контурні, мʼякі чи майже невидимі' },
];

/**
 * Що саме бустер може залити й куди це лягає в магазині.
 *
 * Раніше всі роботи учасників звалювались в окрему категорію «Кастом»,
 * тож фон від учасника лежав не поряд з іншими фонами, а десь унизу
 * сторінки. Тепер робота потрапляє в той самий розділ, що й каталожні
 * речі того ж призначення.
 */
export const UPLOAD_KINDS = [
  { kind: 'background', category: 'bg', name: 'Фон', slot: 'background' },
  { kind: 'banner', category: 'banner', name: 'Банер', slot: 'banner' },
  { kind: 'art', category: 'art', name: 'Ілюстрація', slot: null },
];

/** Категорія магазину для залитої роботи. */
export function categoryOfKind(kind) {
  return UPLOAD_KINDS.find((k) => k.kind === kind)?.category ?? 'bg';
}

/**
 * Прибрати роботу з оформлення однієї людини: фон, банер і вітрина.
 * Без цього після видалення в профілі лишалась би порожня рамка замість
 * картинки, яку вже нічим не показати.
 */
async function stripAsset(guildId, userId, assetId) {
  const ref = `asset:${assetId}`;
  const p = await prefsRepo.get(guildId, userId);
  const patch = {};

  if (p.background === ref) patch.background = null;
  if (p.banner === ref) patch.banner = null;

  const show = Array.isArray(p.layout?.showcase) ? p.layout.showcase : [];
  if (show.some((x) => Number(x) === Number(assetId))) {
    patch.layout = { ...(p.layout ?? {}), showcase: show.filter((x) => Number(x) !== Number(assetId)) };
  }

  if (Object.keys(patch).length) await prefsRepo.save(guildId, userId, patch);
}

/**
 * Безкоштовний набір. Це єдине, що купується цілком: вісім спокійних
 * кольорів як стартовий вибір для кожного, без бусту й без FP.
 */
export const FREE_PACK = {
  id: 'pack.solid', name: 'Однотонні фони', category: 'bg', price: 0, booster: false, pack: true,
  hint: 'Вісім кольорів одним набором — безкоштовно для всіх',
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
};

/** Решта — поштучно: у кожної речі своя ціна й своя позначка про буст. */
const SINGLES = [
  { ...grad('grad.aurora', 'Аврора', '#0a1424', '#221033'), category: 'bg', price: 70, booster: false },
  { ...grad('grad.ember', 'Жар', '#1a0b0b', '#2a1206', 150), category: 'bg', price: 70, booster: false },
  { ...grad('grad.abyss', 'Безодня', '#01080f', '#0b1c2e', 200), category: 'bg', price: 70, booster: false },
  { ...grad('grad.violet', 'Фіалка', '#0d0a1e', '#1e1140', 175), category: 'bg', price: 70, booster: true },

  { ...grad('grad.moss', 'Хвоя', '#06140d', '#0f2a1c', 145), category: 'bg', price: 70, booster: false },
  { ...grad('grad.rust', 'Іржа', '#1a0e08', '#3a1d0e', 165), category: 'bg', price: 70, booster: false },
  { ...grad('grad.steel', 'Сталь', '#0c1016', '#1c2734', 190), category: 'bg', price: 70, booster: false },
  { ...grad('grad.plum', 'Слива', '#150a1a', '#2e1236', 155), category: 'bg', price: 70, booster: false },
  { ...grad('grad.dawn', 'Світанок', '#101020', '#3a2436', 140), category: 'bg', price: 90, booster: false },
  { ...grad('grad.teal', 'Лагуна', '#03141a', '#0b3038', 185), category: 'bg', price: 90, booster: false },
  { ...grad('grad.ink', 'Туш', '#050608', '#141a26', 170), category: 'bg', price: 90, booster: true },
  { ...grad('grad.wine', 'Кагор', '#180810', '#3a0f22', 160), category: 'bg', price: 90, booster: true },

  { ...motion('motion.tide', 'Приплив', '#061321', '#0b2740'), category: 'bg', price: 150, booster: true },
  { ...motion('motion.nebula', 'Туманність', '#120a24', '#2a1046'), category: 'bg', price: 150, booster: true },
  { ...motion('motion.forge', 'Горн', '#1d0c07', '#3a1a08'), category: 'bg', price: 150, booster: true },
  { ...motion('motion.aurora', 'Сяйво', '#04160f', '#0d3a2c'), category: 'bg', price: 150, booster: true },
  { ...motion('motion.storm', 'Гроза', '#0a0c14', '#232a3e'), category: 'bg', price: 150, booster: true },
  { ...motion('motion.ember', 'Жарини', '#160606', '#3d1010'), category: 'bg', price: 180, booster: true },
  { ...motion('motion.deep', 'Товща', '#01080f', '#062338'), category: 'bg', price: 180, booster: true },

  { ...accent('accent.gold', 'Золото', '#e0b45c'), category: 'accent', price: 60, booster: false },
  { ...accent('accent.mint', 'Мʼята', '#4fd1a5'), category: 'accent', price: 60, booster: false },
  { ...accent('accent.rose', 'Троянда', '#ef6f9c'), category: 'accent', price: 60, booster: false },
  { ...accent('accent.ice', 'Крига', '#6fc7ef'), category: 'accent', price: 60, booster: true },
  { ...accent('accent.lime', 'Лайм', '#a8e05f'), category: 'accent', price: 60, booster: false },
  { ...accent('accent.coral', 'Корал', '#ff7f6e'), category: 'accent', price: 60, booster: false },
  { ...accent('accent.amber', 'Бурштин', '#f0a44a'), category: 'accent', price: 60, booster: false },
  { ...accent('accent.violet', 'Фіолет', '#a77dff'), category: 'accent', price: 80, booster: false },
  { ...accent('accent.teal', 'Бірюза', '#3fc9c0'), category: 'accent', price: 80, booster: false },
  { ...accent('accent.sky', 'Небо', '#5aa9ff'), category: 'accent', price: 80, booster: false },
  { ...accent('accent.crimson', 'Багрянець', '#e0455f'), category: 'accent', price: 100, booster: true },
  { ...accent('accent.silver', 'Срібло', '#c8d2e4'), category: 'accent', price: 100, booster: true },
  { ...accent('accent.magenta', 'Фуксія', '#ff5cc8'), category: 'accent', price: 100, booster: true },

  { ...frame('frame.gold', 'Золота', '#e0b45c', 'glow'), category: 'frame', price: 90, booster: false },
  { ...frame('frame.mint', 'Мʼятна', '#4fd1a5', 'glow'), category: 'frame', price: 90, booster: false },
  { ...frame('frame.spin', 'Обертова', '#6b7cff', 'spin'), category: 'frame', price: 160, booster: true },
  { ...frame('frame.pulse', 'Пульс', '#ef6f9c', 'pulse'), category: 'frame', price: 160, booster: true },
  { ...frame('frame.ice', 'Крижана', '#6fc7ef', 'glow'), category: 'frame', price: 90, booster: false },
  { ...frame('frame.lime', 'Лаймова', '#a8e05f', 'glow'), category: 'frame', price: 90, booster: false },
  { ...frame('frame.coral', 'Коралова', '#ff7f6e', 'glow'), category: 'frame', price: 90, booster: false },
  { ...frame('frame.violet', 'Фіолетова', '#a77dff', 'glow'), category: 'frame', price: 110, booster: false },
  { ...frame('frame.silver', 'Срібна', '#c8d2e4', 'glow'), category: 'frame', price: 110, booster: false },
  { ...frame('frame.amberPulse', 'Бурштиновий пульс', '#f0a44a', 'pulse'), category: 'frame', price: 160, booster: true },
  { ...frame('frame.tealSpin', 'Бірюзовий оберт', '#3fc9c0', 'spin'), category: 'frame', price: 160, booster: true },
  { ...frame('frame.crimsonPulse', 'Багряний пульс', '#e0455f', 'pulse'), category: 'frame', price: 180, booster: true },

  // ── Вікна ──
  // Кожен стиль мусить читатися з першого погляду, тому вони різняться не
  // відтінком прозорості, а помітними речами: округлістю, товщиною рамки,
  // розмиттям і тінню. Раніше половина відрізнялась лише альфа-каналом —
  // на сайті це було майже непомітно, і здавалося, що річ нічого не робить.
  {
    ...card('card.glass', 'Скло', {
      bg: 'rgba(22,27,40,.30)', line: 'rgba(255,255,255,.12)', blur: 24, radius: 18, width: 1,
    }),
    category: 'card', price: 0, booster: false,
    hint: 'Сильне розмиття, майже прозорий фон — сторінка просвічує крізь вікна',
  },
  {
    ...card('card.dense', 'Щільні', {
      bg: 'rgba(9,12,20,.97)', line: 'rgba(255,255,255,.08)', blur: 0, radius: 12, width: 1,
    }),
    category: 'card', price: 80, booster: false,
    hint: 'Без розмиття, майже чорні — фон за ними не проглядає зовсім',
  },
  {
    ...card('card.outline', 'Контурні', {
      bg: 'rgba(8,11,19,.22)', line: 'rgba(255,255,255,.42)', blur: 6, radius: 16, width: 2,
    }),
    category: 'card', price: 80, booster: false,
    hint: 'Товста світла рамка й майже порожня середина',
  },
  {
    ...card('card.soft', 'Мʼякі', {
      bg: 'rgba(26,31,46,.80)', line: 'rgba(255,255,255,.05)', blur: 16, radius: 30, width: 1,
      shadow: '0 26px 70px rgba(0,0,0,.55)',
    }),
    category: 'card', price: 120, booster: false,
    hint: 'Дуже округлі кути й глибока мʼяка тінь — вікна ніби ширяють',
  },
  {
    ...card('card.sharp', 'Різкі', {
      bg: 'rgba(14,18,28,.90)', line: 'rgba(255,255,255,.20)', blur: 2, radius: 0, width: 1,
    }),
    category: 'card', price: 120, booster: false,
    hint: 'Прямі кути без жодного заокруглення',
  },
  {
    ...card('card.ghost', 'Примарні', {
      bg: 'rgba(255,255,255,.04)', line: 'rgba(255,255,255,.07)', blur: 30, radius: 22, width: 1,
    }),
    category: 'card', price: 120, booster: true,
    hint: 'Ледь помітні межі — лишається саме розмиття',
  },
  {
    ...card('card.neon', 'Неон', {
      bg: 'rgba(10,14,26,.86)', line: 'rgba(120,150,255,.75)', blur: 10, radius: 18, width: 2,
      shadow: '0 0 0 1px rgba(120,150,255,.18),0 0 34px rgba(90,120,255,.35)',
    }),
    category: 'card', price: 160, booster: true,
    hint: 'Світна рамка з холодним ореолом навколо вікон',
  },
  {
    ...card('card.paper', 'Папір', {
      bg: 'rgba(238,236,228,.10)', line: 'rgba(255,246,222,.34)', blur: 4, radius: 8, width: 1,
      shadow: '0 10px 26px rgba(0,0,0,.35)',
    }),
    category: 'card', price: 160, booster: true,
    hint: 'Теплий світлий відтінок і майже прямі кути',
  },
  {
    ...card('card.frame', 'У рамі', {
      bg: 'rgba(12,15,24,.90)', line: 'rgba(224,180,92,.65)', blur: 6, radius: 6, width: 3,
      shadow: '0 14px 40px rgba(0,0,0,.5)',
    }),
    category: 'card', price: 200, booster: true,
    hint: 'Товста золота обвідка, наче картина в рамі',
  },
];

/** Усе, що продається з каталогу: безкоштовний набір + поштучні речі. */
export const PACKS = [FREE_PACK, ...SINGLES];

/** Скільки своїх картинок можна тримати в кожній категорії. */
export const UPLOAD_LIMIT = 3;

/** Скільки ілюстрацій вміщає вітрина профілю. */
export const SHOWCASE_MAX = 6;

/**
 * Пласка мапа речей: id → {…річ, pack}.
 * Для поштучних речей «набором» є вони самі — так покупка й перевірка
 * володіння лишаються однією й тією ж дією для обох випадків.
 */
const ITEMS = new Map();
for (const it of FREE_PACK.items) ITEMS.set(it.id, { ...it, pack: FREE_PACK.id });
for (const it of SINGLES) ITEMS.set(it.id, { ...it, pack: it.id });
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

  CATEGORIES,
  UPLOAD_KINDS,
  categoryOfKind,
  FREE_PACK,

  /** Ціна речі: спершу з конфігу гільдії, потім із коду. */
  price(guildId, id) {
    const map = configService.get(guildId, 'shop.prices') ?? {};
    const own = Number(map?.[id]);
    if (Number.isFinite(own) && own >= 0) return Math.round(own);
    return BY_PACK.get(id)?.price ?? 0;
  },

  /** Чи потрібен буст: адміністратор може перевизначити позначку. */
  boosterOnly(guildId, id) {
    const map = configService.get(guildId, 'shop.booster') ?? {};
    if (typeof map?.[id] === 'boolean') return map[id];
    return !!BY_PACK.get(id)?.booster;
  },

  /** Каталог із актуальними цінами й позначками — саме це показує сторінка. */
  catalog(guildId) {
    return PACKS.map((p) => ({
      ...p,
      price: this.price(guildId, p.id),
      booster: this.boosterOnly(guildId, p.id),
    }));
  },

  async setPrice(guildId, id, value) {
    return this.setPrices(guildId, { [id]: value });
  },

  /**
   * Зберегти одразу кілька цін.
   *
   * Важливо саме однією дією: коли кожну ціну писали окремим запитом,
   * усі вони читали ту саму мапу й перезаписували одна одну — доїжджала
   * лише остання. Тому правки збираємо й пишемо разом.
   */
  async setPrices(guildId, values = {}) {
    const map = { ...(configService.get(guildId, 'shop.prices') ?? {}) };
    let touched = 0;
    for (const [id, value] of Object.entries(values)) {
      if (!BY_PACK.has(id)) continue;
      const n = Math.max(0, Math.round(Number(value) || 0));
      map[id] = n;
      touched++;
    }
    if (!touched) return false;
    await configService.set(guildId, 'shop.prices', map);
    return true;
  },

  /** Поставити або зняти позначку «лише для бустерів». */
  async setBoosterOnly(guildId, id, value) {
    return this.setBoosterFlags(guildId, { [id]: value });
  },

  /** Те саме пачкою — з тієї ж причини, що й ціни. */
  async setBoosterFlags(guildId, values = {}) {
    const map = { ...(configService.get(guildId, 'shop.booster') ?? {}) };
    let touched = 0;
    for (const [id, value] of Object.entries(values)) {
      if (!BY_PACK.has(id)) continue;
      map[id] = !!value;
      touched++;
    }
    if (!touched) return false;
    await configService.set(guildId, 'shop.booster', map);
    return true;
  },

  /**
   * Бустер — той, хто дав серверу хоч один буст.
   * Discord сам видає таким людям окрему роль; її id можна вказати в
   * налаштуваннях, і тоді перевірка працює навіть без кешу premiumSince.
   */
  isBooster(guildId, member) {
    if (!member) return false;
    // власник і ті, хто керує сервером, мають ті самі можливості, що й бустери:
    // інакше вони не можуть ані перевірити вітрину, ані щось на неї виставити
    if (member.id === OWNER_ID) return true;
    if (member.permissions?.has?.('ManageGuild')) return true;
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

  /**
   * Купити річ (або безкоштовний набір цілком).
   *
   * Окремий випадок — `asset:<id>`: це чужа робота з вітрини «Кастом».
   * Тоді гроші не зникають, а переходять авторові — саме заради цього
   * вітрина й існує.
   */
  async buy(guildId, userId, member, id) {
    if (String(id).startsWith('asset:')) return this.buyFromMarket(guildId, userId, id, member);

    const pack = BY_PACK.get(id);
    if (!pack) return { ok: false, reason: 'unknown' };
    // буст відкриває саме можливість купити, платити все одно доводиться
    if (this.boosterOnly(guildId, id) && !this.isBooster(guildId, member)) {
      return { ok: false, reason: 'booster' };
    }
    if (await itemsRepo.has(guildId, userId, id)) return { ok: false, reason: 'owned' };

    const price = this.price(guildId, id);
    if (price > 0 && !await walletRepo.spend(guildId, userId, price)) {
      return { ok: false, reason: 'funds' };
    }
    await itemsRepo.give(guildId, userId, id, price);
    const w = await walletRepo.get(guildId, userId);
    log.info(`${userId} отримав «${pack.name}» за ${price} FP`);
    return { ok: true, balance: w.balance, pack: id };
  },

  /** Покупка з вітрини учасників: FP переходять авторові роботи. */
  async buyFromMarket(guildId, userId, ref, member = null) {
    const assetId = Number(String(ref).slice(6));
    const a = await assetsRepo.meta(assetId);
    if (!a || a.guild_id !== guildId || !a.listed) return { ok: false, reason: 'unknown' };
    if (a.user_id === userId) return { ok: false, reason: 'owned' };
    // робота, закрита бустом, поводиться так само, як каталожна
    if (Number(a.booster ?? 0) && !this.isBooster(guildId, member)) {
      return { ok: false, reason: 'booster' };
    }
    if (await itemsRepo.has(guildId, userId, ref)) return { ok: false, reason: 'owned' };

    const price = Math.max(0, Number(a.price ?? 0));
    if (price > 0 && !await walletRepo.spend(guildId, userId, price)) {
      return { ok: false, reason: 'funds' };
    }
    await itemsRepo.give(guildId, userId, ref, price);
    if (price > 0) await walletRepo.add(guildId, a.user_id, price);
    await assetsRepo.addSale(assetId);

    const w = await walletRepo.get(guildId, userId);
    log.info(`${userId} купив роботу #${assetId} у ${a.user_id} за ${price} FP`);
    return { ok: true, balance: w.balance, pack: ref, author: a.user_id };
  },

  /** Виставити свою картинку на вітрину (або зняти звідти). */
  async listOnMarket(guildId, userId, member, { asset, price, title, listed = true, booster = null }) {
    if (!this.canUpload(guildId, member)) return { ok: false, reason: 'booster' };
    const a = await assetsRepo.meta(Number(asset));
    if (!a || a.guild_id !== guildId || a.user_id !== userId) return { ok: false, reason: 'not yours' };

    await assetsRepo.setListing(guildId, userId, a.id, {
      listed,
      price: Math.max(1, Math.round(Number(price) || 1)),   // безкоштовно роздавати нічого
      title: title ? String(title).slice(0, 60) : null,
      booster,
    });
    return { ok: true };
  },

  /**
   * Правка чужої роботи адміністратором: опис, ціна, буст, наявність
   * на вітрині. Каталожні речі правляться через конфіг гільдії, а робота
   * учасника живе в самій таблиці — тож і шлях у неї свій.
   */
  async editAsset(guildId, assetId, { title = null, price = null, booster = null, listed = null }) {
    const a = await assetsRepo.meta(Number(assetId));
    if (!a || a.guild_id !== guildId) return { ok: false, reason: 'not found' };

    await assetsRepo.edit(guildId, a.id, {
      title: title === null ? null : String(title).slice(0, 60),
      price: price === null ? null : Math.max(1, Math.round(Number(price) || 1)),
      booster,
      listed,
    });
    return { ok: true, asset: await assetsRepo.meta(a.id) };
  },

  /**
   * Видалити роботу назавжди.
   *
   * Її могли вже купити, тож просто стерти рядок не можна: у людей лишилися б
   * порожні рамки замість картинки й списані ні за що FP. Тому покупцям
   * повертаємо половину сплаченого, прибираємо річ з їхніх гаманців і знімаємо
   * її з оформлення. Авторові не повертаємо нічого — він продавав, а не купував.
   *
   * @returns {Promise<{ok:boolean, refunded:number, total:number, asset?:object}>}
   */
  async deleteAsset(guildId, assetId) {
    const a = await assetsRepo.meta(Number(assetId));
    if (!a || a.guild_id !== guildId) return { ok: false, refunded: 0, total: 0 };

    const ref = `asset:${a.id}`;
    const owners = await itemsRepo.owners(guildId, ref).catch(() => []);

    let refunded = 0;
    let total = 0;
    for (const o of owners) {
      if (o.user_id === a.user_id) continue;          // автор нічого не платив
      const back = Math.max(1, Math.floor(Number(o.price ?? 0) / 2));
      if (Number(o.price ?? 0) > 0) {
        await walletRepo.add(guildId, o.user_id, back).catch(() => {});
        total += back;
        refunded++;
      }
    }

    // прибираємо з оформлення в усіх, хто міг її носити, — разом з автором
    const touched = new Set([a.user_id, ...owners.map((o) => o.user_id)]);
    for (const uid of touched) await stripAsset(guildId, uid, a.id).catch(() => {});

    await itemsRepo.removeAll(guildId, ref).catch(() => {});
    await assetsRepo.removeById(guildId, a.id);

    log.info(`Роботу #${a.id} видалено; повернуто ${total} FP ${refunded} покупцям`);
    return { ok: true, refunded, total, asset: a };
  },

  /**
   * Роботи учасників, які можна купити. Кожна лягає в розділ за своїм
   * призначенням: фон — до фонів, банер — до банерів, ілюстрація — до
   * ілюстрацій. Окремого звалища «Кастом» більше немає.
   */
  async market(guildId, limit = 60) {
    const rows = await assetsRepo.market(guildId, limit).catch(() => []);
    return rows.map((a) => {
      const spec = UPLOAD_KINDS.find((k) => k.kind === a.kind) ?? UPLOAD_KINDS[0];
      return {
        id: `asset:${a.id}`,
        assetId: a.id,
        name: a.title || spec.name,
        kind: spec.kind,
        category: spec.category,
        price: Number(a.price ?? 0),
        // автор може закрити свою роботу бустом так само, як каталожну річ
        booster: !!Number(a.booster ?? 0),
        author: a.user_id,
        sales: Number(a.sales ?? 0),
        value: { type: 'image', url: `/asset/${a.id}` },
      };
    });
  },

  /**
   * Чи є в людини набір, до якого належить річ.
   *
   * Власник тут без жодних привілеїв: інакше в нього все виглядало б
   * купленим і він не бачив би магазин таким, яким його бачать інші.
   * Буст лише відкриває можливість КУПИТИ бустерське, а не дає його даром.
   */
  async ownsItem(guildId, userId, itemId) {
    // куплена чужа робота: володіння записане прямо за її посиланням
    if (String(itemId).startsWith('asset:')) {
      const assetId = Number(String(itemId).slice(6));
      const a = await assetsRepo.meta(assetId);
      if (a?.guild_id === guildId && a.user_id === userId) return true;   // своя ж
      return itemsRepo.has(guildId, userId, itemId);
    }
    const it = ITEMS.get(itemId);
    if (!it) return false;
    return itemsRepo.has(guildId, userId, it.pack);
  },

  /**
   * Вдягнути річ або зняти оформлення (порожнє значення).
   * Тип визначає, куди вона лягає: фон, акцент чи рамка аватара.
   */
  async equip(guildId, userId, itemId) {
    if (!itemId) return prefsRepo.save(guildId, userId, { background: null });

    // куплена чужа робота лягає туди ж, куди й своя картинка
    if (String(itemId).startsWith('asset:')) {
      if (!await this.ownsItem(guildId, userId, itemId)) return null;
      const a = await assetsRepo.meta(Number(String(itemId).slice(6)));
      const slot = a?.kind === 'banner' ? 'banner' : 'background';
      return prefsRepo.save(guildId, userId, { [slot]: itemId });
    }

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
  SHOWCASE_MAX,

  /**
   * Свої картинки заливають лише бустери й лише через магазин —
   * по одному FP за штуку, не більше трьох у кожній категорії.
   */
  canUpload(guildId, member) {
    return this.isBooster(guildId, member);
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
  uploadPrice(askPrice = 1) {
    const n = Math.max(1, Math.round(Number(askPrice) || 1));
    return Math.max(1, Math.ceil(n / 2));
  },

  /**
   * Оплатити публікацію. Гроші списуються лише коли місце є
   * і людина справді має право заливати.
   */
  async payUpload(guildId, userId, member, kind, askPrice = 1) {
    if (!this.canUpload(guildId, member)) return { ok: false, reason: 'booster' };
    if (!await this.uploadsLeft(guildId, userId, kind)) return { ok: false, reason: 'limit' };

    const listPrice = Math.max(1, Math.round(Number(askPrice) || 1));
    const price = this.uploadPrice(listPrice);
    if (!await walletRepo.spend(guildId, userId, price)) {
      return { ok: false, reason: 'funds' };
    }
    return { ok: true, price, listPrice };
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

    // своя картинка або куплена чужа — обидві дозволені
    const ref = `asset:${Number(asset)}`;
    if (!await this.ownsItem(guildId, userId, ref)) return { ok: false, reason: 'not yours' };

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

    // Вітрина ілюстрацій: беремо лише ті картинки, які людина справді має.
    const ids = Array.isArray(p.layout?.showcase) ? p.layout.showcase.slice(0, SHOWCASE_MAX) : [];
    const showcase = [];
    for (const id of ids) {
      const a = await assetsRepo.meta(Number(id)).catch(() => null);
      if (!a || a.guild_id !== guildId) continue;
      const ok = a.user_id === userId || await itemsRepo.has(guildId, userId, `asset:${a.id}`);
      if (!ok) continue;
      showcase.push({ id: a.id, url: `/asset/${a.id}`, title: a.title ?? '' });
    }

    return {
      about: p.about ?? '',
      banner: p.banner ?? null,
      bannerUrl: this.imageUrl(p.banner),
      showcase,
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
