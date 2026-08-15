/** Ручний бекап БД: `npm run backup`. */
import 'dotenv/config';
import { initDatabase } from '../src/database/db.js';
import { backupService } from '../src/services/backupService.js';

await initDatabase();
const file = await backupService.run();
console.log(file
  ? `✅ Бекап створено: ${file}`
  : 'ℹ️ Бекап не створювався (Turso зберігає дані в хмарі, або сталася помилка).');
process.exit(0);
