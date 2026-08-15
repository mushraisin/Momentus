import crypto from 'node:crypto';
import { createLogger } from '../core/logger.js';

const log = createLogger('proxy');

/**
 * Проксі медіа з підстановкою заголовків.
 *
 * Навіщо: витягнуте пряме посилання часто закрите перевіркою Referer —
 * браузер такий заголовок підставити не може, а ми можемо. Пропустивши потік
 * через себе, ми віддаємо його нашому плеєру, а отже отримуємо повну
 * синхронізацію (пауза, перемотка, підгонка швидкості).
 *
 * Ціна — трафік хоста. Тому:
 *   • проксі вмикається лише коли без нього не працює;
 *   • посилання підписані HMAC — ми не стаємо відкритим проксі;
 *   • сегменти HLS ненадовго кешуються: зал дивиться одну секунду фільму,
 *     тож той самий шматок віддається всім з одного завантаження.
 */
const SECRET = process.env.PROXY_SECRET
  || crypto.createHash('sha256').update(process.env.DISCORD_TOKEN ?? 'momentus').digest('hex');

const TTL_MS = 6 * 3600_000;          // підпис живе довше за фільм
const CACHE_MAX = 40;                 // сегментів у памʼяті
const CACHE_BYTES = 64 * 1024 * 1024; // і не більше цього обсягу
const cache = new Map();              // key → { at, type, body }
let cacheBytes = 0;

/** Підписати посилання. Повертає шлях виду /stream?u=…&h=…&e=… */
export function signUrl(url, headers = {}) {
  const exp = Date.now() + TTL_MS;
  const hdr = pickHeaders(headers);
  const payload = `${url}|${exp}|${JSON.stringify(hdr)}`;
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  const params = new URLSearchParams({ u: url, e: String(exp), s: sig });
  if (Object.keys(hdr).length) params.set('h', Buffer.from(JSON.stringify(hdr)).toString('base64url'));
  return `/stream?${params}`;
}

function verify(params) {
  const url = params.get('u');
  const exp = Number(params.get('e') ?? 0);
  const sig = params.get('s') ?? '';
  if (!url || exp < Date.now()) return null;

  let hdr = {};
  try {
    const raw = params.get('h');
    if (raw) hdr = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const expected = crypto.createHmac('sha256', SECRET)
    .update(`${url}|${exp}|${JSON.stringify(hdr)}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return { url, headers: hdr };
}

/** Обробник маршруту /stream. */
export async function handleStream(req, res, url) {
  const ok = verify(url.searchParams);
  if (!ok) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('bad signature');
  }

  const range = req.headers.range;
  const isSegment = /\.(ts|m4s|aac|mp4)(\?|$)/i.test(ok.url) && !range;
  const key = ok.url;

  // Сегмент уже качали для іншого глядача — віддаємо з памʼяті.
  if (isSegment) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < 120_000) {
      res.writeHead(200, {
        'Content-Type': hit.type,
        'Content-Length': hit.body.length,
        'Cache-Control': 'public, max-age=60',
        'X-Cache': 'hit',
      });
      return res.end(hit.body);
    }
  }

  const headers = { ...ok.headers };
  if (range) headers.range = range;
  headers['user-agent'] ??= 'Mozilla/5.0 (compatible; MomentusBot/1.0)';

  let upstream;
  try {
    upstream = await fetch(ok.url, { headers, redirect: 'follow' });
  } catch (err) {
    log.warn(`не дістав ${short(ok.url)}: ${err.message}`);
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    return res.end('upstream failed');
  }

  const type = upstream.headers.get('content-type') ?? 'application/octet-stream';

  // Маніфест HLS: переписуємо всі внутрішні посилання на себе,
  // інакше сегменти підуть повз проксі й знову впруться в Referer.
  if (/mpegurl/i.test(type) || /\.m3u8(\?|$)/i.test(ok.url)) {
    const text = await upstream.text();
    const rewritten = rewriteManifest(text, ok.url, ok.headers);
    res.writeHead(upstream.status, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(rewritten);
  }

  const head = {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Accept-Ranges': 'bytes',
  };
  for (const h of ['content-length', 'content-range']) {
    const v = upstream.headers.get(h);
    if (v) head[h === 'content-length' ? 'Content-Length' : 'Content-Range'] = v;
  }

  // Дрібні сегменти кладемо в кеш — зал дивиться синхронно, тож
  // наступні глядачі візьмуть той самий шматок без нового завантаження.
  const len = Number(upstream.headers.get('content-length') ?? 0);
  if (isSegment && upstream.ok && len > 0 && len < 8 * 1024 * 1024) {
    const body = Buffer.from(await upstream.arrayBuffer());
    remember(key, type, body);
    res.writeHead(upstream.status, { ...head, 'Content-Length': body.length, 'X-Cache': 'miss' });
    return res.end(body);
  }

  res.writeHead(upstream.status, head);
  if (!upstream.body) return res.end();

  // Потік віддаємо шматками, не тримаючи фільм у памʼяті.
  const reader = upstream.body.getReader();
  const pump = async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!res.write(Buffer.from(value))) {
          await new Promise((r) => res.once('drain', r));
        }
      }
    } catch { /* глядач закрив вкладку */ } finally {
      res.end();
    }
  };
  req.on('close', () => reader.cancel().catch(() => {}));
  return pump();
}

/** Усі посилання в маніфесті ведемо через себе. */
function rewriteManifest(text, baseUrl, headers) {
  return text.split('\n').map((line) => {
    const s = line.trim();
    if (!s) return line;

    // рядки-теги: усередині може бути URI="..."
    if (s.startsWith('#')) {
      return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${signUrl(abs(u, baseUrl), headers)}"`);
    }
    return signUrl(abs(s, baseUrl), headers);
  }).join('\n');
}

function abs(u, base) {
  try {
    return new URL(u, base).href;
  } catch {
    return u;
  }
}

function remember(key, type, body) {
  cache.set(key, { at: Date.now(), type, body });
  cacheBytes += body.length;
  while (cache.size > CACHE_MAX || cacheBytes > CACHE_BYTES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cacheBytes -= cache.get(oldest).body.length;
    cache.delete(oldest);
  }
}

/** Лишаємо тільки ті заголовки, які справді потрібні CDN. */
function pickHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h ?? {})) {
    const key = k.toLowerCase();
    if (['referer', 'origin', 'user-agent', 'cookie'].includes(key) && v) out[key] = String(v);
  }
  return out;
}

function short(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return String(u).slice(0, 40);
  }
}
