import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { createLogger } from '../core/logger.js';

const log = createLogger('db');

/**
 * Сховище: Turso (хмарний libSQL) або локальний файл.
 * - Якщо задано TURSO_DATABASE_URL → працюємо з хмарою (дані переживають ефемерний хост).
 * - Інакше → локальний файл `file:<DATABASE_PATH>` (для розробки).
 * Клієнт libSQL асинхронний, тож увесь шар даних — async.
 */
const LOCAL_PATH = process.env.DATABASE_PATH ?? './data/community.db';
const url = process.env.TURSO_DATABASE_URL || `file:${LOCAL_PATH}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const isRemote = !url.startsWith('file:');
export const localFilePath = isRemote ? null : url.slice('file:'.length);

if (localFilePath) {
  fs.mkdirSync(path.dirname(localFilePath), { recursive: true });
}

export const client = createClient({ url, authToken });

/** Схема БД. Міграції ідемпотентні (IF NOT EXISTS). */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  guild_id           TEXT NOT NULL,
  user_id            TEXT NOT NULL,
  username           TEXT,
  joined_at          INTEGER,
  first_seen_at      INTEGER NOT NULL,
  last_seen_at       INTEGER NOT NULL,
  total_messages     INTEGER NOT NULL DEFAULT 0,
  total_chars        INTEGER NOT NULL DEFAULT 0,
  voice_minutes      INTEGER NOT NULL DEFAULT 0,
  reactions_given    INTEGER NOT NULL DEFAULT 0,
  reactions_received INTEGER NOT NULL DEFAULT 0,
  help_count         INTEGER NOT NULL DEFAULT 0,
  night_messages     INTEGER NOT NULL DEFAULT 0,
  deleted_messages   INTEGER NOT NULL DEFAULT 0,
  distinct_peers     INTEGER NOT NULL DEFAULT 0,
  events_attended    INTEGER NOT NULL DEFAULT 0,
  projects_joined    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS traits (
  guild_id           TEXT NOT NULL,
  user_id            TEXT NOT NULL,
  samples            INTEGER NOT NULL DEFAULT 0,
  politeness         REAL NOT NULL DEFAULT 50,
  toxicity           REAL NOT NULL DEFAULT 0,
  insult             REAL NOT NULL DEFAULT 0,
  bullying           REAL NOT NULL DEFAULT 0,
  harassment         REAL NOT NULL DEFAULT 0,
  passiveAggression  REAL NOT NULL DEFAULT 0,
  sarcasm            REAL NOT NULL DEFAULT 0,
  threat             REAL NOT NULL DEFAULT 0,
  profanity          REAL NOT NULL DEFAULT 0,
  constructiveness   REAL NOT NULL DEFAULT 50,
  adequacy           REAL NOT NULL DEFAULT 50,
  helpfulness        REAL NOT NULL DEFAULT 30,
  friendliness       REAL NOT NULL DEFAULT 50,
  respect            REAL NOT NULL DEFAULT 50,
  positiveImpact     REAL NOT NULL DEFAULT 40,
  cultureLevel       REAL NOT NULL DEFAULT 50,
  provocation        REAL NOT NULL DEFAULT 0,
  flood              REAL NOT NULL DEFAULT 0,
  spam               REAL NOT NULL DEFAULT 0,
  advertising        REAL NOT NULL DEFAULT 0,
  conflictSeeking    REAL NOT NULL DEFAULT 0,
  updated_at         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS reputation (
  guild_id       TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  trust          REAL NOT NULL DEFAULT 50,
  activity       REAL NOT NULL DEFAULT 0,
  communication  REAL NOT NULL DEFAULT 50,
  helpfulness    REAL NOT NULL DEFAULT 30,
  usefulness     REAL NOT NULL DEFAULT 30,
  stability      REAL NOT NULL DEFAULT 50,
  behavior       REAL NOT NULL DEFAULT 60,
  conflict       REAL NOT NULL DEFAULT 0,
  toxicity       REAL NOT NULL DEFAULT 0,
  violations     REAL NOT NULL DEFAULT 0,
  peer           REAL NOT NULL DEFAULT 50,
  ai_score       INTEGER NOT NULL DEFAULT 500,
  updated_at     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS activity_daily (
  guild_id      TEXT NOT NULL,
  user_id       TEXT NOT NULL,
  day           TEXT NOT NULL,
  messages      INTEGER NOT NULL DEFAULT 0,
  chars         INTEGER NOT NULL DEFAULT 0,
  voice_minutes INTEGER NOT NULL DEFAULT 0,
  reactions_in  INTEGER NOT NULL DEFAULT 0,
  reactions_out INTEGER NOT NULL DEFAULT 0,
  new_peers     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id, day)
);

CREATE TABLE IF NOT EXISTS reputation_snapshots (
  guild_id  TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  day       TEXT NOT NULL,
  ai_score  INTEGER NOT NULL,
  payload   TEXT NOT NULL,
  PRIMARY KEY (guild_id, user_id, day)
);

CREATE TABLE IF NOT EXISTS moderation_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id       TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  moderator_id   TEXT NOT NULL,
  action         TEXT NOT NULL,
  reason         TEXT,
  note           TEXT,
  duration_ms    INTEGER,
  ai_context     TEXT,
  repeat_index   INTEGER NOT NULL DEFAULT 1,
  result         TEXT,
  created_at     INTEGER NOT NULL,
  reverted_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_modlog_user ON moderation_log (guild_id, user_id, created_at DESC);

-- ── ЧИННІ ПОКАРАННЯ ─────────────────────────
-- Окремо від журналу: журнал — це історія, а тут те, що діє просто зараз
-- і що треба зняти, коли вийде час.
CREATE TABLE IF NOT EXISTS punishments (
  guild_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  kind         TEXT NOT NULL,          -- text | voice | full
  until        INTEGER,                -- null → назавжди, поки не знімуть
  reason       TEXT,
  moderator_id TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_punish_until ON punishments (until);

-- ── ПОПЕРЕДЖЕННЯ ────────────────────────────
-- Живуть 72 години й згасають самі. Три чинні одночасно — автоматичний мут,
-- після якого список обнуляється. Будь-яке інше покарання теж його обнуляє.
CREATE TABLE IF NOT EXISTS warnings (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id     TEXT NOT NULL,
  user_id      TEXT NOT NULL,
  reason       TEXT,
  moderator_id TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  expires_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_warn_user ON warnings (guild_id, user_id, expires_at);

-- ── Косметика: гаманець, покупки й вигляд профілю ──
-- Валюта ✨FP нараховується за активність; куплене лишається назавжди,
-- навіть якщо людина перестала бустити сервер.
CREATE TABLE IF NOT EXISTS wallets (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  balance    INTEGER NOT NULL DEFAULT 0,
  earned     INTEGER NOT NULL DEFAULT 0,
  last_grant TEXT,
  PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS user_items (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  price      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, item_id)
);

-- Особисті картинки для оформлення (фони, банери). Самі файли лежать
-- у приватному каналі-сховищі Discord, тут — лише посилання на них.
CREATE TABLE IF NOT EXISTS user_assets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  mime        TEXT,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  object_key  TEXT,
  url         TEXT,
  url_expires INTEGER,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_user ON user_assets (guild_id, user_id, created_at);

-- Вигляд сторінки учасника: банер, опис, обране оформлення.
CREATE TABLE IF NOT EXISTS profile_prefs (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  about      TEXT,
  banner     TEXT,
  accent     TEXT,
  background TEXT,
  layout     TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Дії персоналу з нативними правами Discord: відключення з голосового,
-- серверні мути, кіки, бани. Потрібні лише для нагляду, тож живуть недовго.
CREATE TABLE IF NOT EXISTS staff_actions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id     TEXT NOT NULL,
  moderator_id TEXT NOT NULL,
  target_id    TEXT,
  action       TEXT NOT NULL,
  weight       REAL NOT NULL DEFAULT 1,
  created_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_staff_mod ON staff_actions (guild_id, moderator_id, created_at);

CREATE TABLE IF NOT EXISTS achievements (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  key        TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, key)
);

CREATE TABLE IF NOT EXISTS role_grants (
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  role_key   TEXT NOT NULL,
  role_id    TEXT,
  status     TEXT NOT NULL,
  reason     TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, role_key)
);

CREATE TABLE IF NOT EXISTS ai_insights (
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  kind        TEXT NOT NULL,
  payload     TEXT NOT NULL,
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id, kind)
);

CREATE TABLE IF NOT EXISTS config (
  guild_id TEXT NOT NULL,
  key      TEXT NOT NULL,
  value    TEXT NOT NULL,
  PRIMARY KEY (guild_id, key)
);

CREATE TABLE IF NOT EXISTS ai_usage (
  day        TEXT PRIMARY KEY,
  calls      INTEGER NOT NULL DEFAULT 0,
  in_tokens  INTEGER NOT NULL DEFAULT 0,
  out_tokens INTEGER NOT NULL DEFAULT 0,
  errors     INTEGER NOT NULL DEFAULT 0
);

-- ── ВЕБ-САЙТ ────────────────────────────────
-- Редагований контент сайту живе в Turso: змінюється без редеплою бота.
CREATE TABLE IF NOT EXISTS site_pages (
  guild_id   TEXT NOT NULL,
  slug       TEXT NOT NULL,          -- 'home', 'rules', 'about', ...
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,          -- HTML або Markdown-подібний текст
  published  INTEGER NOT NULL DEFAULT 1,
  position   INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, slug)
);

-- Довільні «файли» сайту (CSS, лого, картинки) — base64 або текст.
CREATE TABLE IF NOT EXISTS site_assets (
  guild_id   TEXT NOT NULL,
  path       TEXT NOT NULL,          -- '/custom.css', '/logo.png'
  mime       TEXT NOT NULL,
  content    TEXT NOT NULL,
  encoding   TEXT NOT NULL DEFAULT 'utf8',  -- utf8 | base64
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (guild_id, path)
);

-- ── ГАЛЕРЕЯ («кліпи») ───────────────────────
-- Медіа лежить у БД (на хості бота диск обмежений). Вміст — base64.
CREATE TABLE IF NOT EXISTS gallery_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  username   TEXT,
  title      TEXT,
  kind       TEXT NOT NULL,          -- image | gif | video
  mime       TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content    TEXT NOT NULL,          -- base64
  likes      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gallery_guild ON gallery_items (guild_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_user ON gallery_items (guild_id, user_id);

-- Стан спільного перегляду: одна кімната на гільдію.
CREATE TABLE IF NOT EXISTS cinema_state (
  guild_id    TEXT PRIMARY KEY,
  source      TEXT,                   -- пряме посилання на відео або /media/<id>
  title       TEXT,
  playing     INTEGER NOT NULL DEFAULT 0,
  position_ms INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  updated_by  TEXT
);

-- Черга кінотеатру: що вмикати далі.
CREATE TABLE IF NOT EXISTS cinema_queue (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  source     TEXT NOT NULL,          -- вже розібране посилання
  page_url   TEXT,                   -- що саме вставив користувач
  provider   TEXT NOT NULL DEFAULT 'file',
  sync_mode  TEXT NOT NULL DEFAULT 'full',
  qualities  TEXT,
  title      TEXT,
  added_by   TEXT NOT NULL,
  added_name TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cinema_queue ON cinema_queue (guild_id, created_at);

-- Журнал дій у залі: хто що вмикав, ставив на паузу, перемотував.
CREATE TABLE IF NOT EXISTS cinema_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  user_id    TEXT,
  username   TEXT,
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cinema_log ON cinema_log (guild_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gallery_likes (
  item_id    INTEGER NOT NULL,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (item_id, user_id)
);

-- Сесії веб-входу через Discord OAuth2 (переживають рестарт).
CREATE TABLE IF NOT EXISTS web_sessions (
  token      TEXT PRIMARY KEY,
  guild_id   TEXT,
  user_id    TEXT NOT NULL,
  username   TEXT,
  avatar     TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_exp ON web_sessions (expires_at);

CREATE TABLE IF NOT EXISTS message_samples (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id   TEXT NOT NULL,
  user_id    TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_samples_user ON message_samples (guild_id, user_id, created_at DESC);
`;

