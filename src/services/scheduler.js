import { reputationService } from './reputationService.js';
import { backupService } from './backupService.js';
import { reputationRepo, warnRepo, staffRepo } from '../database/repositories.js';
import { pipeline } from './analysisPipeline.js';
import { punishmentService } from './punishmentService.js';
import { cosmeticsService } from './cosmeticsService.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('scheduler');

/** Періодичні фонові задачі: знімки репутації, флаш пайплайну, бекапи, ретенція. */
export function startScheduler(client) {
  // Флаш черги аналізу кожні 30 сек — на випадок неповних пакетів.
  setInterval(() => pipeline.flushAll(), 30_000);

  // Покарання з терміном знімаються самі — раз на хвилину звіряємо час.
  // Заразом прибираємо згаслі попередження, щоб таблиця не росла.
  setInterval(() => {
    punishmentService.liftExpired(client).catch(() => {});
    warnRepo.purge().catch(() => {});
    staffRepo.purge().catch(() => {});
  }, 60_000);

  // Рейтинг оновлюється сам: хто був активний — потрапляє в чергу,
  // і раз на пʼять хвилин вона перераховується пачкою.
  setInterval(() => {
    reputationService.flushDirty(150)
      .then((n) => { if (n) log.info(`Рейтинг оновлено: ${n} учасник(ів)`); })
      .catch(() => {});
  }, 5 * 60_000);

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
      let fp = 0;
      for (const r of rows) {
        await reputationService.snapshot(guildId, r.user_id);
        // ✨FP за вчорашню активність; повторний виклик за той самий день нічого не додасть
        fp += await cosmeticsService.grantDaily(guildId, r.user_id).catch(() => 0);
      }
      if (fp) log.info(`Нараховано ${fp} FP у ${guildId}`);
    }
    await backupService.run();
    await backupService.purgeOldData(guildIds);
    log.info('Щоденні задачі виконано.');
  } catch (err) {
    log.error('runDaily впав', err.message);
  }
}
