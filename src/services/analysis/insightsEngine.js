/**
 * Детерміновані «AI-подібні» інсайти БЕЗ ШІ:
 * рекомендації, прогноз і поради модератору — на основі чисел профілю,
 * трендів та історії. Формулюються за шаблонами українською.
 * Контракт відповідей ідентичний AI-провайдеру (ті самі поля).
 */

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
const pct = (v) => Math.round(v);

// ─────────────────────────────────────────────
//  Рекомендації
// ─────────────────────────────────────────────
export function ruleRecommendations(profile) {
  const r = profile.rep;
  const good = [];
  const bad = [];
  const improve = [];

  // що добре
  if (r.helpfulness >= 60) good.push(`Ви активно допомагаєте іншим (${pct(r.helpfulness)}/100).`);
  if (r.communication >= 70) good.push('Ваша культура спілкування на високому рівні.');
  if (r.toxicity <= 15) good.push('Ви тримаєте спілкування без токсичності.');
  if (r.activity >= 60) good.push('Ви стабільно активні у спільноті.');
  if (r.peer >= 65) good.push('Учасники цінують вашу присутність (багато позитивних реакцій).');
  if (!good.length) good.push('Ви поступово нарощуєте репутацію — так тримати.');

  // що погано
  if (r.toxicity >= 40) bad.push(`Підвищена токсичність (${pct(r.toxicity)}/100) знижує ваш рейтинг.`);
  if (r.conflict >= 35) bad.push('Помітна конфліктність у повідомленнях.');
  if (r.violations >= 30) bad.push('Є непогашені порушення правил.');
  if (r.activity < 30) bad.push('Низька активність уповільнює зростання репутації.');
  if (!bad.length) bad.push('Суттєвих проблем не виявлено.');

  // що покращити
  if (r.helpfulness < 50) improve.push('Частіше допомагайте новачкам — це найшвидше піднімає рейтинг.');
  if (r.toxicity > 20) improve.push('Уникайте різких формулювань і ненормативної лексики.');
  if (r.communication < 60) improve.push('Додавайте більше конструктиву й пояснень у повідомлення.');
  if (r.activity < 50) improve.push('Спробуйте частіше брати участь у чатах і голосових каналах.');
  if (r.stability < 50) improve.push('Регулярна присутність підвищить показник стабільності.');
  if (!improve.length) improve.push('Продовжуйте в тому ж дусі — ви на правильному шляху.');

  const topPositive = bestCategory(r, false);
  const topNegative = bestCategory(r, true);
  const trendNote = trendSentence(profile);

  return { good, bad, improve, topPositive, topNegative, trendNote };
}

function bestCategory(r, negative) {
  const pos = [
    ['Довіра', r.trust], ['Активність', r.activity], ['Комунікація', r.communication],
    ['Допомога іншим', r.helpfulness], ['Корисність', r.usefulness], ['Репутація серед учасників', r.peer],
  ];
  const neg = [['Токсичність', r.toxicity], ['Конфліктність', r.conflict], ['Порушення правил', r.violations]];
  const arr = negative ? neg : pos;
  const [name, val] = arr.reduce((a, b) => (b[1] > a[1] ? b : a));
  return negative
    ? (val >= 25 ? `${name} (${pct(val)}/100)` : 'Немає значних негативних чинників')
    : `${name} (${pct(val)}/100)`;
}

function trendSentence(profile) {
  const d = profile.scoreDeltaMonth ?? 0;
  const tox = profile.toxicityDrop ?? 0;
  if (tox >= 10) return `Ваша токсичність знизилась на ${pct(tox)} пунктів за місяць — чудова динаміка.`;
  if (d >= 20) return `AI Score зріс на ${pct(d)} за місяць — так тримати.`;
  if (d <= -20) return `AI Score знизився на ${pct(-d)} за місяць — варто звернути увагу.`;
  return 'Динаміка стабільна.';
}

