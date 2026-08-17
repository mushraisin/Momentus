import http from 'node:http';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createLogger } from '../core/logger.js';
import { configService } from '../services/configService.js';
import { profileService } from '../services/profileService.js';
import { verificationService } from '../services/verificationService.js';
import {
  reputationRepo, sitePagesRepo, siteAssetsRepo, sessionsRepo, galleryRepo,
  cinemaRepo, cinemaQueueRepo, cinemaLogRepo, prefsRepo, assetsRepo, walletRepo,
} from '../database/repositories.js';
import { cosmeticsService } from '../services/cosmeticsService.js';
import { oauth, avatarUrl } from './oauth.js';
import { profileCard } from '../ui/cards.js';
import { parseMultipart, kindOf } from './multipart.js';
import { storage, extFor } from './storage.js';
import { discordStore, safeName } from './discordStore.js';
import { galleryChannelId, postToChannel } from '../services/galleryWatcher.js';
import { resolveSource } from './providers.js';
import { signUrl, handleStream } from './mediaProxy.js';
import { ytdlpAvailable } from './ytdlp.js';
import { OWNER_ID, ACCESS } from '../config/constants.js';
import { accessService } from '../services/accessService.js';
import { punishmentService, KIND_LABEL, WARN_LIMIT } from '../services/punishmentService.js';
import { modRepo, warnRepo } from '../database/repositories.js';
import { t, normalizeLang, langFromHeader } from '../i18n/index.js';
import * as R from './render.js';

const log = createLogger('web');

let server = null;
let clientRef = null;

/**
 * Ліміт завантаження. Якщо налаштовано канал-сховище — беремо ліміт Discord
 * (10/50/100 МБ залежно від бустів), інакше свідомо тиснемо, бо файл ляже в БД.
 */
const DB_MAX_UPLOAD_MB = Number(process.env.GALLERY_MAX_MB || 8);
const DAILY_UPLOADS = Number(process.env.GALLERY_DAILY_LIMIT || 10);

function maxUploadMb(guild) {
  if (discordStore.configured(guild.id)) return discordStore.uploadLimitMb(guild);
  if (storage.configured) return Math.max(DB_MAX_UPLOAD_MB, 25);
  return DB_MAX_UPLOAD_MB;
}

/**
 * Рівень доступу для сайту — той самий, що й у боті.
 * Сесія знає лише id, тож звіряємось із учасником гільдії.
 */
function accessLevel(guild, session) {
  if (!session) return ACCESS.MEMBER;
  if (session.user_id === OWNER_ID) return ACCESS.OWNER;
  const member = guild.members.cache.get(session.user_id);
  return member ? accessService.level(member) : ACCESS.MEMBER;
}

function isModerator(guild, session) {
  return accessLevel(guild, session) >= ACCESS.MODERATOR;
}

/** Власник бота або учасник із правами керування сервером. */
function isAdmin(guild, session) {
  if (!session) return false;
  if (session.user_id === OWNER_ID) return true;
  const member = guild.members.cache.get(session.user_id);
  return !!member?.permissions?.has?.('ManageGuild');
}

export function startWebServer(client) {
  clientRef = client;

  const port = Number(process.env.SERVER_PORT || process.env.WEB_PORT || 8080);
  if (String(process.env.WEB_DISABLED).toLowerCase() === 'true') {
    log.info('Веб-сайт вимкнено (WEB_DISABLED=true).');
    return null;
  }

  server = http.createServer((req, res) => {
    handle(req, res).catch((err) => {
      log.error('Помилка запиту', err.message);
      send(res, 500, 'text/html; charset=utf-8', R.errorPage(500, 'Внутрішня помилка'));
    });
  });

  server.listen(port, '0.0.0.0', () => {
    log.info(`Сайт запущено на порту ${port}${publicUrl() ? ` → ${publicUrl()}` : ''}`);
    const g = activeGuild();
    const where = g && discordStore.configured(g.id)
      ? `канал Discord (до ${discordStore.uploadLimitMb(g)} МБ на файл, обсяг безлімітний)`
      : storage.info;
    log.info(`Сховище медіа: ${where}`);
    ytdlpAvailable().then((ok) => {
      log.info(ok
        ? 'yt-dlp увімкнено — пряме відео витягується з більшості сайтів'
        : 'yt-dlp немає: сайти без прямого посилання показуватимуться рамкою');
    });
    if (storage.configured) {
      storage.check().then((r) => {
        if (!r.ok) log.warn(`S3/R2 недоступне: ${r.reason} — медіа зберігатиметься в БД`);
        else log.info('S3/R2 перевірено — запис і видалення працюють');
      });
    }
  });
  server.on('error', (err) => log.error('Сервер не стартував', err.message));

  setInterval(() => sessionsRepo.purgeExpired().catch(() => {}), 3600_000);
  return server;
}

export function stopWebServer() {
  server?.close();
  server = null;
}

function activeGuild() {
  const cache = clientRef?.guilds?.cache;
  if (!cache) return null;
  const id = process.env.WEB_GUILD_ID;
  if (id) return cache.get(id) ?? null;
  return [...cache.values()][0] ?? null;
}

function publicUrl() {
  return process.env.WEB_PUBLIC_URL?.replace(/\/$/, '') ?? '';
}

// ─────────────────────────────────────────────
//  Кеш каркаса сторінки
// ─────────────────────────────────────────────
/**
 * Перелік асетів і власних сторінок потрібен на кожен запит: перший — щоб
 * зрозуміти, чи це взагалі асет, другий — щоб зібрати меню. Обидва майже
 * ніколи не міняються, тож ходити по них у Turso щоразу — три мережеві
 * запити на кожну сторінку ще до того, як почнеться корисна робота.
 * Тримаємо їх коротко в пам'яті; правки з панелі власника доїжджають
 * за секунди, а сторінка перестає чекати на мережу.
 */
const SHELL_TTL = 20_000;
const shellCache = new Map(); // guildId → { at, assets:Set, pages:[] }

async function shellData(guildId) {
  const hit = shellCache.get(guildId);
  if (hit && Date.now() - hit.at < SHELL_TTL) return hit;

  const [assets, pages] = await Promise.all([
    siteAssetsRepo.list(guildId).catch(() => []),
    sitePagesRepo.list(guildId).catch(() => []),
  ]);
  const fresh = { at: Date.now(), assets: new Set(assets.map((a) => a.path)), pages };
  shellCache.set(guildId, fresh);
  return fresh;
}

async function hasAsset(guildId, path) {
  return (await shellData(guildId)).assets.has(path);
}

/** Скинути кеш після правок із панелі власника — щоб не чекати TTL. */
export function invalidateShellCache(guildId = null) {
  if (guildId) shellCache.delete(guildId);
  else shellCache.clear();
}

// ─────────────────────────────────────────────
//  Власні скрипти замість чужого CDN
// ─────────────────────────────────────────────
/**
 * hls.js роздаємо самі. Раніше плеєр тягнув його з jsdelivr: варто тому лягти
 * чи бути заблокованим — і будь-який стрім у залі просто не запускався.
 * Тепер файл їде з тієї ж машини, що й сайт, і живе стільки ж, скільки бот.
 * YouTube і Vimeo так не перенести — їхні API працюють лише зі свого домену.
 */
let hlsBundle = null; // { body:Buffer } | false — немає

function hlsFile() {
  if (hlsBundle !== null) return hlsBundle;
  try {
    const path = createRequire(import.meta.url).resolve('hls.js/dist/hls.min.js');
    hlsBundle = { body: fs.readFileSync(path) };
    log.info(`hls.js роздається локально (${(hlsBundle.body.length / 1024).toFixed(0)} КБ)`);
  } catch (err) {
    hlsBundle = false;
    log.warn('hls.js не знайдено в залежностях — плеєр візьме його з CDN', err.message);
  }
  return hlsBundle;
}

