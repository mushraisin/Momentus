/**
 * Нормалізація та деобфускація тексту для детермінованого аналізу.
 * Мета — звести спроби обійти фільтр (леетспік, розтягнуті літери,
 * латинські гомогліфи, пробіли між буквами, zero-width) до канонічної форми,
 * щоб лексикони спрацьовували надійно.
 */

// Латинські (та цифрові) гомогліфи → кирилиця. Дає змогу ловити "cyka", "6лядь", "п0шел".
const HOMOGLYPHS = {
  a: 'а', b: 'б', c: 'с', e: 'е', h: 'н', i: 'і', k: 'к', m: 'м', o: 'о',
  p: 'р', t: 'т', u: 'и', x: 'х', y: 'у', 3: 'е', 4: 'а', 6: 'б', 0: 'о',
  1: 'і', 5: 'с', 7: 'т', '@': 'а', $: 'с', '!': 'і',
};

const ZERO_WIDTH = /[​-‍﻿⁠]/g;

/** Прибрати zero-width, звести пробіли. */
function clean(text) {
  return String(text ?? '')
    .replace(ZERO_WIDTH, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Згорнути ланцюги однакових символів: "суууука" → "сука". */
function collapseRuns(s) {
  return s.replace(/(.)\1{2,}/gu, '$1');
}

/** Кириличне гомогліф-відображення (посимвольно). */
function foldHomoglyphs(s) {
  let out = '';
  for (const ch of s) out += HOMOGLYPHS[ch] ?? ch;
  return out;
}

/**
 * Обчислити набір представлень тексту для матчингу.
 * @returns {{
 *   raw:string, lower:string, tokens:string[],
 *   compactLat:string,  // без пробілів/пунктуації (латиниця збережена) — для англ. стемів
 *   compactCyr:string,  // + гомогліфи в кирилицю, згорнуті повтори — для кир. стемів
 *   len:number, capsRatio:number, charRepeat:boolean,
 *   exclaim:number, question:number, mentions:number, emojiCount:number, hasLink:boolean
 * }}
 */
export function analyzeText(text) {
  const raw = clean(text);
  const lower = raw.toLowerCase();

  // токени (літери/цифри/апостроф)
  const tokens = lower.match(/[\p{L}\p{N}’']+/gu) ?? [];

  // «компактні» рядки для сканування стемів
  const lettersOnly = lower.replace(/[^\p{L}\p{N}]+/gu, '');
  const compactLat = collapseRuns(lettersOnly);
  const compactCyr = collapseRuns(foldHomoglyphs(lettersOnly));

  // CAPS-частка (лише для латиниці/кирилиці, ігноруючи короткі рядки)
  const letters = raw.replace(/[^A-Za-zА-Яа-яЁёЇїІіЄєҐґ]/g, '');
  const upper = raw.replace(/[^A-ZА-ЯЁЇІЄҐ]/g, '');
  const capsRatio = letters.length >= 4 ? upper.length / letters.length : 0;

  const emojiCount = (raw.match(/\p{Extended_Pictographic}/gu) ?? []).length;

  return {
    raw,
    lower,
    tokens,
    compactLat,
    compactCyr,
    len: raw.length,
    capsRatio,
    charRepeat: /(.)\1{4,}/u.test(raw) || /(\b[\p{L}\p{N}]+\b)(\s+\1){2,}/iu.test(lower),
    exclaim: (raw.match(/!/g) ?? []).length,
    question: (raw.match(/\?/g) ?? []).length,
    mentions: (raw.match(/<@!?\d+>|@\w{2,}/g) ?? []).length,
    emojiCount,
    hasLink: /(https?:\/\/|discord\.gg\/|t\.me\/|\bwww\.)/i.test(raw),
  };
}

/**
 * Чи міститься стем у тексті.
 * `cyr:true` — сканувати кириличне представлення (з гомогліфами), інакше латинське.
 * Короткі стеми (≤3) матчимо по межі токена, щоб уникнути хибних спрацювань.
 */
export function hasStem(nlp, stem, cyr = true) {
  const hay = cyr ? nlp.compactCyr : nlp.compactLat;
  return hay.includes(stem);
}

/** Порахувати кількість токенів, що починаються з будь-якого зі стемів. */
export function countStemTokens(nlp, stems) {
  let n = 0;
  for (const tok of nlp.tokens) {
    for (const s of stems) {
      if (tok.startsWith(s)) { n++; break; }
    }
  }
  return n;
}
