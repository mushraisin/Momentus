/**
 * Скидання налаштування панелей: бот забуває, які канали привʼязані,
 * і при наступному старті знову надсилає майстер першого запуску.
 *
 * Дані учасників, репутація, галерея й кінотеатр НЕ чіпаються —
 * скидаються лише привʼязки каналів.
 *
 *   node scripts/resetSetup.js            # усі гільдії в базі
 *   node scripts/resetSetup.js <guildId>  # лише одна
 */
import 'dotenv/config';
import { initDatabase, all } from '../src/database/db.js';

await initDatabase();
const { configRepo } = await import('../src/database/repositories.js');
const { configService } = await import('../src/services/configService.js');

const only = process.argv[2];

// ключі, що відповідають саме за розміщення панелей
const KEYS = ['general.statsChannelId', 'general.adminChannelId'];

const rows = only
  ? [{ guild_id: only }]
  : await all('SELECT DISTINCT guild_id FROM config');

if (!rows.length) {
  console.log('У базі немає жодної гільдії — бот і так почне з нуля.');
  process.exit(0);
}

for (const { guild_id: guildId } of rows) {
  await configService.load(guildId);
  const before = KEYS.map((k) => `${k}=${configService.get(guildId, k) || '—'}`).join(', ');

  for (const key of KEYS) {
    await configService.set(guildId, key, '');
    await configRepo.remove?.(guildId, key).catch(() => {});
  }

  console.log(`✅ ${guildId}`);
  console.log(`   було: ${before}`);
  console.log('   стало: привʼязок немає — майстер зʼявиться при старті');
}

console.log('\nПерезапустіть бота: він надішле повідомлення з налаштуванням.');
process.exit(0);
