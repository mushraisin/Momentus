import fs from 'node:fs';
import path from 'node:path';
import { client, isRemote, localFilePath } from '../database/db.js';
import { samplesRepo } from '../database/repositories.js';
import { configService } from './configService.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('backup');
const BACKUP_DIR = process.env.BACKUP_DIR ?? './data/backups';

/**
 * Резервне копіювання.
 * - Turso (remote): дані вже в хмарі й реплікуються — окремий бекап не потрібен
 *   (за потреби користуйся Turso branching / dumps). Метод — no-op з логом.
 * - Локальний файл: VACUUM INTO нову копію + ротація.
 */
export const backupService = {
  async run() {
    if (isRemote) {
      log.info('Сховище — Turso (remote); довговічність забезпечує хмара, локальний бекап пропущено.');
      return null;
    }
    try {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dest = path.join(BACKUP_DIR, `community-${stamp}.db`);
      await client.execute(`VACUUM INTO '${dest.replace(/'/g, "''")}'`);
      rotate(14);
      log.info(`Бекап створено: ${dest}`);
      return dest;
    } catch (err) {
      log.error('Бекап впав', err.message);
      return null;
    }
  },

  /** Прибирання застарілих аналітичних даних згідно з privacy.retentionDays. */
  async purgeOldData(guildIds = []) {
    let total = 0;
    const seen = new Set();
    for (const gid of guildIds) {
      const days = configService.get(gid, 'privacy.retentionDays');
      if (!days || seen.has(days)) continue;
      seen.add(days);
      total += await samplesRepo.purgeOlderThan(days);
    }
    if (total) log.info(`Очищено семплів повідомлень: ${total}`);
    return total;
  },
};

/** Прибирає старі копії, лишаючи `keep` найновіших. */
function rotate(keep) {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('community-') && f.endsWith('.db'))
    .sort()
    .reverse();
  for (const f of files.slice(keep)) {
    fs.rmSync(path.join(BACKUP_DIR, f), { force: true });
  }
}