// ─────────────────────────────────────────────
//  Прогноз
// ─────────────────────────────────────────────
export function rulePrediction(profile) {
  const r = profile.rep;
  const tenure = Math.min(profile.daysOnServer / 365, 1) * 100;

  const goodModerator = clamp(
    r.trust * 0.3 + r.communication * 0.25 + r.behavior * 0.2 + (100 - r.toxicity) * 0.15 + (100 - r.violations) * 0.1,
  );
  const trustworthy = clamp(r.trust * 0.7 + (100 - r.violations) * 0.2 + tenure * 0.1);
  const adminPotential = clamp(
    (profile.aiScore / 1000) * 100 * 0.4 + r.helpfulness * 0.2 + r.stability * 0.2 + tenure * 0.2,
  );
  const toxicityRisk = clamp(r.toxicity * 0.7 + r.conflict * 0.3 - r.stability * 0.1);

  let behaviorTrend = 'stable';
  const d = profile.scoreDeltaMonth ?? 0;
  if ((profile.toxicityDrop ?? 0) >= 8 || d >= 15) behaviorTrend = 'improving';
  else if (d <= -15 || (profile.toxicityDrop ?? 0) <= -8) behaviorTrend = 'declining';

  const rationale = buildRationale({ goodModerator, adminPotential, toxicityRisk, behaviorTrend, profile });
  return { goodModerator, trustworthy, adminPotential, toxicityRisk, behaviorTrend, rationale };
}

function buildRationale({ goodModerator, adminPotential, toxicityRisk, behaviorTrend, profile }) {
  const bits = [];
  if (goodModerator >= 70) bits.push('високий модераторський потенціал');
  else if (goodModerator < 40) bits.push('поки що не готовий до модерації');
  if (toxicityRisk >= 50) bits.push('підвищений ризик токсичності');
  if (adminPotential >= 75) bits.push('перспективний як адміністратор');
  const tr = { improving: 'поведінка покращується', declining: 'поведінка погіршується', stable: 'поведінка стабільна' }[behaviorTrend];
  bits.push(tr);
  return `${bits.join('; ')}. Оцінка на основі ${profile.daysOnServer} дн. на сервері.`;
}

// ─────────────────────────────────────────────
//  Порада модератору
// ─────────────────────────────────────────────
export function ruleModerationAdvice(profile, ctx = {}) {
  const r = profile.rep;
  const repeat = ctx.repeatIndex ?? 1;
  const daysSince = ctx.daysSinceLast;

  // ймовірність повторення: більше повторів + свіже покарання + висока токсичність
  let reoffend = 20 + (repeat - 1) * 18 + r.toxicity * 0.3 + r.conflict * 0.15;
  if (daysSince != null && daysSince < 7) reoffend += 15;
  if ((profile.toxicityDrop ?? 0) >= 10) reoffend -= 15; // виправляється
  const reoffendProbability = clamp(reoffend);

  const totalPunishments = profile.mod?.total ?? 0;
  let incidentType = 'ambiguous';
  if (repeat >= 3 || totalPunishments >= 4) incidentType = 'systematic';
  else if (repeat === 1 && r.toxicity < 40) incidentType = 'accidental';

  const hadSimilarCases = repeat > 1 || totalPunishments > 1;
  const improved = (profile.toxicityDrop ?? 0) > 0 || (profile.scoreDeltaMonth ?? 0) > 10;

  const recommendedAction = recommendAction(incidentType, reoffendProbability, r);
  const softerSuggested = improved && reoffendProbability < 45 && incidentType !== 'systematic';

  const reasoning = [
    `Повторюваність: ${repeat}.`,
    `Токсичність: ${pct(r.toxicity)}/100.`,
    hadSimilarCases ? 'Схожі випадки вже були.' : 'Схожих випадків не зафіксовано.',
    improved ? 'Динаміка позитивна.' : 'Стійкого покращення не видно.',
    softerSuggested ? 'Можна розглянути мʼякше покарання.' : '',
  ].filter(Boolean).join(' ');

  return { reoffendProbability, incidentType, hadSimilarCases, improved, recommendedAction, softerSuggested, reasoning };
}

function recommendAction(type, reoffend, r) {
  if (r.toxicity >= 75 || reoffend >= 80) return 'ban';
  if (type === 'systematic') return reoffend >= 60 ? 'timeout' : 'mute';
  if (r.toxicity >= 45) return 'timeout';
  if (reoffend >= 45) return 'warn';
  if (type === 'accidental') return 'talk';
  return 'note';
}
