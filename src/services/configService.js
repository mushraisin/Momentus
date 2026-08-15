import { configRepo } from '../database/repositories.js';
import { CONFIG_SCHEMA } from '../config/defaults.js';

/**
 * Конфіг тримається в памʼяті синхронно, щоб численні синхронні читання
 * (доступ, ваги репутації тощо) не ставали async. Асинхронні лише:
 *  - load(guildId): підтягнути збережені значення з БД у кеш;
 *  - set(guildId, key, value): записати в БД і оновити кеш.
 */
const memory = new Map(); // guildId → { key: value }

function defaults() {
  const out = {};
  for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
    out[key] = structuredClone(schema.default);
  }
  return out;
}

export const configService = {
  /** Підтягнути конфіг гільдії в памʼять (викликати на старті / при першій взаємодії). */
  async load(guildId) {
    const stored = await configRepo.getAll(guildId);
    const merged = defaults();
    for (const key of Object.keys(CONFIG_SCHEMA)) {
      if (key in stored) merged[key] = stored[key];
    }
    memory.set(guildId, merged);
    return merged;
  },

  /** Синхронне читання всього конфігу (з дефолтами, якщо ще не завантажено). */
  all(guildId) {
    let cfg = memory.get(guildId);
    if (!cfg) {
      cfg = defaults();
      memory.set(guildId, cfg);
      // лінива фонова синхронізація з БД
      this.load(guildId).catch(() => {});
    }
    return cfg;
  },

  get(guildId, key) {
    return this.all(guildId)[key];
  },

  async set(guildId, key, value) {
    if (!(key in CONFIG_SCHEMA)) throw new Error(`Невідомий ключ конфігурації: ${key}`);
    const coerced = coerce(CONFIG_SCHEMA[key].type, value);
    await configRepo.set(guildId, key, coerced);
    const cfg = this.all(guildId);
    cfg[key] = coerced;
    return coerced;
  },

  /** Ключі, згруповані для рендеру Admin Panel. */
  groups() {
    const groups = {};
    for (const [key, schema] of Object.entries(CONFIG_SCHEMA)) {
      (groups[schema.group] ??= []).push({ key, ...schema });
    }
    return groups;
  },
};

/** Приведення тексту з модального вікна до типу поля. */
function coerce(type, raw) {
  switch (type) {
    case 'bool':
      if (typeof raw === 'boolean') return raw;
      return ['1', 'true', 'так', 'yes', 'on'].includes(String(raw).toLowerCase().trim());
    case 'int': {
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : 0;
    }
    case 'float': {
      const n = parseFloat(String(raw).replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    case 'roles':
      if (Array.isArray(raw)) return raw;
      return String(raw).split(/[\s,]+/).filter(Boolean);
    case 'json':
      if (typeof raw === 'object') return raw;
      try {
        return JSON.parse(raw);
      } catch {
        return {};
      }
    case 'channel':
    case 'string':
    default:
      return String(raw).trim();
  }
}