// ─────────────────────────────────────────────
//  Маршрутизація
// ─────────────────────────────────────────────
async function handle(req, res) {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const guild = activeGuild();

  if (!guild) {
    return send(res, 503, 'text/html; charset=utf-8', R.errorPage(503, 'Бот ще не підключився.'));
  }

  const token = readCookie(req, 'sid');
  const session = await oauth.session(token);

  // ── мова: ?lang= → cookie → браузер → конфіг ──
  let lang = normalizeLang(
    url.searchParams.get('lang')
    ?? readCookie(req, 'lang')
    ?? langFromHeader(req.headers['accept-language'])
    ?? configService.get(guild.id, 'general.locale'),
  );
  const setLangCookie = url.searchParams.has('lang')
    ? `lang=${lang}; Path=/; Max-Age=${365 * 24 * 3600}; SameSite=Lax${isSecure(req) ? '; Secure' : ''}`
    : null;
  if (setLangCookie) {
    // Після вибору мови повертаємось на ту саму сторінку без ?lang, але з
    // рештою параметрів: інакше вибір мови збивав сортування галереї.
    const rest = new URLSearchParams(url.searchParams);
    rest.delete('lang');
    const back = rest.size ? `${path}?${rest}` : path;
    res.writeHead(302, { Location: back, 'Set-Cookie': setLangCookie });
    return res.end();
  }

  // ── асети з БД ──
  // Спершу звіряємось із кешем шляхів: інакше кожен запит до сайту — навіть
  // /api/* і /media/* — тягнув окремий похід у Turso по той самий асет.
  if (await hasAsset(guild.id, path)) {
    const asset = await siteAssetsRepo.get(guild.id, path).catch(() => null);
    if (asset) {
      const buf = asset.encoding === 'base64' ? Buffer.from(asset.content, 'base64') : Buffer.from(asset.content, 'utf8');
      res.writeHead(200, { 'Content-Type': asset.mime, 'Cache-Control': 'public, max-age=300' });
      return res.end(buf);
    }
  }

  // ── авторизація ──
  if (path === '/login') {
    if (!oauth.configured) {
      return html(res, 500, guild, session, lang, path, t(lang, 'nav.login'), R.errorPage(500, t(lang, 'err.oauth'), lang));
    }
    // запам'ятовуємо сторінку, з якої почався вхід
    const ret = safePath(url.searchParams.get('next')) ?? safePath(refPath(req)) ?? '/';
    res.writeHead(302, {
      Location: oauth.authorizeUrl(`${publicUrl() || originOf(req)}/callback`),
      'Set-Cookie': `ret=${encodeURIComponent(ret)}; Path=/; SameSite=Lax; Max-Age=600`,
    });
    return res.end();
  }

  if (path === '/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !oauth.validState(state)) {
      return html(res, 400, guild, session, lang, path, 'OAuth', R.errorPage(400, 'Невірний запит.', lang));
    }
    const sid = await oauth.completeLogin(code, `${publicUrl() || originOf(req)}/callback`, guild.id);
    if (!sid) return html(res, 401, guild, session, lang, path, 'OAuth', R.errorPage(401, 'Не вдалося увійти.', lang));

    // повертаємось туди, звідки натиснули «Вхід» (за замовчуванням — на головну),
    // щоб одразу було видно, що ти залогінений
    const backTo = safePath(readCookie(req, 'ret')) ?? '/';
    const secure = isSecure(req) ? ' Secure;' : '';
    res.writeHead(302, {
      Location: backTo,
      'Set-Cookie': [
        `sid=${sid}; HttpOnly;${secure} Path=/; SameSite=Lax; Max-Age=${7 * 24 * 3600}`,
        'ret=; Path=/; Max-Age=0',
      ],
    });
    return res.end();
  }

  if (path === '/logout') {
    await oauth.logout(token);
    res.writeHead(302, { Location: '/', 'Set-Cookie': 'sid=; HttpOnly; Path=/; Max-Age=0' });
    return res.end();
  }

  // ── медіа галереї ──
  if (path.startsWith('/media/')) {
    const id = Number(path.slice(7).replace(/[^0-9]/g, ''));
    const meta = id ? await galleryRepo.meta(id) : null;
    if (!meta || meta.guild_id !== guild.id) return send(res, 404, 'text/plain', 'not found');

    // файл у S3/R2 — просто перенаправляємо на CDN
    if (meta.storage === 's3' && meta.url) {
      res.writeHead(302, { Location: meta.url, 'Cache-Control': 'public, max-age=3600' });
      return res.end();
    }

    // файл у Discord — посилання підписане й протухає, за потреби беремо свіже
    if (meta.storage === 'discord') {
      let url = meta.url;
      const expires = Number(meta.url_expires ?? 0);
      if (!url || expires - 60_000 < Date.now()) {
        const fresh = await discordStore.refresh(guild, meta.object_key).catch(() => null);
        if (!fresh) return send(res, 404, 'text/plain', 'media gone');
        await galleryRepo.refreshUrl(id, fresh.url, fresh.expires);
        url = fresh.url;
      }
      res.writeHead(302, { Location: url, 'Cache-Control': 'private, max-age=600' });
      return res.end();
    }

    const item = await galleryRepo.getFull(id);
    const buf = Buffer.from(item.content, 'base64');
    res.writeHead(200, {
      'Content-Type': item.mime,
      'Content-Length': buf.length,
      'Cache-Control': 'public, max-age=86400, immutable',
    });
    return res.end(buf);
  }

  // ── лайк ──
  if (path.startsWith('/api/like/') && req.method === 'POST') {
    if (!session) return json(res, 401, { error: 'auth' });
    const id = Number(path.slice(10).replace(/[^0-9]/g, ''));
    const item = id ? await galleryRepo.meta(id) : null;
    if (!item || item.guild_id !== guild.id) return json(res, 404, { error: 'not found' });
    const out = await galleryRepo.toggleLike(id, session.user_id);
    return json(res, 200, out);
  }

  // ── редагування та видалення публікації ──
  // Правити може адміністратор; автор — лише власний підпис.
  if (path.startsWith('/api/item/') && req.method === 'POST') {
    if (!session) return json(res, 401, { error: 'auth' });
    const [rawId, action] = path.slice(10).split('/');
    const id = Number(String(rawId).replace(/[^0-9]/g, ''));
    const item = id ? await galleryRepo.meta(id) : null;
    if (!item || item.guild_id !== guild.id) return json(res, 404, { error: 'not found' });

    const admin = isAdmin(guild, session);
    const owns = item.user_id === session.user_id;
    if (!admin && !owns) return json(res, 403, { error: 'forbidden' });

    if (action === 'delete') {
      if (!admin) return json(res, 403, { error: 'forbidden' });
      if (item.storage === 'discord') await discordStore.remove(guild, item.object_key).catch(() => {});
      if (item.storage === 's3') await storage.remove(item.object_key).catch(() => {});
      await galleryRepo.remove(id);
      log.info(`Галерея: ${session.username} видалив публікацію #${id}`);
      return json(res, 200, { ok: true, deleted: true });
    }

    const body = await readJson(req).catch(() => null);
    const title = String(body?.title ?? '').slice(0, 120).trim();
    await galleryRepo.updateTitle(id, title);
    return json(res, 200, { ok: true, title });
  }

  // ── картинка для прев'ю посилання на профіль ──
  // Малюємо тим самим рендером, що й картки в Discord, тож нічого нового вчити не треба.
  if (path.startsWith('/og/u/')) {
    const userId = path.slice(6).replace(/[^0-9]/g, '');
    const png = userId ? await ogProfileImage(guild, userId).catch(() => null) : null;
    if (!png) return send(res, 404, 'text/plain', 'not found');
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': png.length,
      'Cache-Control': 'public, max-age=600',
    });
    return res.end(png);
  }

  // ── маніфест: сайт можна поставити як застосунок ──
  if (path === '/manifest.webmanifest') {
    return send(res, 200, 'application/manifest+json; charset=utf-8', JSON.stringify({
      name: guild.name,
      short_name: 'Моментус',
      start_url: '/',
      display: 'standalone',
      background_color: '#05070d',
      theme_color: '#05070d',
      icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    }));
  }

  // ── іконка вкладки ──
  if (path === '/favicon.svg' || path === '/favicon.ico') {
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=604800',
    });
    return res.end(R.FAVICON);
  }

  // ── власні скрипти ──
  if (path === '/vendor/hls.min.js') {
    const file = hlsFile();
    if (!file) return send(res, 404, 'text/plain', 'not found');
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': file.body.length,
      // версія прибита в package.json, тож вміст за цією адресою не змінюється
      'Cache-Control': 'public, max-age=604800, immutable',
    });
    return res.end(file.body);
  }

  // ── проксі медіа (підписані посилання) ──
  if (path === '/stream') return handleStream(req, res, url);

  // ── модерація ──
  // Сторінка й дії закриті рівнем доступу, а не лише схованою кнопкою:
  // прямим посиланням сюди теж не зайти.
  if (path === '/mod') {
    if (!session) {
      res.writeHead(302, { Location: '/login?next=%2Fmod' });
      return res.end();
    }
    if (!isModerator(guild, session)) {
      return html(res, 403, guild, session, lang, path, '403', R.errorPage(403, t(lang, 'mod.denied'), lang));
    }
    return renderMod(res, guild, session, lang, path);
  }

  if (path.startsWith('/api/mod/') && req.method === 'POST') {
    return modApi(req, res, guild, session, path.slice(9));
  }

  // ── магазин косметики ──
  if (path === '/shop') {
    if (!session) {
      res.writeHead(302, { Location: '/login?next=%2Fshop' });
      return res.end();
    }
    return renderShop(res, guild, session, lang, path);
  }
  if (path.startsWith('/api/shop/') && req.method === 'POST') {
    return shopApi(req, res, guild, session, path.slice(10));
  }
  if (path === '/api/profile' && req.method === 'POST') {
    return profileApi(req, res, guild, session);
  }
  if (path === '/api/profile/asset' && req.method === 'POST') {
    return assetUpload(req, res, guild, session);
  }

  // ── власні картинки оформлення (лежать у приватному каналі) ──
  if (path.startsWith('/asset/')) {
    const id = Number(path.slice(7).replace(/[^0-9]/g, ''));
    const meta = id ? await assetsRepo.meta(id) : null;
    if (!meta || meta.guild_id !== guild.id) return send(res, 404, 'text/plain', 'not found');

    let url = meta.url;
    const expires = Number(meta.url_expires ?? 0);
    if (!url || expires - 60_000 < Date.now()) {
      const fresh = await discordStore.refresh(guild, meta.object_key).catch(() => null);
      if (!fresh) return send(res, 404, 'text/plain', 'gone');
      await assetsRepo.refreshUrl(id, fresh.url, fresh.expires);
      url = fresh.url;
    }
    res.writeHead(302, { Location: url, 'Cache-Control': 'private, max-age=600' });
    return res.end();
  }

  // ── пошук учасників для вибору (без вписування ID) ──
  if (path === '/api/members') {
    if (!isModerator(guild, session)) return json(res, 403, { error: 'forbidden' });
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const me = session?.user_id;

    const list = [...guild.members.cache.values()]
      .filter((m) => !m.user?.bot && m.id !== me)
      .filter((m) => !q
        || m.displayName?.toLowerCase().includes(q)
        || m.user?.username?.toLowerCase().includes(q))
      .slice(0, 25)
      .map((m) => ({
        id: m.id,
        name: m.displayName ?? m.user?.username ?? m.id,
        tag: m.user?.username ?? '',
        avatar: m.user?.displayAvatarURL?.({ extension: 'png', size: 64 }) ?? avatarUrl(m.id, null, 64),
      }));

    return json(res, 200, { members: list });
  }

  // ── кінотеатр ──
  if (path === '/cinema') return renderCinema(res, guild, session, lang, path, hostOf(req));
  if (path === '/api/cinema/state') return json(res, 200, await cinemaState(guild, session));
  if (path.startsWith('/api/cinema/') && req.method === 'POST') {
    return cinemaAction(req, res, guild, session, path.slice(12));
  }

  // ── завантаження ──
  if (path === '/upload' && req.method === 'POST') {
    return handleUpload(req, res, guild, session, lang);
  }

  // ── галерея ──
  if (path === '/gallery') {
    const sort = url.searchParams.get('sort') === 'top' ? 'top' : 'new';
    return renderGallery(res, guild, session, lang, path, url.searchParams.get('e'), sort);
  }

  // ── свій профіль ──
  if (path === '/me') {
    if (!session) {
      res.writeHead(302, { Location: '/login' });
      return res.end();
    }
    return renderProfile(res, guild, session, lang, path, session.user_id);
  }

  if (path.startsWith('/u/')) {
    const userId = path.slice(3).replace(/[^0-9]/g, '');
    if (!userId) return html(res, 404, guild, session, lang, path, '404', R.errorPage(404, t(lang, 'err.404'), lang));
    return renderProfile(res, guild, session, lang, path, userId);
  }

  if (path === '/api/leaderboard') {
    return json(res, 200, await topRows(guild, 100));
  }

  if (path === '/') {
    return send(res, 200, 'text/html; charset=utf-8', R.landingLayout({
      lang,
      session,
      // кнопку модерації показуємо лише тим, хто має доступ
      mod: isModerator(guild, session),
      og: ogFor(guild, '/', null, 'Профілі, галерея та спільний перегляд'),
    }));
  }

  if (path === '/top') {
    const rows = await topRows(guild, 50);
    return html(res, 200, guild, session, lang, path, t(lang, 'top.title'), R.leaderboardPage(rows, lang));
  }

  // Список опублікованих сторінок уже лежить у кеші каркаса — окремий запит
  // на кожен невідомий шлях (а це всі 404) більше не потрібен.
  const custom = (await shellData(guild.id)).pages.find((p) => p.slug === path.slice(1)) ?? null;
  if (custom && custom.published) {
    return html(res, 200, guild, session, lang, path, custom.title, R.customPage(custom));
  }

  return html(res, 404, guild, session, lang, path, '404', R.errorPage(404, t(lang, 'err.404'), lang));
}

