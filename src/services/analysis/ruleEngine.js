/**
 * Детермінований аналіз повідомлень БЕЗ ШІ.
 * Поєднує: лексикони (uk/ru/en), нормалізацію/деобфускацію, regex-детектори
 * та поведінкові сигнали (частота, дублікати), і повертає 21 ознаку 0..100,
 * прапорець та короткий підсумок — той самий формат, що й AI-провайдер.
 */
import { analyzeText } from './normalize.js';
import { LEX } from './lexicons.js';

const SECOND_PERSON = /(^|[^\p{L}])(ти|тебе|тобі|тобою|твій|твоя|твоє|твої|ви|вас|вам|you|u|ur|your)([^\p{L}]|$)/iu;

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));

/** Скільки записів лексикону збіглося (підрядок у compact-представленні). */
function countLex(p, lex) {
  let n = 0;
  if (lex.cyr) for (const s of lex.cyr) if (p.compactCyr.includes(s.replace(/\s+/g, ''))) n++;
  if (lex.en) for (const s of lex.en) if (p.compactLat.includes(s.replace(/\s+/g, '')) || p.lower.includes(s)) n++;
  if (lex.re) for (const re of lex.re) if (re.test(p.lower)) n++;
  return n;
}
function countRe(p, arr) {
  return arr.reduce((a, re) => a + (re.test(p.lower) ? 1 : 0), 0);
}

/**
 * Чи є в тексті подяка. Використовується для детекції реальних актів допомоги:
 * якщо A дякує B — значить B комусь допоміг (сигнал не потребує ШІ).
 */
export function isGratitude(content) {
  const p = analyzeText(content);
  return countLex(p, LEX.gratitude) > 0;
}

/** Чи схоже повідомлення на запитання (для детекції «відповів на питання»). */
export function isQuestion(content) {
  const p = analyzeText(content);
  return p.question > 0 || /^(як|чому|де|коли|що|чи|хто|скільки|how|why|what|where|when|can i|does)\b/i.test(p.lower);
}

/** Чи схоже повідомлення на змістовну відповідь/пояснення. */
export function isHelpful(content) {
  const p = analyzeText(content);
  return countLex(p, LEX.help) > 0 || (countLex(p, LEX.connectors) > 0 && p.len > 60);
}

/**
 * Аналіз одного повідомлення.
 * @param {string} content
 * @param {{ burst?:number, duplicate?:boolean }} [signals]
 *   burst — скільки повідомлень користувач надіслав за останні ~10с;
 *   duplicate — чи це (майже) дублікат нещодавнього.
 */
