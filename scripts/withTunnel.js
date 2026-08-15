/**
 * Запуск бота РАЗОМ із Cloudflare Tunnel в одному контейнері.
 *
 * Підтримує два режими (обирається автоматично):
 *
 *  1) ТОКЕН (тунель створено в дашборді Zero Trust):
 *       CLOUDFLARE_TUNNEL_TOKEN=eyJ...
 *
 *  2) ФАЙЛ ОБЛІКОВИХ ДАНИХ (тунель створено через `cloudflared tunnel create`) —
 *     не потребує Zero Trust-дашборду й прив'язки картки:
 *       CLOUDFLARE_TUNNEL_ID=<UUID тунелю>
 *       CLOUDFLARE_TUNNEL_CREDENTIALS=<вміст <UUID>.json одним рядком>
 *     або замість CREDENTIALS покласти файл у ./data/tunnel/<UUID>.json
 *
 * Адреса сайту береться з WEB_PUBLIC_URL, порт — із SERVER_PORT/WEB_PORT.
 * Якщо тунель налаштувати не вдалося — бот однаково стартує (сайт лишиться на IP:порт).
 *
 * Startup Command:  node scripts/withTunnel.js
 */
// ВАЖЛИВО: .env треба завантажити ДО читання process.env — інакше змінні тунелю
// будуть невидимі (бот підвантажує dotenv пізніше, вже у src/index.js).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const DIR = './data/tunnel';
const BIN = path.join('./data/bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared');
const RELEASES = 'https://github.com/cloudflare/cloudflared/releases/latest/download';

const TOKEN = process.env.CLOUDFLARE_TUNNEL_TOKEN;
const TUNNEL_ID = process.env.CLOUDFLARE_TUNNEL_ID;
const CREDS = process.env.CLOUDFLARE_TUNNEL_CREDENTIALS;

const PORT = process.env.SERVER_PORT || process.env.WEB_PORT || 8080;
const HOSTNAME = hostnameOf(process.env.WEB_PUBLIC_URL);

function hostnameOf(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function assetName() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';
  if (process.platform === 'win32') return 'cloudflared-windows-amd64.exe';
  if (process.platform === 'darwin') return null;
  return `cloudflared-linux-${arch}`;
}

async function ensureBinary() {
  if (fs.existsSync(BIN)) return true;
  const asset = assetName();
  if (!asset) {
    console.warn('[tunnel] Платформа не підтримується цим лаунчером.');
    return false;
  }

  console.log('[tunnel] Завантажую cloudflared…');
  fs.mkdirSync(path.dirname(BIN), { recursive: true });

  const res = await fetch(`${RELEASES}/${asset}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(BIN, buf);
  if (process.platform !== 'win32') fs.chmodSync(BIN, 0o755);

  console.log(`[tunnel] Готово (${(buf.length / 1048576).toFixed(1)} MB).`);
  return true;
}

/** Режим 2: готуємо credentials-файл і config.yml, повертаємо аргументи запуску. */
function prepareConfigMode() {
  if (!TUNNEL_ID) return null;
  if (!HOSTNAME) {
    console.warn('[tunnel] Потрібен WEB_PUBLIC_URL (напр. https://moments.zadrypanka.xyz).');
    return null;
  }

  fs.mkdirSync(DIR, { recursive: true });
  const credFile = path.resolve(DIR, `${TUNNEL_ID}.json`);

  if (CREDS && !fs.existsSync(credFile)) {
    try {
      JSON.parse(CREDS); // валідація
      fs.writeFileSync(credFile, CREDS, { mode: 0o600 });
      console.log('[tunnel] Облікові дані збережено.');
    } catch {
      console.warn('[tunnel] CLOUDFLARE_TUNNEL_CREDENTIALS не є коректним JSON.');
      return null;
    }
  }

  if (!fs.existsSync(credFile)) {
    console.warn(`[tunnel] Немає файлу ${credFile} — завантаж його або задай CLOUDFLARE_TUNNEL_CREDENTIALS.`);
    return null;
  }

  const cfgFile = path.resolve(DIR, 'config.yml');
  const cfg = [
    `tunnel: ${TUNNEL_ID}`,
    `credentials-file: ${credFile}`,
    'ingress:',
    `  - hostname: ${HOSTNAME}`,
    `    service: http://localhost:${PORT}`,
    '  - service: http_status:404',
    '',
  ].join('\n');
  fs.writeFileSync(cfgFile, cfg);

  console.log(`[tunnel] ${HOSTNAME} → localhost:${PORT}`);
  return ['tunnel', '--no-autoupdate', '--config', cfgFile, 'run'];
}

function start(args) {
  const proc = spawn(BIN, args, { stdio: ['ignore', 'inherit', 'inherit'] });
  proc.on('error', (err) => console.warn('[tunnel] Не запустився:', err.message));
  proc.on('exit', (code) => console.warn(`[tunnel] Завершився з кодом ${code}.`));

  const stop = () => { try { proc.kill(); } catch { /* ignore */ } };
  process.on('exit', stop);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  console.log('[tunnel] Тунель запущено.');
}

/** Показує, які саме змінні бачить процес — щоб не гадати, чого бракує. */
function diagnose() {
  const mark = (v) => (v ? '✅ є' : '❌ немає');
  console.warn('[tunnel] Перевірка змінних середовища:');
  console.warn(`  CLOUDFLARE_TUNNEL_TOKEN       ${mark(TOKEN)}`);
  console.warn(`  CLOUDFLARE_TUNNEL_ID          ${mark(TUNNEL_ID)}`);
  console.warn(`  CLOUDFLARE_TUNNEL_CREDENTIALS ${mark(CREDS)}`);
  console.warn(`  WEB_PUBLIC_URL                ${mark(process.env.WEB_PUBLIC_URL)}`);
  console.warn('[tunnel] Потрібен АБО TOKEN, АБО (ID + CREDENTIALS + WEB_PUBLIC_URL).');
  console.warn('[tunnel] Змінні беруться з файлу .env у /home/container (не з .env.example).');
}

try {
  const args = TOKEN
    ? ['tunnel', '--no-autoupdate', 'run', '--token', TOKEN]
    : prepareConfigMode();

  if (!args) {
    diagnose();
    console.warn('[tunnel] Стартую лише бота (сайт доступний за IP:порт).');
  } else if (await ensureBinary()) {
    start(args);
  }
} catch (err) {
  console.warn('[tunnel] Пропускаю тунель:', err.message);
}

// Бот стартує в будь-якому разі
await import('../src/index.js');