// ─────────────────────────────────────────────
//  Галерея
// ─────────────────────────────────────────────
async function renderGallery(res, guild, session, lang, path, errKey, sort = 'new') {
  const items = await galleryRepo.list(guild.id, { limit: 90, sort });
  const [dayTop] = await galleryRepo.top(guild.id, 86400_000, 1);
  const [monthTop] = await galleryRepo.top(guild.id, 30 * 86400_000, 1);

  const all = [...items, dayTop, monthTop].filter(Boolean);
  const liked = await galleryRepo.likedBy(session?.user_id, all.map((i) => Number(i.id)));
  const stats = await galleryRepo.stats(guild.id);
  const maxMb = maxUploadMb(guild);

  // Свіжий аватар із кешу учасників; якщо людина пішла — той, що збережений при публікації.
  const avatars = {};
  for (const it of all) {
    const m = guild.members.cache.get(it.user_id);
    avatars[it.user_id] = avatarUrl(it.user_id, m?.user?.avatar ?? it.avatar ?? null, 64);
  }

  const errors = {
    big: t(lang, 'gal.tooLarge', { mb: maxMb }),
    type: t(lang, 'gal.badType'),
    rate: t(lang, 'gal.rateLimit', { n: DAILY_UPLOADS }),
    auth: t(lang, 'gal.needAuth'),
  };

  const where = discordStore.configured(guild.id) ? 'Discord' : (storage.configured ? 'R2' : 'DB');

  // Якщо галерея живе з Discord-каналу — форму на сайті не показуємо,
  // натомість пояснюємо, куди кидати медіа.
  const srcId = galleryChannelId(guild.id);
  const srcChannel = srcId ? (guild.channels.cache.get(srcId) ?? null) : null;

  const body = R.galleryPage({
    items,
    dayTop,
    monthTop,
    liked,
    avatars,
    session,
    fromChannel: srcId ? { id: srcId, name: srcChannel?.name ?? '—' } : null,
    admin: isAdmin(guild, session),
    lang,
    sort,
    maxMb,
    stats: { ...stats, where },
    cinema: !!configService.get(guild.id, 'cinema.enabled'),
    error: errKey ? errors[errKey] : null,
  });

  // Сортування несемо в перемикач мов, щоб вибір мови не збивав стрічку.
  return html(res, 200, guild, session, lang, path, t(lang, 'gal.title'), body, true,
    null, null, null, sort === 'top' ? 'sort=top' : '');
}

async function handleUpload(req, res, guild, session, lang) {
  const back = (e) => {
    res.writeHead(302, { Location: `/gallery${e ? `?e=${e}` : ''}` });
    res.end();
  };

  if (!session) return back('auth');

  const recent = await galleryRepo.recentByUser(guild.id, session.user_id);
  if (recent >= DAILY_UPLOADS) return back('rate');

  const maxBytes = maxUploadMb(guild) * 1024 * 1024;

  let parsed;
  try {
    parsed = await parseMultipart(req, { maxBytes });
  } catch (err) {
    return back(err.message === 'TOO_LARGE' ? 'big' : 'type');
  }

  const file = parsed.file;
  if (!file || !file.data?.length) return back('type');

  const kind = kindOf(file.mime);
  if (!kind) return back('type');
  if (file.data.length > maxBytes) return back('big');

  const title = (parsed.fields.title ?? '').slice(0, 120).trim() || null;
  const base = {
    guildId: guild.id,
    userId: session.user_id,
    username: session.username,
    avatar: session.avatar ?? null,
    title,
    kind,
    mime: file.mime,
    sizeBytes: file.data.length,
  };
  const mb = (file.data.length / 1048576).toFixed(2);

  // 0) Приватний канал-сховище: усе, залите через сайт, лягає туди.
  // Місця фактично безліміт, а канал закритий — це не вітрина, а склад.
  if (discordStore.configured(guild.id)) {
    try {
      const name = safeName(title ?? kind, extFor(file.mime));
      const { key, url, expires } = await discordStore.put(guild, file.data, name);
      await galleryRepo.add({ ...base, storage: 'discord', objectKey: key, url, urlExpires: expires });
      log.info(`Галерея → сховище: ${session.username}, ${kind}, ${mb} MB`);
      return back(null);
    } catch (err) {
      log.warn('Заливка в канал-сховище не вдалася — пробую далі', err.message);
    }
  }

  // 1) Сховища немає — тоді запасний варіант: канал галереї.
  if (galleryChannelId(guild.id)) {
    try {
      const { key, url, expires } = await postToChannel(guild, {
        buffer: file.data,
        filename: safeName(title ?? kind, extFor(file.mime)),
        authorName: session.username ?? 'учасник',
        caption: title,
      });
      await galleryRepo.add({ ...base, storage: 'discord', objectKey: key, url, urlExpires: expires });
      log.info(`Галерея → канал: ${session.username}, ${kind}, ${mb} MB`);
      return back(null);
    } catch (err) {
      log.warn('Не вдалося покласти файл у канал галереї — пробую далі', err.message);
    }
  }

  // 2) Об'єктне сховище S3/R2.
  if (storage.configured) {
    try {
      const key = `${guild.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extFor(file.mime)}`;
      const { url } = await storage.put(key, file.data, file.mime);
      await galleryRepo.add({ ...base, storage: 's3', objectKey: key, url });
      log.info(`Галерея → R2: ${session.username}, ${kind}, ${mb} MB`);
      return back(null);
    } catch (err) {
      log.warn('Завантаження в S3 не вдалося — зберігаю в БД', err.message);
    }
  }

  // 3) Останній фолбек — БД.
  await galleryRepo.add({ ...base, storage: 'db', content: file.data.toString('base64') });
  log.info(`Галерея → БД: ${session.username}, ${kind}, ${mb} MB`);
  return back(null);
}

