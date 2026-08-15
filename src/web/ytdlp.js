import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { constants as fsc } from 'node:fs';
import { createLogger } from '../core/logger.js';

const log = createLogger('ytdlp');

/**
 * Витягування прямого потоку через yt-dlp.
 *
 * Навіщо: повна синхронізація (пауза, перемотка, підгонка швидкості) можлива
 * лише тоді, коли відео грає НАШ плеєр. Чужим плеєром у рамці ми керувати
 * не можемо — це заборона браузера. yt-dlp знає, як дістати пряме посилання
 * з понад тисячі сайтів, і його підтримують за нас.
 *
 * Якщо бінарника немає — просто повертаємо null, і кінотеатр працює як раніше.
 */
// Довше 12 с чекати немає сенсу: якщо сайт не піддався одразу, він не піддасться,
// а зал у цей час просто дивиться на порожній екран.
const TIMEOUT_MS = Number(process.env.YTDLP_TIMEOUT_MS || 12_000);
const DISABLED = String(process.env.YTDLP_DISABLED).toLowerCase() === 'true';

/**
 * Корінь проєкту рахуємо від самого файлу, а не від cwd: панель хостингу
 * нерідко запускає бота з іншої теки, і тоді відносний шлях не знайшовся б.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BIN_DIR = path.join(ROOT, 'bin');

/** Під ARM-хости потрібен свій бінарник — x86-збірка там просто не запуститься. */
// У проєкті лежить збірка під x86-64 (саме такий хост). Для ARM бінарник
// довантажують окремо — тоді він знайдеться першим.
const ARCH_FIRST = process.arch === 'arm64' || process.arch === 'arm'
  ? ['yt-dlp_linux_aarch64', 'yt-dlp_linux']
  : ['yt-dlp_linux', 'yt-dlp_linux_aarch64'];

const CANDIDATES = [
  process.env.YTDLP_PATH,
  ...ARCH_FIRST.map((n) => path.join(BIN_DIR, n)),
  path.join(BIN_DIR, 'yt-dlp'),
  path.join(BIN_DIR, 'yt-dlp.exe'),
  'yt-dlp',
].filter(Boolean);

let BIN = CANDIDATES[0];
/** Що саме сталося з кожним кандидатом — для діагностики. */
export const probeLog = [];
let available = null;          // null — ще не перевіряли
const cache = new Map();       // url → { at, data }
const CACHE_MS = 10 * 60_000;

/** Чи є yt-dlp на хості. Перевіряємо один раз, перебираючи кандидатів. */
export async function ytdlpAvailable() {
  if (DISABLED) {
    available = false;
    return false;
  }
  if (available !== null) return available;

  for (const candidate of CANDIDATES) {
    BIN = candidate;
    // Файл із проєкту після завантаження на хост часто втрачає право на запуск —
    // повертаємо його самі, щоб не змушувати бігати в консоль за chmod.
    if (candidate.includes(path.sep)) {
      try {
        await fs.access(candidate, fsc.X_OK);
      } catch {
        try {
          await fs.chmod(candidate, 0o755);
          log.info(`Дозвіл на запуск для ${candidate} відновлено`);
        } catch {
          continue; // немає файлу — пробуємо наступного кандидата
        }
      }
    }

    try {
      const out = await exec(['--version'], 8000);
      if (out.trim()) {
        available = true;
        log.info(`yt-dlp ${out.trim()} — ${candidate}`);
        return true;
      }
    } catch { /* цей кандидат не підійшов */ }
  }

  available = false;
  log.info('yt-dlp не знайдено — сайти без прямого посилання йтимуть рамкою');
  return false;
}

/**
 * @returns {Promise<null|{provider:string,src:string,sync:string,title?:string,
 *   qualities:Array,variants:Array,headers:object}>}
 */
export async function ytdlpResolve(pageUrl) {
  if (!(await ytdlpAvailable())) return null;

  const hit = cache.get(pageUrl);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const info = await dump(pageUrl);
  if (!info) return null;

  const data = shape(info);
  cache.set(pageUrl, { at: Date.now(), data });
  return data;
}

/** Справжній браузерний User-Agent: із «ботом» у назві сайти віддають 403. */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
  + '(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/**
 * Запит до yt-dlp. Спершу з підміною відбитка браузера (--impersonate) —
 * саме вона проходить захист Cloudflare, який інакше віддає 403.
 * Якщо збірка цього не вміє, тихо повторюємо без неї.
 */
