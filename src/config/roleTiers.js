/**
 * Рівні ролей (tiers) для «Перевірки».
 * Адміністратор редагує їх через Admin Panel: назви, roleId, пріоритети, вимоги.
 * Можна додавати нові рівні — система працює з довільною кількістю.
 *
 * priority — більше = вищий рівень. Видається НАЙВИЩИЙ рівень, вимоги якого виконано.
 * Вимоги навмисно суворі: роль з правами має бути рідкістю, а не дефолтом.
 */

/** Порожня вимога = не перевіряється. */
export const REQUIREMENT_FIELDS = [
  { key: 'minScore', label: 'Мін. рейтинг (0-1000)', dir: 'min' },
  { key: 'minTrust', label: 'Мін. довіра', dir: 'min' },
  { key: 'minCommunication', label: 'Мін. комунікація', dir: 'min' },
  { key: 'minHelpfulness', label: 'Мін. допомога', dir: 'min' },
  { key: 'minStability', label: 'Мін. стабільність', dir: 'min' },
  { key: 'minActivity', label: 'Мін. активність', dir: 'min' },
  { key: 'maxToxicity', label: 'Макс. токсичність', dir: 'max' },
  { key: 'maxConflict', label: 'Макс. конфліктність', dir: 'max' },
  { key: 'maxViolations', label: 'Макс. порушення', dir: 'max' },
  { key: 'minDays', label: 'Мін. днів на сервері', dir: 'min' },
  { key: 'minMessages', label: 'Мін. повідомлень', dir: 'min' },
  { key: 'minActiveDays', label: 'Мін. активних днів', dir: 'min' },
  { key: 'minSamples', label: 'Мін. проаналізованих повідомлень', dir: 'min' },
];

/** Чотири базові рівні за ТЗ. roleId заповнює адміністратор. */
export const DEFAULT_TIERS = [
  {
    key: 'cosmetic',
    name: 'Косметична',
    roleId: '',
    priority: 1,
    color: '#8b9bb4',
    req: {
      minScore: 350,
      minTrust: 40,
      minCommunication: 45,
      maxToxicity: 30,
      maxConflict: 40,
      maxViolations: 25,
      minDays: 7,
      minMessages: 60,
      minActiveDays: 5,
      minSamples: 25,
    },
  },
  {
    key: 'trusted',
    name: 'Довірена',
    roleId: '',
    priority: 2,
    color: '#3ba55d',
    req: {
      minScore: 560,
      minTrust: 62,
      minCommunication: 62,
      minHelpfulness: 45,
      minStability: 50,
      maxToxicity: 18,
      maxConflict: 22,
      maxViolations: 12,
      minDays: 30,
      minMessages: 300,
      minActiveDays: 20,
      minSamples: 120,
    },
  },
  {
    key: 'moderator',
    name: 'З правами (мут/кік)',
    roleId: '',
    priority: 3,
    color: '#5865f2',
    req: {
      minScore: 720,
      minTrust: 76,
      minCommunication: 74,
      minHelpfulness: 60,
      minStability: 65,
      minActivity: 55,
      maxToxicity: 10,
      maxConflict: 12,
      maxViolations: 5,
      minDays: 90,
      minMessages: 900,
      minActiveDays: 55,
      minSamples: 350,
    },
  },
  {
    key: 'senior',
    name: 'З правами (мут/кік/бан)',
    roleId: '',
    priority: 4,
    color: '#f1c40f',
    req: {
      minScore: 850,
      minTrust: 86,
      minCommunication: 82,
      minHelpfulness: 72,
      minStability: 76,
      minActivity: 68,
      maxToxicity: 5,
      maxConflict: 6,
      maxViolations: 0,
      minDays: 180,
      minMessages: 2000,
      minActiveDays: 110,
      minSamples: 800,
    },
  },
];

/**
 * Перевірка відповідності профілю вимогам рівня.
 * @param {object} tier
 * @param {object} m метрики (див. verificationService.metricsOf)
 * @param {number} margin послаблення для утримання вже виданої ролі (гістерезис)
 * @returns {{ pass:boolean, checks:Array<{key,label,ok,have,need,dir}> }}
 */
export function evaluateTier(tier, m, margin = 0) {
  const checks = [];
  for (const f of REQUIREMENT_FIELDS) {
    const need = tier.req?.[f.key];
    if (need === undefined || need === null || need === '') continue;
    const have = metricFor(f.key, m);
    const ok = f.dir === 'min'
      ? have >= need - margin * scaleOf(f.key)
      : have <= need + margin * scaleOf(f.key);
    checks.push({ key: f.key, label: f.label, ok, have: round(have), need, dir: f.dir });
  }
  return { pass: checks.every((c) => c.ok), checks };
}

/** Прив'язка ключа вимоги до метрики профілю. */
function metricFor(key, m) {
  const map = {
    minScore: m.score, minTrust: m.trust, minCommunication: m.communication,
    minHelpfulness: m.helpfulness, minStability: m.stability, minActivity: m.activity,
    maxToxicity: m.toxicity, maxConflict: m.conflict, maxViolations: m.violations,
    minDays: m.days, minMessages: m.messages, minActiveDays: m.activeDays, minSamples: m.samples,
  };
  return map[key] ?? 0;
}

/** Наскільки «широка» шкала поля — щоб гістерезис у % був адекватним. */
function scaleOf(key) {
  if (key === 'minScore') return 10;
  if (key === 'minMessages') return 20;
  if (key === 'minSamples') return 10;
  if (key === 'minDays' || key === 'minActiveDays') return 1;
  return 1;
}

function round(v) {
  return Math.round((v ?? 0) * 10) / 10;
}

/** Відсортовані за пріоритетом (спадання). */
export function sortedTiers(tiers) {
  return [...tiers].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}
