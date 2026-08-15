/** Мінімалістичний структурований логер без зовнішніх залежностей. */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const current = LEVELS[process.env.LOG_LEVEL ?? 'info'] ?? LEVELS.info;

const COLOR = { debug: '\x1b[90m', info: '\x1b[36m', warn: '\x1b[33m', error: '\x1b[31m' };
const RESET = '\x1b[0m';

function emit(level, scope, message, meta) {
  if (LEVELS[level] < current) return;
  const ts = new Date().toISOString();
  const head = `${COLOR[level]}${ts} ${level.toUpperCase().padEnd(5)}${RESET} [${scope}]`;
  if (meta === undefined) console.log(`${head} ${message}`);
  else console.log(`${head} ${message}`, meta);
}

/** Створює логер, прив'язаний до модуля. */
export function createLogger(scope) {
  return {
    debug: (m, meta) => emit('debug', scope, m, meta),
    info: (m, meta) => emit('info', scope, m, meta),
    warn: (m, meta) => emit('warn', scope, m, meta),
    error: (m, meta) => emit('error', scope, m, meta),
  };
}

export const logger = createLogger('core');
