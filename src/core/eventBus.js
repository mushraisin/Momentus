import { EventEmitter } from 'node:events';
import { createLogger } from './logger.js';

const log = createLogger('bus');

/**
 * Внутрішня шина подій. Сервіси спілкуються через неї,
 * щоб не мати прямих залежностей один від одного.
 */
class Bus extends EventEmitter {
  emitSafe(event, payload) {
    try {
      this.emit(event, payload);
    } catch (err) {
      log.error(`Помилка обробника події ${event}`, err);
    }
  }
}

export const bus = new Bus();
bus.setMaxListeners(50);

/** Каталог подій — єдине джерело правди для назв. */
export const EVENTS = {
  MESSAGE_ANALYZED: 'message:analyzed',
  REPUTATION_UPDATED: 'reputation:updated',
  ACHIEVEMENT_UNLOCKED: 'achievement:unlocked',
  ROLE_SUGGESTED: 'role:suggested',
  ROLE_APPLIED: 'role:applied',
  PUNISHMENT_APPLIED: 'punishment:applied',
  SNAPSHOT_TAKEN: 'snapshot:taken',
};