// ─────────────────────────────────────────────
//  Магазин косметики
// ─────────────────────────────────────────────
async function renderShop(res, guild, session, lang, path) {
  const member = guild.members.cache.get(session.user_id)
    ?? await guild.members.fetch(session.user_id).catch(() => null);

  const wallet = await cosmeticsService.wallet(guild.id, session.user_id);
  const owned = await cosmeticsService.owned(guild.id, session.user_id);

  // Вітрина «Кастом» — роботи учасників; імена авторів беремо з кешу гільдії.
  const market = await cosmeticsService.market(guild.id);
  const authors = {};
  for (const m of market) {
    const mem = guild.members.cache.get(m.author);
    authors[m.author] = mem?.displayName ?? m.author;
  }

  const body = R.shopPage({
    items: cosmeticsService.catalog(guild.id),
    categories: cosmeticsService.CATEGORIES,
    market,
    authors,
    owned,
    booster: cosmeticsService.isBooster(guild.id, member),
    admin: isAdmin(guild, session),
    balance: wallet.balance,
    uploadLimit: cosmeticsService.UPLOAD_LIMIT,
    uploads: {
      background: await cosmeticsService.uploadsLeft(guild.id, session.user_id, 'background'),
      banner: await cosmeticsService.uploadsLeft(guild.id, session.user_id, 'banner'),
    },
    // свої роботи — щоб можна було виставити їх на вітрину прямо тут
    mine: (await assetsRepo.list(guild.id, session.user_id, null, 24)).map((a) => ({
      id: a.id, kind: a.kind, url: `/asset/${a.id}`,
      title: a.title ?? '', price: Number(a.price ?? 0), listed: !!a.listed, sales: Number(a.sales ?? 0),
    })),
    lang,
  });
  return html(res, 200, guild, session, lang, path, t(lang, 'shop.title'), body, false, 'shop');
}

async function shopApi(req, res, guild, session, action) {
  if (!session) return json(res, 401, { error: 'auth' });
  // Учасника може не бути в кеші — це не привід відмовляти:
  // без нього просто вважаємо, що бусту немає.
  const member = guild.members.cache.get(session.user_id)
    ?? await guild.members.fetch(session.user_id).catch(() => null);

  const body = await readJson(req).catch(() => ({}));
  const itemId = String(body.item ?? '').slice(0, 60);

  if (action === 'buy') {
    const r = await cosmeticsService.buy(guild.id, session.user_id, member, itemId);
    if (!r.ok) return json(res, 400, { error: r.reason });
    // Одразу віддаємо, що саме відкрилось — сторінка перемальовує картку
    // на місці, без перезавантаження.
    const pack = cosmeticsService.pack(itemId);
    return json(res, 200, {
      ok: true,
      balance: r.balance,
      pack: itemId,
      items: (pack?.items ?? []).map((i) => ({ id: i.id, name: i.name, kind: i.kind, value: i.value })),
    });
  }

  if (action === 'equip') {
    const saved = await cosmeticsService.equip(guild.id, session.user_id, itemId || null);
    if (saved === null) return json(res, 400, { error: 'not owned' });
    const look = await cosmeticsService.look(guild.id, session.user_id);
    return json(res, 200, { ok: true, look });
  }

  if (action === 'clear') {
    await cosmeticsService.clear(guild.id, session.user_id, String(body.what ?? 'background'));
    const look = await cosmeticsService.look(guild.id, session.user_id);
    return json(res, 200, { ok: true, look });
  }

  // виставити свою роботу на вітрину «Кастом» (або зняти звідти)
  if (action === 'list') {
    const r = await cosmeticsService.listOnMarket(guild.id, session.user_id, member, {
      asset: body.asset,
      price: body.price,
      title: body.title,
      listed: body.listed !== false,
    });
    if (!r.ok) return json(res, r.reason === 'booster' ? 403 : 400, { error: r.reason });
    return json(res, 200, { ok: true });
  }

  // ціни й позначки править лише адміністратор
  if (action === 'price') {
    if (!isAdmin(guild, session)) return json(res, 403, { error: 'forbidden' });
    const ok = await cosmeticsService.setPrice(guild.id, itemId, body.price);
    if (!ok) return json(res, 400, { error: 'unknown' });
    return json(res, 200, { ok: true, price: cosmeticsService.price(guild.id, itemId) });
  }

  if (action === 'flag') {
    if (!isAdmin(guild, session)) return json(res, 403, { error: 'forbidden' });
    const ok = await cosmeticsService.setBoosterOnly(guild.id, itemId, body.booster);
    if (!ok) return json(res, 400, { error: 'unknown' });
    return json(res, 200, { ok: true, booster: cosmeticsService.boosterOnly(guild.id, itemId) });
  }

  // Усі ціни одним запитом: окремі запити перезаписували мапу одне одному,
  // і доїжджала лише остання правка.
  if (action === 'prices') {
    if (!isAdmin(guild, session)) return json(res, 403, { error: 'forbidden' });
    await cosmeticsService.setPrices(guild.id, body.prices ?? {});
    if (body.booster) await cosmeticsService.setBoosterFlags(guild.id, body.booster);

    const catalog = cosmeticsService.catalog(guild.id);
    return json(res, 200, {
      ok: true,
      items: catalog.map((p) => ({ id: p.id, price: p.price, booster: p.booster })),
    });
  }

  return json(res, 404, { error: 'unknown' });
}

/**
 * Власна сторінка: опис, банер, порядок блоків.
 * Опис і порядок доступні всім — це базова персоналізація, а не товар.
 * Картинки (банер, власне тло) беруться лише зі свого: або з галереї,
 * або із завантажених у приватний канал.
 */
async function profileApi(req, res, guild, session) {
  if (!session) return json(res, 401, { error: 'auth' });

  const body = await readJson(req).catch(() => ({}));
  const patch = {};

  if (body.about !== undefined) patch.about = String(body.about).slice(0, 400);

  // Де показувати оформлення: на всьому сайті чи лише у своєму профілі.
  if (body.scope !== undefined) {
    const cur = await prefsRepo.get(guild.id, session.user_id);
    const scope = { ...(cur.layout?.scope ?? {}) };
    for (const part of ['background', 'accent', 'card']) {
      if (body.scope[part] === undefined) continue;
      scope[part] = body.scope[part] ? 'site' : 'profile';
    }
    patch.layout = { ...(cur.layout ?? {}), scope };
  }

  // Які блоки сховані на своїй сторінці.
  if (body.hidden !== undefined) {
    const cur = await prefsRepo.get(guild.id, session.user_id);
    const hiddenNow = { ...(cur.layout?.hidden ?? {}) };
    for (const block of ['chart', 'showcase', 'about']) {
      if (body.hidden[block] === undefined) continue;
      if (body.hidden[block]) hiddenNow[block] = true;
      else delete hiddenNow[block];
    }
    patch.layout = { ...(patch.layout ?? cur.layout ?? {}), hidden: hiddenNow };
  }

  // Вітрина ілюстрацій: список своїх (або куплених) картинок.
  if (body.showcase !== undefined) {
    const cur = await prefsRepo.get(guild.id, session.user_id);
    const ids = Array.isArray(body.showcase) ? body.showcase.map(Number).filter(Boolean) : [];
    const allowed = [];
    for (const id of ids.slice(0, cosmeticsService.SHOWCASE_MAX)) {
      if (await cosmeticsService.ownsItem(guild.id, session.user_id, `asset:${id}`)) allowed.push(id);
    }
    patch.layout = { ...(patch.layout ?? cur.layout ?? {}), showcase: allowed };
  }

  if (body.layout !== undefined) {
    // лишаємо тільки відомі блоки, щоб у налаштування не потрапило чуже
    const known = ['about', 'chart', 'stats', 'gallery'];
    const order = Array.isArray(body.layout) ? body.layout.filter((k) => known.includes(k)) : [];
    const cur = await prefsRepo.get(guild.id, session.user_id);
    // Спираємось на patch.layout, а не лише на збережене: інакше порядок блоків
    // в одному запиті з «сховати блок» чи «вітрина» стирав ті зміни.
    patch.layout = { ...(patch.layout ?? cur.layout ?? {}), order: [...new Set(order)] };
  }

  // банер і власне тло — лише із завантажених картинок (приватний канал)
  for (const slot of ['banner', 'background']) {
    if (body[slot] === undefined) continue;
    const r = await cosmeticsService.setOwnImage(guild.id, session.user_id, {
      slot, asset: body[slot] || null,
    });
    if (!r.ok) return json(res, r.reason === 'locked' ? 403 : 400, { error: r.reason });
  }

  if (Object.keys(patch).length) await prefsRepo.save(guild.id, session.user_id, patch);
  const look = await cosmeticsService.look(guild.id, session.user_id);
  return json(res, 200, { ok: true, look });
}