/**
 * Додає колонку, якщо її ще немає. CREATE TABLE IF NOT EXISTS не змінює
 * наявні таблиці, тож нові поля треба доносити окремо.
 */
async function addColumn(table, column, definition) {
  try {
    const info = await client.execute(`PRAGMA table_info(${table})`);
    if (info.rows.some((r) => r.name === column)) return false;
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    log.info(`Міграція: ${table}.${column} додано`);
    return true;
  } catch (err) {
    log.warn(`Міграція ${table}.${column} не вдалася`, err.message);
    return false;
  }
}

export async function initDatabase() {
  if (localFilePath) {
    // WAL/PRAGMA доречні лише для локального файлу.
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('PRAGMA foreign_keys = ON');
  }
  await client.executeMultiple(SCHEMA);

  // ── міграції ──
  // Медіа галереї може лежати в об'єктному сховищі (S3/R2), а не в БД.
  await addColumn('gallery_items', 'storage', "TEXT NOT NULL DEFAULT 'db'");
  await addColumn('gallery_items', 'object_key', 'TEXT');
  await addColumn('gallery_items', 'url', 'TEXT');
  await addColumn('gallery_items', 'width', 'INTEGER');
  await addColumn('gallery_items', 'height', 'INTEGER');
  // Аватар автора на момент публікації — щоб показувати його під кліпом,
  // навіть якщо учасник уже вийшов із сервера.
  await addColumn('gallery_items', 'avatar', 'TEXT');
  // Посилання Discord-CDN підписані й живуть ~24 год — тримаємо час протухання.
  await addColumn('gallery_items', 'url_expires', 'INTEGER');
  await addColumn('gallery_items', 'edited_at', 'INTEGER');
  // Кінотеатр вміє не лише прямі файли: youtube/vimeo/twitch/hls/iframe.
  await addColumn('cinema_state', 'provider', "TEXT NOT NULL DEFAULT 'file'");
  await addColumn('cinema_state', 'sync_mode', "TEXT NOT NULL DEFAULT 'full'");
  await addColumn('cinema_state', 'page_url', 'TEXT');
  // Список якостей одного джерела (JSON) — кожен глядач обирає свою.
  await addColumn('cinema_state', 'qualities', 'TEXT');
  // Порядок у черзі: можна переставляти, не чіпаючи час додавання.
  await addColumn('cinema_queue', 'position', 'INTEGER');
  // Озвучки одного відео (JSON): дубляж, оригінал, субтитри.
  await addColumn('cinema_state', 'variants', 'TEXT');
  // Чи можна зупиняти некерований плеєр зняттям рамки. Деякі сайти після
  // цього стартують з нуля — тоді режим вимикають.
  await addColumn('cinema_state', 'hard_pause', 'INTEGER NOT NULL DEFAULT 1');

  log.info(`База даних готова: ${isRemote ? 'Turso (remote)' : url}`);
}

// ─────────────────────────────────────────────
//  Тонкі async-хелпери запитів
// ─────────────────────────────────────────────

/** Виконати запит, повернути повний результат ({rows, rowsAffected, lastInsertRowid}). */
export function run(sql, args) {
  return args === undefined ? client.execute(sql) : client.execute({ sql, args });
}

/** Перший рядок або undefined. */
export async function get(sql, args) {
  const res = args === undefined ? await client.execute(sql) : await client.execute({ sql, args });
  return res.rows[0];
}

/** Усі рядки. */
export async function all(sql, args) {
  const res = args === undefined ? await client.execute(sql) : await client.execute({ sql, args });
  return res.rows;
}

/** Обгортка транзакції через libSQL batch (усі запити атомарно). */
export async function batch(statements) {
  return client.batch(statements, 'write');
}
