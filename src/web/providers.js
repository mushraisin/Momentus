import dns from 'node:dns/promises';
import net from 'node:net';
import { createLogger } from '../core/logger.js';
import { ytdlpResolve } from './ytdlp.js';

const log = createLogger('cinema');

/** Справжній браузерний UA — з «ботом» у назві сайти віддають 403. */
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/**
 * Резолвер джерел для кінотеатру: перетворює будь-яке посилання на щось,
 * що браузер уміє програти й чим ми вміємо керувати.
 *
 * Рівні синхронізації:
 *   full — можемо ставити на паузу й перемотувати програмно (усі бачать те саме);
 *   cue  — плеєр чужий і закритий: спільний лише момент запуску;
 *   none — не вдалося нічого підхопити.
 */

const RE = {
  youtube: [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([\w-]{6,})/i,
  ],
  vimeo: [/vimeo\.com\/(?:video\/)?(\d+)/i],
  twitch: [
    /twitch\.tv\/videos\/(\d+)/i,
    /twitch\.tv\/([A-Za-z0-9_]{3,25})\/?$/i,
  ],
  file: /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i,
  hls: /\.m3u8(\?|#|$)/i,
};

/**
 * @param {string} raw посилання від адміністратора
 * @returns {Promise<null|{provider:string,src:string,sync:string,title?:string}>}
 */
export async function resolveSource(raw) {
  const value = String(raw ?? '').trim();
  if (!value) return null;

  // Власне медіа з галереї — найпростіший і найнадійніший випадок.
  if (/^\/media\/\d+$/.test(value)) {
    return { provider: 'file', src: value, sync: 'full' };
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  // ── відомі майданчики: у них є API керування плеєром ──
  for (const re of RE.youtube) {
    const m = url.href.match(re);
    if (m) return { provider: 'youtube', src: m[1], sync: 'full' };
  }
  for (const re of RE.vimeo) {
    const m = url.href.match(re);
    if (m) return { provider: 'vimeo', src: m[1], sync: 'full' };
  }
  const vod = url.href.match(RE.twitch[0]);
  if (vod) return { provider: 'twitch', src: `video=${vod[1]}`, sync: 'cue' };
  if (/(^|\.)twitch\.tv$/i.test(url.hostname)) {
    const ch = url.pathname.replace(/\//g, '');
    if (ch) return { provider: 'twitch', src: `channel=${ch}`, sync: 'cue' };
  }

  // Не показуємо залу нічого з локальної мережі — це або помилка, або спроба
  // змусити чужі браузери стукати у внутрішні адреси.
  if (isPrivate(url.hostname) || /^(localhost|.*\.local)$/i.test(url.hostname)) return null;

  // ── прямий файл ──
  if (RE.hls.test(url.pathname)) return { provider: 'hls', src: url.href, sync: 'full' };
  if (RE.file.test(url.pathname)) return { provider: 'file', src: url.href, sync: 'full' };

  // ── yt-dlp: знає, як дістати пряме відео з понад тисячі сайтів ──
  // Це головний шлях до повної синхронізації: маючи потік, ним керує наш плеєр.
  const viaYtdlp = await ytdlpResolve(url.href).catch(() => null);
  if (viaYtdlp) return viaYtdlp;

  // ── невідомий сайт: заглядаємо в сторінку й шукаємо, що там за плеєр ──
  const scraped = await scrape(url).catch((err) => {
    log.warn(`Не вдалося прочитати ${url.hostname}`, err.message);
    return null;
  });

  // Знайшли рамку плеєра, але не пряме відео? Проженемо через yt-dlp вже саму
  // рамку: балансери (ashdi, tortuga, kodik) він знає краще, ніж сторінку сайту,
  // яку захищає Cloudflare.
  if (scraped?.provider === 'iframe' && scraped.embedded) {
    const viaFrame = await ytdlpResolve(scraped.src).catch(() => null);
    if (viaFrame) {
      log.info(`Пряме відео знайдено в рамці ${new URL(scraped.src).hostname}`);
      return { ...viaFrame, title: viaFrame.title ?? scraped.title };
    }
  }
  if (scraped) return scraped;

  // ── останній шанс: показати сайт як є, синхронізуючи лише момент запуску ──
  return { provider: 'iframe', src: url.href, sync: 'cue' };
}

/**
 * Витягуємо джерело зі сторінки: спершу метатеги (og:video тощо),
 * далі — самі теги <video>/<source> та посилання на .mp4/.m3u8.
 */
async function scrape(url, depth = 0) {
  if (!(await publicHost(url.hostname))) throw new Error('приватна адреса заблокована');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  let html;
  try {
    const res = await fetch(url.href, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: {
        // саме браузерний UA: із «ботом» у назві сайти віддають 403
        'user-agent': BROWSER_UA,
        'accept-language': 'uk-UA,uk;q=0.9,en;q=0.8',
        referer: url.origin + '/',
        accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';

    // Посилання виявилось самим файлом, хоч і без розширення в шляху.
    if (/^video\//i.test(type)) return { provider: 'file', src: url.href, sync: 'full' };
    if (/mpegurl/i.test(type)) return { provider: 'hls', src: url.href, sync: 'full' };

    // Балансери часто віддають не сторінку, а JSON із адресою потоку.
    if (/json/i.test(type)) {
      const text = await readCapped(res, 256 * 1024);
      return scanForStream(text, url.href);
    }
    if (!/html/i.test(type)) return null;

    html = await readCapped(res, 512 * 1024);
  } finally {
    clearTimeout(timer);
  }

  const found = extractFromHtml(html, url.href);

  // Плейлист лежить окремим файлом — дочитуємо його одним запитом.
  if (found?.provider === 'playlist') {
    const list = await fetchText(found.src).catch(() => null);
    const best = list ? bestFromPlaylist(list, new URL(found.src)) : null;
    return best ? { ...best, title: found.title } : null;
  }
  // Знайшли рамку плеєра — зазираємо ще й усередину неї: раптом там лежить
  // пряме посилання, і тоді синхронізація буде повною, а не лише пауза.
  if (found?.embedded && depth === 0) {
    const deeper = await scrape(new URL(found.src), 1).catch(() => null);
    if (deeper && deeper.provider !== 'iframe') return { ...deeper, title: deeper.title ?? found.title };
    return found;
  }
  return found;
}

/**
 * Кандидат на вкладену рамку з плеєром.
 * Дивимось не лише на <iframe src>, а й на data-src (ліниве завантаження)
 * та на адреси, які сайт підставляє в рамку вже з JS.
 */
function innerFrame(html, url) {
  const SKIP = /(youtube|youtu\.be|vimeo|twitch|facebook|google|gstatic|doubleclick|adsby|disqus|vk\.com\/widget|telegram|twitter)/i;
  const GOOD = /(player|embed|kodik|videocdn|hdvb|serial|film|movie|balancer|stream|video|iframe\.|\/e\/|\/v\/)/i;

  const candidates = [
    ...[...html.matchAll(/<iframe[^>]+(?:data-)?src=["']([^"']+)["']/gi)].map((m) => m[1]),
    ...[...html.matchAll(/data-(?:player|iframe|src|url)=["']([^"']*(?:player|embed|kodik|videocdn)[^"']*)["']/gi)].map((m) => m[1]),
    // адресу нерідко підставляють у рамку скриптом
    ...[...html.matchAll(/["'](https?:)?\/\/[^"']*(?:player|embed|kodik|videocdn|hdvb)[^"']*["']/gi)]
      .map((m) => m[0].slice(1, -1)),
  ];

  for (const raw of candidates) {
    const abs = absolute(decodeEntities(raw), url);
    if (!/^https?:/i.test(abs)) continue;
    if (SKIP.test(abs)) continue;
    if (!GOOD.test(abs)) continue;
    if (abs.replace(/\/$/, '') === url.href.replace(/\/$/, '')) continue;
    return abs;
  }
  return null;
}

async function fetchText(href) {
  const u = new URL(href);
  if (!(await publicHost(u.hostname))) throw new Error('приватна адреса заблокована');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(href, { signal: ctrl.signal, headers: { 'user-agent': BROWSER_UA } });
    if (!res.ok) return null;
    return await readCapped(res, 256 * 1024);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Розбір самої сторінки — окремо від мережі, щоб було що тестувати.
 * @param {string} html
 * @param {string} baseHref для перетворення відносних адрес на абсолютні
 */
export function extractFromHtml(html, baseHref) {
  if (!html) return null;
  const url = new URL(baseHref);

  // Playerjs та подібні: пряме посилання лежить у конфігу плеєра.
  const pjs = extractPlayerjs(html, url);
  if (pjs) return pjs;

  const title = pick(html, [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,
    /<title[^>]*>([^<]{1,160})</i,
  ]);

  // Багато сайтів чесно віддають адресу відео в метатегах.
  const meta = pick(html, [
    /<meta[^>]+property=["']og:video:secure_url["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)/i,
    /<meta[^>]+name=["']twitter:player:stream["'][^>]+content=["']([^"']+)/i,
  ]);
  const direct = meta ?? pick(html, [
    /<video[^>]+src=["']([^"']+)["']/i,
    /<source[^>]+src=["']([^"']+\.(?:mp4|webm|m3u8)[^"']*)["']/i,
    /["'](https?:\/\/[^"']+\.(?:mp4|m3u8)(?:\?[^"']*)?)["']/i,
  ]);

  if (direct) {
    const abs = new URL(decodeEntities(direct), url.href).href;
    // og:video інколи вказує не на файл, а на вбудований плеєр — тоді проганяємо ще раз
    if (RE.hls.test(abs)) return { provider: 'hls', src: abs, sync: 'full', title };
    if (RE.file.test(abs)) return { provider: 'file', src: abs, sync: 'full', title };
    for (const re of RE.youtube) {
      const m = abs.match(re);
      if (m) return { provider: 'youtube', src: m[1], sync: 'full', title };
    }
    for (const re of RE.vimeo) {
      const m = abs.match(re);
      if (m) return { provider: 'vimeo', src: m[1], sync: 'full', title };
    }
  }

  // Сторінка сама підказує, який плеєр вбудовувати.
  const player = pick(html, [
    /<meta[^>]+name=["']twitter:player["'][^>]+content=["']([^"']+)/i,
    /<iframe[^>]+src=["']([^"']*(?:youtube|vimeo|player)[^"']*)["']/i,
  ]);
  if (player) {
    const abs = new URL(decodeEntities(player), url.href).href;
    for (const re of RE.youtube) {
      const m = abs.match(re);
      if (m) return { provider: 'youtube', src: m[1], sync: 'full', title };
    }
    for (const re of RE.vimeo) {
      const m = abs.match(re);
      if (m) return { provider: 'vimeo', src: m[1], sync: 'full', title };
    }
    return { provider: 'iframe', src: abs, sync: 'cue', title, embedded: true };
  }

  // Остання спроба знайти потік у самому коді сторінки (конфіги, JS-змінні).
  const inText = scanForStream(html, url.href);
  if (inText) return { ...inText, title };

  // Головне: вбудовуємо саме рамку плеєра, а не всю сторінку сайту —
  // інакше в залі відкривався б сайт із меню, рекламою та іншим зайвим.
  const frame = innerFrame(html, url);
  if (frame) return { provider: 'iframe', src: frame, sync: 'cue', title, embedded: true };

  return title ? { provider: 'iframe', src: url.href, sync: 'cue', title } : null;
}

/**
 * Playerjs і сумісні збірки. Плеєр ініціалізують як `new Playerjs({file:"..."})`,
 * і саме в `file` лежить те, що нам треба. Значення буває чотирьох видів:
 *   1) звичайне посилання на mp4/m3u8;
 *   2) список якостей: [360p]url1,[720p]url2 — беремо найвищу;
 *   3) JSON-плейлист серій із вкладеними folder[];
 *   4) посилання на .txt/.json із тим самим списком — дочитуємо окремо.
 */
export function extractPlayerjs(html, url) {
  if (!/Playerjs\s*\(/i.test(html) && !/["']file["']\s*:/.test(html)) return null;

  const cfg = html.match(/Playerjs\s*\(\s*\{([\s\S]{0,6000}?)\}\s*\)/i)?.[1] ?? html;
  let file = pick(cfg, [
    /file\s*:\s*"((?:[^"\\]|\\.)*)"/i,
    /file\s*:\s*'((?:[^'\\]|\\.)*)'/i,
    // плейлист серій передають масивом просто в коді, без лапок
    /file\s*:\s*(\[[\s\S]*\])\s*(?:,\s*[a-z_$]|$)/i,
    /file\s*:\s*(\[[\s\S]*\])/i,
  ]);
  // трапляється, що file — змінна, оголошена вище по коду
  if (!file) {
    const varName = cfg.match(/file\s*:\s*([A-Za-z_$][\w$]*)/)?.[1];
    if (varName) {
      file = pick(html, [
        new RegExp(`${varName}\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`),
        new RegExp(`${varName}\\s*=\\s*'((?:[^'\\\\]|\\\\.)*)'`),
      ]);
    }
  }
  if (!file) return null;

  file = file.replace(/\\\//g, '/').trim();
  const title = pick(html, [
    /title\s*:\s*["']([^"']{1,160})["']/i,
    /<title[^>]*>([^<]{1,160})</i,
  ]);

  // Зовнішній плейлист — доберемо його в scrape(), тут лише позначаємо.
  if (/^https?:\/\/\S+\.(txt|json)(\?|$)/i.test(file)) {
    return { provider: 'playlist', src: absolute(file, url), sync: 'full', title };
  }

  const best = bestFromPlaylist(file, url);
  return best ? { ...best, title: best.title ?? title } : null;
}

/** Витягуємо найкращу доріжку зі списку якостей або JSON-плейлиста. */
export function bestFromPlaylist(raw, url) {
  const text = String(raw ?? '').trim();
  if (!text) return null;

  // JSON-плейлист: серії, сезони, вкладені folder[].
  // Обережно: список якостей теж починається з «[», тому якщо JSON.parse
  // не вдався — не здаємось, а йдемо розбирати як список.
  if (text.startsWith('[') || text.startsWith('{')) {
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch { /* не JSON — нижче спробуємо як список якостей */ }

    if (parsed) {
      // Верхній рівень, де в кожного запису є свій file — це майже завжди
      // список озвучок (дубляж, оригінал, субтитри), а не серії.
      if (Array.isArray(parsed) && parsed.length > 1
        && parsed.every((n) => n && typeof n === 'object' && typeof n.file === 'string')) {
        const variants = [];
        for (const n of parsed) {
          const got = bestFromPlaylist(n.file, url);
          if (got) {
            variants.push({
              label: String(n.title ?? n.comment ?? `#${variants.length + 1}`).slice(0, 40),
              src: got.src,
              provider: got.provider,
              qualities: got.qualities ?? [],
            });
          }
        }
        if (variants.length) {
          const first = variants[0];
          return {
            provider: first.provider,
            src: first.src,
            sync: 'full',
            qualities: first.qualities,
            variants,
          };
        }
      }

      const files = [];
      const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk);
        if (!node || typeof node !== 'object') return;
        if (node.folder) walk(node.folder);
        if (typeof node.file === 'string') files.push(node.file);
      };
      walk(parsed);
      for (const f of files) {
        const got = bestFromPlaylist(f, url);
        if (got) return got; // беремо першу серію — далі перемикає адміністратор
      }
      return null;
    }
  }

  // Список якостей: [1080p]url,[720p]url — зберігаємо всі, щоб глядач міг обрати
  const parts = text.split(/\s*,\s*(?=(?:\[|https?:|\/\/))/).filter(Boolean);
  const qualities = [];
  for (const part of parts) {
    const m = part.match(/^\[([^\]]{1,20})\]\s*(\S+)$/);
    const label = m ? m[1].trim() : '';
    const link = m ? m[2] : part.trim();
    if (!/^(https?:)?\/\//i.test(link) && !link.startsWith('/')) continue;
    qualities.push({
      label: label || 'auto',
      height: Number(label.match(/(\d{3,4})/)?.[1] ?? 0),
      url: absolute(link, url),
    });
  }
  if (!qualities.length) return null;

  qualities.sort((a, b) => b.height - a.height);
  const abs = qualities[0].url;
  const provider = RE.hls.test(abs) ? 'hls' : 'file';
  // без розширення все одно віддаємо як файл: браузер розбереться за MIME
  return { provider, src: abs, sync: 'full', qualities };
}

function absolute(link, url) {
  try {
    return new URL(link, url ?? undefined).href;
  } catch {
    return link;
  }
}

/**
 * Пошук потоку в довільному тексті — JSON-відповіді балансера, конфігу плеєра,
 * шматку JS. Шукаємо саме адреси маніфестів і файлів, нічого не розшифровуючи:
 * якщо сайт ховає посилання за підписом, ми його тут і не знайдемо — і це нормально.
 */
export function scanForStream(text, baseHref) {
  if (!text) return null;
  const raw = String(text);

  // спершу пробуємо як JSON: адреса зазвичай лежить у полі file/src/hls/url
  try {
    const found = deepFindUrl(JSON.parse(raw));
    if (found) {
      const abs = absolute(found, new URL(baseHref));
      return RE.hls.test(abs)
        ? { provider: 'hls', src: abs, sync: 'full' }
        : { provider: 'file', src: abs, sync: 'full' };
    }
  } catch { /* не JSON — шукаємо просто в тексті */ }

  const m = raw.match(/["'](https?:\/\/[^"'\s\\]+\.m3u8[^"'\s\\]*)["']/i)
    ?? raw.match(/["'](https?:\/\/[^"'\s\\]+\.mp4[^"'\s\\]*)["']/i);
  if (!m) return null;
  const abs = m[1].replace(/\\\//g, '/');
  return RE.hls.test(abs)
    ? { provider: 'hls', src: abs, sync: 'full' }
    : { provider: 'file', src: abs, sync: 'full' };
}

/** Рекурсивний обхід JSON у пошуках адреси відео. */
function deepFindUrl(node, depth = 0) {
  if (depth > 6 || node == null) return null;
  if (typeof node === 'string') {
    return /^https?:\/\/\S+\.(m3u8|mp4)(\?|#|$)/i.test(node) ? node : null;
  }
  if (Array.isArray(node)) {
    for (const v of node) {
      const got = deepFindUrl(v, depth + 1);
      if (got) return got;
    }
    return null;
  }
  if (typeof node !== 'object') return null;

  // спершу заглядаємо в поля, де адреса лежить найчастіше
  for (const key of ['hls', 'file', 'src', 'url', 'stream', 'manifest', 'playlist']) {
    const got = deepFindUrl(node[key], depth + 1);
    if (got) return got;
  }
  for (const v of Object.values(node)) {
    const got = deepFindUrl(v, depth + 1);
    if (got) return got;
  }
  return null;
}

/** Читаємо не більше N байт — щоб важка сторінка не з'їла памʼять. */
async function readCapped(res, limit) {
  const reader = res.body?.getReader?.();
  if (!reader) return (await res.text()).slice(0, limit);
  let out = '';
  const dec = new TextDecoder();
  while (out.length < limit) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  reader.cancel().catch(() => {});
  return out;
}

function pick(html, patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function decodeEntities(s) {
  return String(s).replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/').replace(/&quot;/g, '"');
}

/**
 * Захист від SSRF: бот сам ходить за посиланням, тож не пускаємо його
 * у внутрішню мережу хоста.
 */
async function publicHost(hostname) {
  try {
    const addrs = await dns.lookup(hostname, { all: true });
    return addrs.every((a) => !isPrivate(a.address));
  } catch {
    return false;
  }
}

function isPrivate(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 100 && b >= 64 && b <= 127)
      || a >= 224;
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd')
    || v.startsWith('::ffff:127.') || v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

/** Людська назва провайдера для інтерфейсу. */
export const PROVIDER_LABEL = {
  file: 'Відео',
  hls: 'Стрім (HLS)',
  youtube: 'YouTube',
  vimeo: 'Vimeo',
  twitch: 'Twitch',
  iframe: 'Сайт',
};