/**
 * Завантаження власної картинки для оформлення.
 * Файл лягає в приватний канал-сховище Discord — у базі лишається посилання.
 */
async function assetUpload(req, res, guild, session) {
  if (!session) return json(res, 401, { error: 'auth' });
  if (!discordStore.configured(guild.id)) return json(res, 503, { error: 'no storage' });

  const member = guild.members.cache.get(session.user_id)
    ?? await guild.members.fetch(session.user_id).catch(() => null);

  // parseMultipart приймає опції обʼєктом і повертає один file, а не масив —
  // саме через це заливка мовчки падала
  const form = await parseMultipart(req, { maxBytes: maxUploadMb(guild) * 1048576 })
    .catch((e) => { log.warn('Розбір форми не вдався', e.message); return null; });
  const file = form?.file;
  if (!file) return json(res, 400, { error: 'no file' });
  if (kindOf(file.mime) !== 'image') return json(res, 400, { error: 'image only' });

  const kind = String(form.fields?.slot) === 'banner' ? 'banner' : 'background';
  // Автор одразу каже, за скільки продаватиме роботу; за публікацію
  // платить половину від цієї суми.
  const askPrice = Math.max(1, Math.round(Number(form.fields?.price) || 1));
  const title = String(form.fields?.title ?? '').slice(0, 60);

  // Платимо перед заливкою: так не буває картинки, за яку не списано,
  // і не буває списання за картинку, яка не долетіла.
  const paid = await cosmeticsService.payUpload(guild.id, session.user_id, member, kind, askPrice);
  if (!paid.ok) return json(res, paid.reason === 'booster' ? 403 : 400, { error: paid.reason });

  const name = safeName(`${kind}-${session.user_id}`, extFor(file.mime));
  let stored;
  try {
    stored = await discordStore.put(guild, file.data, name);
  } catch (err) {
    // не долетіло — повертаємо гроші
    await walletRepo.add(guild.id, session.user_id, paid.price);
    log.warn('Заливка оформлення не вдалася', err.message);
    return json(res, 502, { error: 'upload' });
  }

  const id = await assetsRepo.add(guild.id, session.user_id, {
    kind,
    mime: file.mime,
    sizeBytes: file.data.length,
    objectKey: stored.key,
    url: stored.url,
    urlExpires: stored.expires,
  });
  // Залите одразу стає активним — людина платила саме за те, щоб це побачити,
  // і одразу ж потрапляє на вітрину за призначеною ціною.
  await cosmeticsService.setOwnImage(guild.id, session.user_id, { slot: kind, asset: id });
  await assetsRepo.setListing(guild.id, session.user_id, id, {
    listed: true, price: paid.listPrice, title: title || null,
  });

  const wallet = await cosmeticsService.wallet(guild.id, session.user_id);
  log.info(`Оформлення → сховище: ${session.username ?? session.user_id}, ${kind}, ${(file.data.length / 1048576).toFixed(2)} MB`);
  return json(res, 200, {
    ok: true, id, kind, balance: wallet.balance,
    left: await cosmeticsService.uploadsLeft(guild.id, session.user_id, kind),
    look: await cosmeticsService.look(guild.id, session.user_id),
  });
}

// ─────────────────────────────────────────────
//  Модерація
// ─────────────────────────────────────────────
async function renderMod(res, guild, session, lang, path) {
  const level = accessLevel(guild, session);
  const active = await punishmentService.forGuild(guild.id, 60);
  const warns = await warnRepo.counts(guild.id).catch(() => []);
  const journal = await modRepo.recent(guild.id, 60).catch(() => []);

  // імена й аватари підтягуємо з кешу учасників
  const who = {};
  for (const id of new Set([
    ...active.map((p) => p.userId),
    ...warns.map((w) => w.userId),
    ...journal.flatMap((j) => [j.user_id, j.moderator_id]),
  ])) {
    const m = guild.members.cache.get(id);
    who[id] = {
      name: m?.displayName ?? id,
      avatar: m?.user?.displayAvatarURL?.({ extension: 'png', size: 64 }) ?? avatarUrl(id, null, 64),
    };
  }

  const body = R.modPage({
    active,
    warns,
    warnLimit: WARN_LIMIT,
    journal,
    who,
    lang,
    level,
    limitMinutes: punishmentService.limitMinutes(guild.id, level),
    kinds: KIND_LABEL,
  });
  return html(res, 200, guild, session, lang, path, t(lang, 'mod.title'), body, false, 'mod');
}

async function modApi(req, res, guild, session, action) {
  if (!session) return json(res, 401, { error: 'auth' });
  if (!isModerator(guild, session)) return json(res, 403, { error: 'forbidden' });

  const level = accessLevel(guild, session);
  const body = await readJson(req).catch(() => ({}));
  const targetId = String(body.userId ?? '').replace(/[^0-9]/g, '');
  if (!targetId) return json(res, 400, { error: 'userId' });

  // себе перевіряємо одразу — по учасника до Discord ходити ні до чого
  if (targetId === session.user_id) return json(res, 400, { error: 'self' });

  const target = guild.members.cache.get(targetId) ?? await guild.members.fetch(targetId).catch(() => null);
  if (!target) return json(res, 404, { error: 'not found' });

  // ті самі правила, що й у боті: не рівного й не старшого за правами
  if (accessService.level(target) >= level) return json(res, 403, { error: 'rank' });

  if (action === 'lift') {
    // знімає той, чия роль вища за роль того, хто видав
    const me = guild.members.cache.get(session.user_id)
      ?? await guild.members.fetch(session.user_id).catch(() => null);
    const kind = String(body.kind ?? 'all');
    const list = await punishmentService.forUser(guild.id, targetId);
    for (const p of (kind === 'all' ? list : list.filter((x) => x.kind === kind))) {
      const { ok, why } = await punishmentService.canLift(guild, me, p);
      if (!ok) return json(res, 403, { error: 'hierarchy', message: why });
    }

    await punishmentService.lift(guild, targetId, kind, session.user_id);
    await punishmentService.notify(guild, {
      target: target.user, moderator: session.user_id, kind: body.kind === 'all' ? 'full' : body.kind, lifted: true,
    });
    return json(res, 200, { ok: true });
  }

  // попередження: живе 72 години, три чинні дають автоматичний мут
  if (action === 'warn') {
    const reason = String(body.reason ?? '').slice(0, 400).trim() || null;
    if (configService.get(guild.id, 'moderation.requireReason') && !reason) {
      return json(res, 400, { error: 'reason' });
    }
    const { count, auto } = await punishmentService.warn(guild, target, {
      reason, moderatorId: session.user_id,
    });
    await punishmentService.notify(guild, {
      target: target.user, moderator: session.user_id, kind: 'warn', reason,
    });
    if (auto) {
      await punishmentService.notify(guild, {
        target: target.user, moderator: 'system', kind: 'full',
        minutes: auto.minutes, reason: `${WARN_LIMIT}/${WARN_LIMIT} попереджень`,
      });
    }
    return json(res, 200, { ok: true, count, auto });
  }

  // зняття попереджень вручну
  if (action === 'unwarn') {
    const left = await punishmentService.liftWarn(guild.id, targetId, { all: body.all !== false });
    return json(res, 200, { ok: true, left });
  }

  if (action === 'apply') {
    const kind = String(body.kind ?? '');
    if (!['text', 'voice', 'full'].includes(kind)) return json(res, 400, { error: 'kind' });

    const minutes = Math.max(0, Math.min(525_600, Number(body.minutes ?? 0)));
    if (!punishmentService.withinLimit(guild.id, level, minutes)) return json(res, 403, { error: 'limit' });

    const reason = String(body.reason ?? '').slice(0, 400).trim() || null;
    if (configService.get(guild.id, 'moderation.requireReason') && !reason) {
      return json(res, 400, { error: 'reason' });
    }

    try {
      await punishmentService.apply(guild, target, { kind, minutes, reason, moderatorId: session.user_id });
      await punishmentService.notify(guild, {
        target: target.user, moderator: session.user_id, kind, minutes, reason,
      });
      log.info(`Модерація: ${session.username} → ${target.displayName} (${kind})`);
      return json(res, 200, { ok: true });
    } catch (err) {
      return json(res, 400, { error: err.message });
    }
  }

  return json(res, 404, { error: 'action' });
}

// ─────────────────────────────────────────────
//  Кінотеатр: спільний перегляд для тих, хто сидить у голосовому каналі
// ─────────────────────────────────────────────

/** Налаштований голосовий канал кінотеатру. */
function cinemaChannel(guild) {
  const id = configService.get(guild.id, 'cinema.voiceChannelId');
  if (!id) return null;
  return guild.channels.cache.get(id) ?? null;
}