export function analyzeMessage(content, signals = {}) {
  const p = analyzeText(content);
  const directed = SECOND_PERSON.test(p.lower) || p.mentions > 0;
  const burst = signals.burst ?? 0;

  const prof = countLex(p, LEX.profanity);
  const ins = countLex(p, LEX.insult);
  const slur = countLex(p, LEX.slur);
  const thr = countRe(p, LEX.threatRe);
  const prov = countLex(p, LEX.provocation);
  const passive = countRe(p, LEX.passiveRe);
  const adN = countLex(p, LEX.ad);

  const grat = countLex(p, LEX.gratitude);
  const greet = countLex(p, LEX.greeting);
  const pol = countLex(p, LEX.politeness);
  const helpN = countLex(p, LEX.help);
  const conn = countLex(p, LEX.connectors);
  const pos = countLex(p, LEX.positive);

  const capsAgg = p.capsRatio > 0.6 && p.len > 6 ? 20 : 0;

  // ── Негативні ознаки ──────────────────────
  const profanity = clamp(prof * 40 + (prof && capsAgg ? 10 : 0));
  const insult = clamp(ins * 35 * (directed ? 1.3 : 0.8));
  const bullying = clamp((ins * 20 + slur * 45) * (directed ? 1.4 : 0.7));
  const harassment = clamp(slur * 40 + (directed && ins + prof > 0 ? 25 : 0) + (p.mentions > 2 ? 15 : 0));
  const threat = clamp(thr * 70);
  const provocation = clamp(prov * 30 + (directed && p.capsRatio > 0.5 ? 15 : 0));
  const passiveAggression = clamp(passive * 45);
  const sarcasm = clamp(passive * 25);
  const advertising = clamp(adN * 45 + (p.hasLink ? 20 : 0));
  const flood = clamp((p.charRepeat ? 45 : 0) + (burst >= 4 ? (burst - 3) * 15 : 0) + (p.exclaim > 4 ? 15 : 0));
  const spam = clamp((signals.duplicate ? 55 : 0) + adN * 20 + (p.len <= 2 ? 25 : 0) + (burst >= 5 ? 25 : 0));

  const toxicity = clamp(
    profanity * 0.5 + insult * 0.6 + bullying * 0.5 + harassment * 0.4 +
    threat * 0.6 + provocation * 0.25 + passiveAggression * 0.3 + capsAgg,
  );
  const conflictSeeking = clamp(provocation * 0.6 + insult * 0.3 + (directed ? 10 : 0) + capsAgg);

  // ── Позитивні ознаки ──────────────────────
  const politeness = clamp(50 + pol * 18 + grat * 10 - insult * 0.5 - profanity * 0.6);
  const friendliness = clamp(45 + (grat + greet + pos) * 12 - toxicity * 0.5);
  const respect = clamp(55 + pol * 12 + grat * 8 - insult * 0.6 - harassment * 0.5 - profanity * 0.4);
  const helpfulness = clamp(helpN * 22 + (p.hasLink && helpN > 0 ? 15 : 0) + conn * 6);
  const constructiveness = clamp(Math.min(p.len / 40, 25) + conn * 14 + helpN * 10 - toxicity * 0.4);
  const positiveImpact = clamp(pos * 18 + grat * 12 + greet * 10 + helpN * 10 - toxicity * 0.5);
  const cultureLevel = clamp(60 + pol * 10 + conn * 6 - profanity * 0.7 - toxicity * 0.4 - capsAgg);
  const adequacy = clamp(70 - toxicity * 0.5 - (p.charRepeat ? 20 : 0) - capsAgg);

  const traits = {
    politeness, toxicity, insult, bullying, harassment, passiveAggression, sarcasm, threat,
    profanity, constructiveness, adequacy, helpfulness, friendliness, respect, positiveImpact,
    cultureLevel, provocation, flood, spam, advertising, conflictSeeking,
  };

  return { traits, flag: flagFor(traits), summary: summarize(traits, { directed, helpN, grat, greet, pos }) };
}

function flagFor(t) {
  if (t.toxicity >= 60 || t.threat >= 50 || t.bullying >= 55) return 'toxic';
  if (t.advertising >= 45) return 'ad';
  if (t.spam >= 50 || t.flood >= 55) return 'spam';
  if (t.toxicity >= 30) return 'watch';
  return 'ok';
}

/** Короткий підсумок українською з найсильніших сигналів (без ШІ). */
function summarize(t, ctx) {
  const parts = [];
  if (t.threat >= 40) parts.push('погроза');
  if (t.bullying >= 40) parts.push('цькування');
  else if (t.insult >= 40) parts.push(ctx.directed ? 'образа учасника' : 'образлива лексика');
  if (t.profanity >= 40) parts.push('ненормативна лексика');
  if (t.passiveAggression >= 40) parts.push('пасивна агресія');
  if (t.advertising >= 45) parts.push('реклама/посилання');
  if (t.spam >= 50 || t.flood >= 55) parts.push('спам/флуд');
  if (parts.length) return `Виявлено: ${parts.join(', ')}.`;

  if (ctx.helpN > 0) return 'Допомога/пояснення іншим учасникам.';
  if (ctx.grat > 0) return 'Подяка спільноті.';
  if (ctx.greet > 0) return 'Привітання.';
  if (ctx.pos > 0 || t.friendliness >= 65) return 'Дружнє позитивне повідомлення.';
  return 'Нейтральне повідомлення.';
}

/**
 * Пакетний аналіз (той самий контракт, що й aiService.analyzeBatch).
 * @param {Array<{id:number,userId:string,content:string}>} messages
 * @param {Map<number, object>} [signalsMap] сигнали по id повідомлення
 */
export function ruleAnalyzeBatch(messages, signalsMap) {
  return messages.map((m) => {
    const { traits, flag, summary } = analyzeMessage(m.content ?? '', signalsMap?.get(m.id) ?? {});
    return { id: m.id, userId: m.userId, traits, flag, summary };
  });
}