async function dump(pageUrl) {
  const base = [
    '--dump-single-json',
    '--no-warnings',
    '--no-playlist',
    '--no-check-certificates',
    '--live-from-start',
    '--user-agent', UA,
    '--add-header', `Referer:${originOf(pageUrl)}`,
    '--add-header', 'Accept-Language:uk-UA,uk;q=0.9,en;q=0.8',
  ];

  for (const args of [['--impersonate', 'chrome', ...base], base]) {
    try {
      return JSON.parse(await exec([...args, pageUrl], TIMEOUT_MS));
    } catch (err) {
      const msg = err.message ?? '';
      // немає curl_cffi у збірці — просто пробуємо без підміни відбитка
      if (/impersonat|curl_cffi/i.test(msg)) continue;
      log.warn(`yt-dlp не впорався з ${short(pageUrl)}: ${msg}`);
      return null;
    }
  }
  return null;
}

function originOf(u) {
  try {
    return new URL(u).origin + '/';
  } catch {
    return '';
  }
}

/** Приводимо відповідь yt-dlp до нашого формату джерела. */
function shape(info) {
  const formats = Array.isArray(info?.formats) ? info.formats : [];

  // Нас цікавлять формати, які браузер програє сам: прогресивні mp4/webm
  // (відео+звук в одному файлі) або HLS-маніфести.
  const playable = formats.filter((f) => {
    if (!f.url) return false;
    if (f.protocol === 'm3u8' || f.protocol === 'm3u8_native') return true;
    return f.vcodec && f.vcodec !== 'none' && f.acodec && f.acodec !== 'none';
  });

  if (!playable.length) {
    // деякі сайти віддають єдине посилання без списку форматів
    if (info?.url) {
      return {
        provider: /\.m3u8/i.test(info.url) ? 'hls' : 'file',
        src: info.url,
        sync: 'full',
        title: info.title ?? null,
        qualities: [],
        variants: [],
        headers: info.http_headers ?? {},
      };
    }
    return null;
  }

  const qualities = playable
    .map((f) => ({
      label: f.height ? `${f.height}p` : (f.format_note || f.format_id || 'auto'),
      height: Number(f.height ?? 0),
      url: f.url,
      hls: f.protocol?.startsWith('m3u8') ?? false,
      headers: f.http_headers ?? info.http_headers ?? {},
    }))
    .sort((a, b) => b.height - a.height);

  // Різні мови звуку yt-dlp позначає в audio_ext/language — це і є озвучки.
  const byLang = new Map();
  for (const f of playable) {
    const lang = f.language || f.format_note;
    if (!lang) continue;
    if (!byLang.has(lang)) byLang.set(lang, []);
    byLang.get(lang).push(f);
  }
  const variants = byLang.size > 1
    ? [...byLang.entries()].map(([label, fs]) => {
      const best = fs.slice().sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
      return {
        label,
        src: best.url,
        provider: best.protocol?.startsWith('m3u8') ? 'hls' : 'file',
        qualities: fs.map((f) => ({
          label: f.height ? `${f.height}p` : (f.format_note || 'auto'),
          height: Number(f.height ?? 0),
          url: f.url,
        })).sort((a, b) => b.height - a.height),
      };
    })
    : [];

  const top = qualities[0];
  return {
    provider: top.hls ? 'hls' : 'file',
    src: top.url,
    sync: 'full',
    title: info.title ?? null,
    qualities,
    variants,
    // Частина CDN вимагає рідний Referer — віддамо їх проксі.
    headers: top.headers ?? {},
  };
}

function exec(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(BIN, args, { windowsHide: true });
    } catch (err) {
      return reject(err);
    }

    let out = '';
    let err = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('таймаут'));
    }, timeoutMs);

    child.stdout.on('data', (c) => {
      out += c;
      // захист від велетенського JSON
      if (out.length > 8 * 1024 * 1024) {
        child.kill('SIGKILL');
        reject(new Error('завелика відповідь'));
      }
    });
    child.stderr.on('data', (c) => { err += String(c).slice(0, 2000); });
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(out);
      else reject(new Error(err.split('\n').filter(Boolean).pop() ?? `код ${code}`));
    });
  });
}

function short(u) {
  try {
    return new URL(u).hostname;
  } catch {
    return String(u).slice(0, 40);
  }
}