/** Хто зараз сидить у каналі — вони ж і глядачі. */
function voiceMembers(channel) {
  if (!channel?.members) return [];
  return [...channel.members.values()].map((m) => ({
    id: m.id,
    name: m.displayName,
    avatar: m.user.displayAvatarURL({ extension: 'png', size: 64 }),
  }));
}

function inVoice(channel, userId) {
  return !!channel?.members?.has?.(userId);
}

/**
 * Позиція з поправкою на час: у БД лежить позиція на момент останньої дії,
 * тож для «йде показ» додаємо, скільки минуло.
 */
function livePosition(state) {
  if (!state) return 0;
  if (!state.playing) return state.positionMs;
  return state.positionMs + (Date.now() - state.updatedAt);
}

/** Хто, окрім адміністратора, може правити сеанс і чергу. */
function isEditor(guild, session) {
  if (!session) return false;
  if (isAdmin(guild, session)) return true;
  const ids = configService.get(guild.id, 'cinema.editorIds') ?? [];
  return ids.includes(session.user_id);
}

/** Кому видані права на керування сеансом — з іменами та аватарами. */
function editorList(guild) {
  const ids = configService.get(guild.id, 'cinema.editorIds') ?? [];
  return ids.map((id) => {
    const m = guild.members.cache.get(id);
    return {
      id,
      name: m?.displayName ?? id,
      avatar: m?.user?.displayAvatarURL?.({ extension: 'png', size: 64 }) ?? avatarUrl(id, null, 64),
    };
  });
}

/** Кому відібрали право ставити на паузу. */
function isBlocked(guild, userId) {
  const ids = configService.get(guild.id, 'cinema.blockedIds') ?? [];
  return ids.includes(userId);
}

/** Зал тимчасово зачинений адміністратором? */
function lockedUntil(guild) {
  const until = Number(configService.get(guild.id, 'cinema.lockUntil') ?? 0);
  return until > Date.now() ? until : 0;
}

async function cinemaState(guild, session) {
  const channel = cinemaChannel(guild);
  const state = await cinemaRepo.get(guild.id);
  const admin = isAdmin(guild, session);
  const editor = isEditor(guild, session);
  const lock = lockedUntil(guild);
  // Дивитися може будь-хто; керувати — лише той, хто сидить у голосовому каналі.
  // Адміністратор керує залом і не заходячи в канал — інакше не запустиш сеанс,
  // поки всі збираються.
  const inRoom = !!session && (inVoice(channel, session.user_id) || admin);
  const blocked = !!session && isBlocked(guild, session.user_id) && !admin;
  const canControl = inRoom && !blocked && (!lock || admin);

  return {
    ok: true,
    admin,
    editor,
    allowed: !lock || admin,
    lockedUntil: lock,
    canControl,
    canEdit: canControl && editor,
    queue: await cinemaQueueRepo.list(guild.id, 30),
    history: admin ? await cinemaLogRepo.list(guild.id, 40) : [],
    editors: admin ? (configService.get(guild.id, 'cinema.editorIds') ?? []) : [],
    blocked: admin ? (configService.get(guild.id, 'cinema.blockedIds') ?? []) : [],
    // повний список тих, кому видані права — навіть якщо їх зараз немає в каналі
    editorList: admin ? editorList(guild) : [],
    channel: channel ? { id: channel.id, name: channel.name } : null,
    viewers: voiceMembers(channel),
    source: state?.source ?? null,
    provider: state?.provider ?? 'file',
    syncMode: state?.syncMode ?? 'full',
    pageUrl: state?.pageUrl ?? null,
    qualities: state?.qualities ?? [],
    variants: state?.variants ?? [],
    // субтитри окремими файлами; ті, що всередині потоку, плеєр знайде сам
    subtitles: state?.subtitles ?? [],
    hardPause: state?.hardPause !== false,
    title: state?.title ?? null,
    playing: !!state?.playing,
    positionMs: Math.max(0, livePosition(state)),
    serverTime: Date.now(),
  };
}

