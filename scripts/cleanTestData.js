/**
 * Прибирання тестових даних із БД (гільдії з префіксами web-/test-/g-).
 * Потрібно після локальних прогонів тестів, якщо .env вказує на бойову Turso.
 */
import 'dotenv/config';
import { initDatabase, run, all } from '../src/database/db.js';

await initDatabase();

const TABLES = [
  'users', 'traits', 'reputation', 'activity_daily', 'reputation_snapshots',
  'site_pages', 'site_assets', 'moderation_log', 'role_grants', 'ai_insights',
  'config', 'message_samples', 'gallery_items', 'web_sessions',
  'punishments', 'warnings', 'staff_actions',
  'wallets', 'user_items', 'profile_prefs', 'user_assets',
];

/** Префікси, з якими тести створюють гільдії. */
const PREFIXES = ['web-%', 'test-%', 'g-%', 'staff-%'];
const WHERE = PREFIXES.map(() => 'guild_id LIKE ?').join(' OR ');

let total = 0;
for (const t of TABLES) {
  const sql = `DELETE FROM ${t} WHERE ${WHERE}`;
  try {
    const r = await run(sql, PREFIXES);
    const n = Number(r.rowsAffected ?? 0);
    if (n) {
      console.log(`  очищено ${t}: ${n}`);
      total += n;
    }
  } catch (err) {
    console.warn(`  ${t}: ${err.message}`);
  }
}

// лайки прив'язані до елементів, а не до гільдії — після видалення чистимо «сиріт»
try {
  const r = await run('DELETE FROM gallery_likes WHERE item_id NOT IN (SELECT id FROM gallery_items)');
  const n = Number(r.rowsAffected ?? 0);
  if (n) {
    console.log(`  очищено gallery_likes: ${n}`);
    total += n;
  }
} catch (err) {
  console.warn(`  gallery_likes: ${err.message}`);
}

console.log(`Разом видалено тестових рядків: ${total}`);

const left = await all('SELECT DISTINCT guild_id FROM users');
console.log('Гільдії в базі:', left.map((r) => r.guild_id).join(', ') || '(порожньо)');
process.exit(0);
