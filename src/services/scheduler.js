import { reputationService } from './reputationService.js';
import { backupService } from './backupService.js';
import { reputationRepo } from '../database/repositories.js';
import { pipeline } from './analysisPipeline.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('scheduler');

/** Періодичні фонові задачі: знімки репутації, флаш пайплайну, бекапи, ретенція. */
export function startScheduler(client) {
  // Флаш черги аналізу кожні 30 сек — на випадок неповних пакетів.
  setInterval(() => pipeline.flushAll(), 30_000);

  // Щоденні знімки та бекап — раз на добу.
  setInterval(() => runDaily(client), 24 * 3600_000);

  // Перший запуск відкладено, щоб дати боту прогрітися.
  setTimeout(() => runDaily(client), 5 * 60_000);

  log.info('Планувальник запущено.');
}

async function runDaily(client) {
  try {
    const guildIds = [...client.guilds.cache.keys()];
    for (const guildId of guildIds) {
      const rows = await reputationRepo.leaderboard(guildId, 5000);
      for (const r of rows) await reputationService.snapshot(guildId, r.user_id);
    }
    await backupService.run();
    await backupService.purgeOldData(guildIds);
    log.info('Щоденні задачі виконано.');
  } catch (err) {
    log.error('runDaily впав', err.message);
  }
}