async function cinemaAction(req, res, guild, session, action) {
  if (!session) return json(res, 401, { error: 'auth' });

  const channel = cinemaChannel(guild);
  const admin = isAdmin(guild, session);
  const editor = isEditor(guild, session);
  const body = await readJson(req).catch(() => ({}));

  const note = (act, detail) => cinemaLogRepo
    .add(guild.id, { userId: session.user_id, username: session.username, action: act, detail })
    .catch(() => {});

  // ── адміністративне: працює й поза голосовим каналом ──
  if (['lock', 'grant', 'revoke', 'clearQueue', 'allowControl', 'denyControl'].includes(action)) {
    if (!admin) return json(res, 403, { error: 'admin' });

    // Право ставити на паузу — окремо для кожного глядача.
    if (action === 'allowControl' || action === 'denyControl') {
      const userId = String(body.userId ?? '').replace(/[^0-9]/g, '');
      if (!userId) return json(res, 400, { error: 'userId' });
      const ids = [...(configService.get(guild.id, 'cinema.blockedIds') ?? [])];
      const next = action === 'denyControl'
        ? [...new Set([...ids, userId])]
        : ids.filter((x) => x !== userId);
      await configService.set(guild.id, 'cinema.blockedIds', next);
      await note(action, userId);
      return json(res, 200, await cinemaState(guild, session));
    }

    if (action === 'lock') {
      const minutes = Math.max(0, Math.min(720, Number(body.minutes ?? 0)));
      const until = minutes ? Date.now() + minutes * 60_000 : 0;
      await configService.set(guild.id, 'cinema.lockUntil', until);
      await note(until ? 'lock' : 'unlock', until ? `${minutes} хв` : null);
    } else if (action === 'clearQueue') {
      await cinemaQueueRepo.clear(guild.id);
      await note('queue.clear');
    } else {
      const userId = String(body.userId ?? '').replace(/[^0-9]/g, '');
      if (!userId) return json(res, 400, { error: 'userId' });
      const ids = [...(configService.get(guild.id, 'cinema.editorIds') ?? [])];
      const next = action === 'grant'
        ? [...new Set([...ids, userId])]
        : ids.filter((x) => x !== userId);
      await configService.set(guild.id, 'cinema.editorIds', next);
      await note(action, userId);
    }
    return json(res, 200, await cinemaState(guild, session));
  }

  // ── усе інше вимагає присутності в голосовому каналі (адміну — ні) ──
  if (!inVoice(channel, session.user_id) && !admin) return json(res, 403, { error: 'voice' });
  if (lockedUntil(guild) && !admin) return json(res, 403, { error: 'locked' });
  // право паузи могли забрати особисто — перевіряємо це саме тут, на сервері,
  // бо ховати кнопку в інтерфейсі недостатньо
  if (isBlocked(guild, session.user_id) && !admin) return json(res, 403, { error: 'blocked' });

  const state = (await cinemaRepo.get(guild.id)) ?? { source: null, title: null, playing: false, positionMs: 0 };

  const save = (patch) => cinemaRepo.save(guild.id, {
    source: state.source, title: state.title, provider: state.provider,
    syncMode: state.syncMode, pageUrl: state.pageUrl, qualities: state.qualities,
    variants: state.variants, hardPause: state.hardPause !== false,
    playing: state.playing, positionMs: livePosition(state),
    updatedBy: session.user_id, ...patch,
  });

  /**
   * Якщо джерело вимагає рідного Referer — пускаємо його через наш проксі.
   * Інакше браузер отримав би 403, і повна синхронізація була б неможлива.
   */
  const throughProxy = async (found) => {
    // Referer можна задати вручну: тоді потік іде через проксі з ним,
    // навіть якщо резолвер сам про це не здогадався.
    const manual = String(body.referer ?? '').trim();
    let h = manual && /^https?:\/\//i.test(manual)
      ? { ...(found.headers ?? {}), referer: manual, origin: originOfUrl(manual) }
      : found.headers;

    const needsHeaders = !!(h && (h.referer || h.Referer || h.cookie || h.Cookie));

    // Головна причина, чому пряме посилання «не підхоплюється»: CDN дозволяє
    // читати потік лише зі свого сайту (Access-Control-Allow-Origin). Наш
    // плеєр браузер тоді блокує. Перевіряємо це заздалегідь і, якщо треба,
    // пускаємо через проксі — він віддає потік уже з дозволом для всіх.
    let corsBlocked = false;
    if (!needsHeaders && /^https?:\/\//i.test(found.src) && found.provider !== 'iframe') {
      corsBlocked = await corsWouldBlock(found.src, ourOrigin(req));
      if (corsBlocked) {
        h = { ...(found.headers ?? {}), referer: originOfUrl(found.src) + '/' };
        log.info(`Потік ${new URL(found.src).hostname} закритий для чужих сайтів — вмикаю проксі`);
      }
    }

    if (!needsHeaders && !corsBlocked) return found;
    const wrap = (u) => signUrl(u, h);
    return {
      ...found,
      src: wrap(found.src),
      proxied: true,
      qualities: (found.qualities ?? []).map((q) => ({ ...q, url: wrap(q.url) })),
      variants: (found.variants ?? []).map((v) => ({
        ...v,
        src: wrap(v.src),
        qualities: (v.qualities ?? []).map((q) => ({ ...q, url: wrap(q.url) })),
      })),
    };
  };

  /** Розбір посилання: спільний для «запустити зараз» і «в чергу». */
  const resolve = async () => {
    const raw = String(body.source ?? '').trim();
    // mode:'frame' — свідома вимога показати саму сторінку, без розбору.
    // Потрібно, коли CDN не дає програвати пряме посилання на чужому домені.
    const found = body.mode === 'frame' && /^https?:\/\//i.test(raw)
      ? { provider: 'iframe', src: raw, sync: 'cue' }
      : await resolveSource(raw).catch(() => null);
    if (!found) return null;
    return {
      found: await throughProxy(found),
      raw,
      title: String(body.title ?? '').slice(0, 120).trim() || found.title?.slice(0, 120) || null,
    };
  };

  /**
   * @param {boolean} autoplay Перехід із черги не має зупиняти сеанс —
   *   наступне відео просто починає грати далі.
   */
  const start = (item, autoplay = false) => cinemaRepo.save(guild.id, {
    source: item.source,
    provider: item.provider,
    syncMode: item.syncMode,
    qualities: item.qualities ?? [],
    variants: item.variants ?? [],
    pageUrl: item.pageUrl ?? null,
    title: item.title ?? null,
    playing: autoplay,
    positionMs: 0,
    updatedBy: session.user_id,
  });

  switch (action) {
    // Пауза й пуск доступні всім у залі — це спільний перегляд.
    case 'play':
      await save({ playing: true });
      await note('play', fmtTime(livePosition(state)));
      break;
    case 'pause': {
      const at = positionFrom(body.positionMs, livePosition(state));
      if (at === null) return json(res, 400, { error: 'positionMs' });
      await save({ playing: false, positionMs: at });
      await note('pause', fmtTime(at));
      break;
    }

    // Перемотка, джерело, черга й завершення — тим, хто керує сеансом.
    case 'seek': {
      if (!editor) return json(res, 403, { error: 'editor' });
      const at = positionFrom(body.positionMs, 0);
      if (at === null) return json(res, 400, { error: 'positionMs' });
      await save({ positionMs: at });
      await note('seek', fmtTime(at));
      break;
    }

    case 'source': {
      if (!editor) return json(res, 403, { error: 'editor' });
      const r = await resolve();
      if (!r) return json(res, 400, { error: 'source' });
      await start({
        source: r.found.src,
        provider: r.found.provider,
        syncMode: r.found.sync,
        qualities: r.found.qualities ?? [],
        variants: r.found.variants ?? [],
        pageUrl: /^https?:/i.test(r.raw) ? r.raw : null,
        title: r.title,
      });
      await note('start', r.title ?? r.found.provider);
      log.info(`Кінотеатр: ${session.username} запустив ${r.found.provider} (${r.found.sync})`);
      break;
    }

    // ── черга ──
    case 'queue': {
      const r = await resolve();
      if (!r) return json(res, 400, { error: 'source' });
      if (await cinemaQueueRepo.count(guild.id) >= 50) return json(res, 400, { error: 'full' });
      await cinemaQueueRepo.add(guild.id, {
        source: r.found.src,
        pageUrl: /^https?:/i.test(r.raw) ? r.raw : null,
        provider: r.found.provider,
        syncMode: r.found.sync,
        qualities: r.found.qualities ?? [],
        title: r.title,
        addedBy: session.user_id,
        addedName: session.username,
      });
      await note('queue.add', r.title ?? r.found.provider);
      break;
    }

    // Режим зупинки некерованого плеєра: зняттям рамки чи лише сигналом.
    case 'hardPause': {
      if (!editor) return json(res, 403, { error: 'editor' });
      const on = body.on !== false;
      await save({ hardPause: on });
      await note(on ? 'hard.on' : 'hard.off');
      break;
    }

    case 'queueMove': {
      if (!editor) return json(res, 403, { error: 'editor' });
      const okMove = await cinemaQueueRepo.move(guild.id, Number(body.id ?? 0), Number(body.dir ?? 1));
      if (!okMove) return json(res, 404, { error: 'not found' });
      break;
    }

    case 'unqueue': {
      const id = Number(body.id ?? 0);
      const items = await cinemaQueueRepo.list(guild.id, 50);
      const item = items.find((x) => x.id === id);
      if (!item) return json(res, 404, { error: 'not found' });
      // свій запис може прибрати автор, чужий — лише той, хто керує сеансом
      if (item.addedBy !== session.user_id && !editor) return json(res, 403, { error: 'editor' });
      await cinemaQueueRepo.remove(guild.id, id);
      await note('queue.remove', item.title ?? String(id));
      break;
    }

    case 'next': {
      if (!editor) return json(res, 403, { error: 'editor' });
      // захист від подвійного перемикання: клієнт каже, що зараз грає
      if (body.current && state.source && body.current !== state.source) break;
      const item = Number(body.id)
        ? (await cinemaQueueRepo.list(guild.id, 50)).find((x) => x.id === Number(body.id))
        : await cinemaQueueRepo.first(guild.id);
      if (!item) return json(res, 404, { error: 'empty' });
      // сеанс не переривається: наступне з черги одразу грає далі
      await start(item, true);
      await cinemaQueueRepo.remove(guild.id, item.id);
      await note('next', item.title ?? item.provider);
      break;
    }

    case 'stop':
      if (!editor) return json(res, 403, { error: 'editor' });
      await cinemaRepo.clear(guild.id);
      await note('stop');
      break;

    default:
      return json(res, 404, { error: 'action' });
  }

  return json(res, 200, await cinemaState(guild, session));
}

/**
 * Чи заблокує браузер читання цього потоку з нашого сайту.
 * CDN мусить дозволити наш origin у Access-Control-Allow-Origin; якщо там
 * стоїть чужий домен — hls.js нічого не прочитає, і відео просто не піде.
 * Результат кешуємо по хосту: перевіряти кожну якість окремо не треба.
 */
const corsCache = new Map(); // host → { at, blocked }

export async function corsWouldBlock(src, origin) {
  let host;
  try {
    host = new URL(src).host;
  } catch {
    return false;
  }

  const hit = corsCache.get(host);
  if (hit && Date.now() - hit.at < 600_000) return hit.blocked;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  let blocked = true; // не змогли перевірити — безпечніше піти через проксі
  try {
    const res = await fetch(src, {
      signal: ctrl.signal,
      headers: { origin, range: 'bytes=0-0', 'user-agent': 'Mozilla/5.0' },
    });
    const allow = res.headers.get('access-control-allow-origin');
    blocked = !(allow === '*' || allow === origin);
    res.body?.cancel?.().catch(() => {});
  } catch { /* лишаємо blocked = true */ } finally {
    clearTimeout(timer);
  }

  // Кеш живе весь час роботи бота, а хостів за місяці набігає багато —
  // тримаємо його в межах розумного, як і кеш карток профілю.
  if (corsCache.size > 200) corsCache.clear();
  corsCache.set(host, { at: Date.now(), blocked });
  return blocked;
}

/** Наш власний origin — саме його CDN має дозволити. */
function ourOrigin(req) {
  const pub = publicUrl();
  if (pub) return pub.replace(/\/$/, '');
  return originOf(req);
}

function originOfUrl(u) {
  try {
    return new URL(u).origin;
  } catch {
    return '';
  }
}

