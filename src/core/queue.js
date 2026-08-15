import { createLogger } from './logger.js';

const log = createLogger('queue');

/**
 * Черга задач з обмеженою конкурентністю, ретраями та backoff.
 * Використовується для AI-викликів та важких перерахунків, щоб не блокувати gateway.
 */
export class TaskQueue {
  #items = [];
  #running = 0;
  #stopped = false;

  constructor({ concurrency = 2, retries = 2, baseDelayMs = 800, name = 'default' } = {}) {
    this.concurrency = concurrency;
    this.retries = retries;
    this.baseDelayMs = baseDelayMs;
    this.name = name;
    this.stats = { queued: 0, done: 0, failed: 0 };
  }

  /**
   * @param {() => Promise<any>} fn
   * @param {{ priority?: number, label?: string }} [opts] priority: більше = раніше
   */
  push(fn, { priority = 0, label = 'task' } = {}) {
    return new Promise((resolve, reject) => {
      this.#items.push({ fn, priority, label, attempt: 0, resolve, reject });
      this.#items.sort((a, b) => b.priority - a.priority);
      this.stats.queued++;
      this.#drain();
    });
  }

  #drain() {
    if (this.#stopped) return;
    while (this.#running < this.concurrency && this.#items.length > 0) {
      const item = this.#items.shift();
      this.#running++;
      this.#run(item);
    }
  }

  async #run(item) {
    try {
      const result = await item.fn();
      this.stats.done++;
      item.resolve(result);
    } catch (err) {
      if (item.attempt < this.retries) {
        item.attempt++;
        const delay = this.baseDelayMs * 2 ** (item.attempt - 1);
        log.warn(`[${this.name}] "${item.label}" впало, спроба ${item.attempt}/${this.retries} через ${delay}мс`, err.message);
        setTimeout(() => {
          this.#items.unshift(item);
          this.#drain();
        }, delay);
      } else {
        this.stats.failed++;
        log.error(`[${this.name}] "${item.label}" остаточно впало`, err.message);
        item.reject(err);
      }
    } finally {
      this.#running--;
      this.#drain();
    }
  }

  get pending() {
    return this.#items.length + this.#running;
  }

  stop() {
    this.#stopped = true;
  }

  resume() {
    this.#stopped = false;
    this.#drain();
  }
}

/** Черга AI-запитів (обмежена конкурентність — бережемо rate limit). */
export const aiQueue = new TaskQueue({ concurrency: 2, retries: 2, name: 'ai' });

/** Черга фонових перерахунків. */
export const bgQueue = new TaskQueue({ concurrency: 3, retries: 1, name: 'bg' });