function fmtTime(ms) {
  const s = Math.max(0, Math.round(Number(ms) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Позиція з тіла запиту. Раніше сюди пролазило будь-що: Number('абв') давав
 * NaN, той ішов у базу як порожнеча й читався назад нулем — тобто зіпсований
 * запит тихо перемотував сеанс на початок усім у залі, ще й лишав у журналі
 * «NaN:NaN». Тепер таке видно одразу.
 * @returns {number|null} null — значення непридатне
 */
function positionFrom(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(n, 24 * 3600_000));
}

async function renderCinema(res, guild, session, lang, path, host) {
  const state = await cinemaState(guild, session);
  // host потрібен Twitch: їхній плеєр вимагає parent=<домен сайту>
  const body = R.cinemaPage({ state, session, lang, host });
  return html(res, 200, guild, session, lang, path, t(lang, 'cin.title'), body, false, 'cinema');
}

/** PNG-картка профілю для прев'ю посилання. Кешуємо — рендер не безкоштовний. */
const ogCache = new Map(); // userId → { at, png }

async function ogProfileImage(guild, userId) {
  const hit = ogCache.get(userId);
  if (hit && Date.now() - hit.at < 300_000) return hit.png;

  const profile = await profileService.build(guild.id, userId, { fresh: false });
  if (!profile) return null;

  const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
  const tone = member?.displayHexColor && member.displayHexColor !== '#000000' ? member.displayHexColor : null;

  let roleName = null;
  let roleColor = tone;
  if (member) {
    const tier = verificationService.tiers(guild.id).find((x) => x.roleId && member.roles.cache.has(x.roleId));
    const role = tier?.roleId ? guild.roles.cache.get(tier.roleId) : null;
    if (role) {
      roleName = role.name;
      roleColor = role.color ? role.hexColor : roleColor;
    }
  }

  // profileCard віддає вкладення для Discord — нам потрібні самі байти
  const card = await profileCard(profile, {
    username: member?.displayName ?? profile.username ?? userId,
    avatarUrl: member?.user?.displayAvatarURL({ extension: 'png', size: 128 }) ?? avatarUrl(userId, null, 128),
    roleName,
    roleColor,
    accent: tone,
  });
  const png = card?.attachment ?? null;
  if (!png) return null;

  // тримаємо лише кілька останніх карток — це прев'ю, а не сховище
  if (ogCache.size > 40) ogCache.clear();
  ogCache.set(userId, { at: Date.now(), png });
  return png;
}

/** Домен, на якому нас відкрили (для parent= у чужих плеєрах). */
function hostOf(req) {
  const pub = publicUrl();
  if (pub) {
    try {
      return new URL(pub).hostname;
    } catch { /* нижче фолбек на заголовок */ }
  }
  return String(req.headers.host ?? 'localhost').split(':')[0];
}

// ─────────────────────────────────────────────
//  Профіль
// ─────────────────────────────────────────────
async function renderProfile(res, guild, session, lang, path, userId) {
  const profile = await profileService.build(guild.id, userId, { fresh: true });
  if (!profile) return html(res, 404, guild, session, lang, path, '404', R.errorPage(404, t(lang, 'err.noData'), lang));

  const member = guild.members.cache.get(userId) ?? await guild.members.fetch(userId).catch(() => null);
  const rank = await reputationRepo.rank(guild.id, userId);

  let roleName = null;
  let roleColor = member?.displayHexColor && member.displayHexColor !== '#000000' ? member.displayHexColor : null;
  if (member) {
    const tier = verificationService.tiers(guild.id).find((x) => x.roleId && member.roles.cache.has(x.roleId));
    const role = tier?.roleId ? guild.roles.cache.get(tier.roleId) : null;
    if (role) {
      roleName = role.name;
      roleColor = role.color ? role.hexColor : roleColor;
    }
  }

  const username = member?.displayName ?? profile.username ?? userId;
  const avatar = member?.user
    ? member.user.displayAvatarURL({ extension: 'png', size: 128 })
    : avatarUrl(userId, null);

  // у прев'ю посилання йде та сама картка, що й у Discord
  const og = ogFor(
    guild, path, username,
    `Рейтинг ${profile.aiScore}${rank ? ` · #${rank}` : ''} · на сервері ${profile.daysOnServer} дн.`,
    publicUrl() ? `${publicUrl()}/og/u/${userId}` : undefined,
  );

  // Оформлення сторінки: обраний фон, акцент, рамка, банер і опис.
  // Дивиться його кожен, хто відкрив профіль, а не лише сам власник.
  const look = await cosmeticsService.look(guild.id, userId);
  const mine = session?.user_id === userId;
  // Гаманець показуємо в самому профілі — щоб не бігати в магазин по число.
  look.balance = (await cosmeticsService.wallet(guild.id, userId)).balance;

  // Власнику сторінки збираємо все, чим він може її змінити.
  let wardrobe = null;
  if (mine) {
    const owned = new Set(await cosmeticsService.owned(guild.id, userId));
    // У гардеробі лише те, що людина справді має. Поштучна річ — сама собі
    // «набір» з однією позицією, інакше сторінка падала на p.items.map.
    const packs = cosmeticsService.catalog(guild.id)
      .filter((p) => !p.custom && owned.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, items: p.items ?? [p] }));
    const assets = await assetsRepo.list(guild.id, userId, null, 24);

    // Для вітрини годяться і свої картинки, і куплені чужі роботи.
    // owned — це Set, тож перебираємо його, а не масив
    const boughtIds = [...owned]
      .filter((id) => String(id).startsWith('asset:'))
      .map((id) => Number(String(id).slice(6)));
    const bought = [];
    for (const id of boughtIds) {
      const a = await assetsRepo.meta(id).catch(() => null);
      if (a?.guild_id === guild.id) bought.push({ id: a.id, kind: a.kind, url: `/asset/${a.id}` });
    }

    wardrobe = {
      packs,
      canUpload: cosmeticsService.canUpload(guild.id, member),
      // Скільки заливок ще лишилось — раніше це число знав лише магазин,
      // хоча заливка живе саме тут.
      uploads: {
        background: await cosmeticsService.uploadsLeft(guild.id, userId, 'background'),
        banner: await cosmeticsService.uploadsLeft(guild.id, userId, 'banner'),
      },
      // ціну публікації рахує сама сторінка від того, що вписав автор
      uploadPrice: cosmeticsService.uploadPrice(1),
      uploadLimit: cosmeticsService.UPLOAD_LIMIT,
      showcaseMax: cosmeticsService.SHOWCASE_MAX,
      assets: assets.map((a) => ({ id: a.id, kind: a.kind, url: `/asset/${a.id}` })),
      images: [...assets.map((a) => ({ id: a.id, url: `/asset/${a.id}` })), ...bought],
    };
  }

  return html(res, 200, guild, session, lang, path, username,
    R.profilePage(profile, {
      username, avatar, roleName, roleColor, rank, lang, look, mine, wardrobe,
    }),
    false, mine ? 'me' : 'u', og, look);
}

async function topRows(guild, limit) {
  const rows = await reputationRepo.leaderboard(guild.id, limit);
  return rows.map((r) => {
    const m = guild.members.cache.get(r.user_id);
    return {
      user_id: r.user_id,
      username: m?.displayName ?? r.username ?? r.user_id,
      avatar: m?.user?.avatar ?? null,
      ai_score: r.ai_score,
    };
  });
}

// ─────────────────────────────────────────────
//  Відповіді
// ─────────────────────────────────────────────
/**
 * Дані для прев'ю посилання. Кидаєш адресу в чат — має бути картка,
 * а не голий текст.
 */
function ogFor(guild, path, title, description, image) {
  const base = publicUrl();
  return {
    title: title ? `${title} · ${guild.name}` : guild.name,
    description: description ?? 'Спільнота, галерея та спільний перегляд',
    url: base ? base + path : undefined,
    image: image ?? (base ? `${base}/og.png` : undefined),
  };
}

async function html(res, code, guild, session, lang, path, title, body,
  gallery = false, page = null, og = null, lookOverride = null, query = '') {
  // Обидва — з кешу каркаса; окремий запит по /custom.css був зайвим,
  // бо перелік асетів у нас уже є.
  const { assets, pages } = await shellData(guild.id);
  const hasCustomCss = assets.has('/custom.css');

  const nav = [
    { href: '/top', label: t(lang, 'nav.top'), active: path === '/top' },
    { href: '/gallery', label: t(lang, 'nav.gallery'), active: path === '/gallery' },
    ...(configService.get(guild.id, 'cinema.enabled')
      ? [{ href: '/cinema', label: t(lang, 'nav.cinema'), active: path === '/cinema' }]
      : []),
    // магазин косметики — лише для тих, хто зайшов: анонімам купувати нічого
    ...(session ? [{ href: '/shop', label: `✨ ${t(lang, 'nav.shop')}`, active: path === '/shop' }] : []),
    ...pages.map((p) => ({ href: `/${p.slug}`, label: p.title, active: path === `/${p.slug}` })),
    // окремої кнопки «Профіль» немає — до нього ведуть аватар і нік у шапці
    // кнопку модерації бачать лише ті, кому вона доступна
    ...(isModerator(guild, session)
      ? [{ href: '/mod', label: `🛡️ ${t(lang, 'nav.mod')}`, active: path === '/mod', apart: true }]
      : []),
  ];

  // Особисте оформлення їде з людиною по всіх сторінках, а не лише в профілі.
  // На чужій сторінці перевагу має оформлення її власника: ми в гостях,
  // тож бачимо те, як людина себе оформила.
  const look = lookOverride
    ?? (session ? await cosmeticsService.look(guild.id, session.user_id).catch(() => null) : null);

  const out = R.layout({
    title: `${title} · ${guild.name}`,
    guildName: guild.name,
    og: og ?? ogFor(guild, path, title),
    body, nav, session, hasCustomCss, lang, path, query, gallery, page, look,
  });
  return send(res, code, 'text/html; charset=utf-8', out);
}

/** Тіло JSON-запиту з жорстким лімітом — щоб не з'їли памʼять. */
function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > limit) {
        reject(new Error('TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}

function json(res, code, obj) {
  send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj));
}

function readCookie(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Приймаємо лише внутрішні шляхи — жодних відкритих редиректів. */
function safePath(value) {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.startsWith('/login') || value.startsWith('/callback')) return null;
  return value;
}

function refPath(req) {
  try {
    return new URL(req.headers.referer ?? '').pathname;
  } catch {
    return null;
  }
}

function originOf(req) {
  const proto = req.headers['x-forwarded-proto'] ?? 'http';
  return `${proto}://${req.headers.host}`;
}

function isSecure(req) {
  if (publicUrl().startsWith('https://')) return true;
  return (req.headers['x-forwarded-proto'] ?? '').split(',')[0].trim() === 'https';
}
