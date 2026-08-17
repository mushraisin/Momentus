import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import { AttachmentBuilder } from 'discord.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../core/logger.js';

const log = createLogger('cards');

// ── Шрифти ────────────────────────────────────
// Inter (текст) + Noto Color Emoji (емодзі/символи) постачаються з проєктом,
// тож вигляд однаковий на будь-якому хості. Емодзі підхоплюються як fallback
// у списку сімейств: `700 34px CardFont, CardEmoji`.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(HERE, '../../assets/fonts');

let TEXT_FAMILY = 'sans-serif';
let ready = false;

function tryRegister(file, family) {
  const p = path.join(FONTS_DIR, file);
  if (!fs.existsSync(p)) return false;
  try {
    GlobalFonts.registerFromPath(p, family);
    return true;
  } catch (err) {
    log.warn(`Шрифт ${file} не зареєстровано`, err.message);
    return false;
  }
}

// Порядок фолбеків важливий: символи (✦ ★ ➤ …) перед кольоровими емодзі,
// інакше декоративні знаки в ніках/назвах ролей малюються блоками.
const hasSymbols = tryRegister('NotoSansSymbols2.ttf', 'CardSymbols');
const hasEmoji = tryRegister('NotoColorEmoji.ttf', 'CardEmoji');

if (process.env.FONT_PATH && fs.existsSync(process.env.FONT_PATH)) {
  try {
    GlobalFonts.registerFromPath(process.env.FONT_PATH, 'CardFont');
    TEXT_FAMILY = 'CardFont';
    ready = true;
  } catch { /* нижче спробуємо вбудований */ }
}
if (!ready && tryRegister('Inter.ttf', 'CardFont')) {
  TEXT_FAMILY = 'CardFont';
  ready = true;
}
if (!ready && GlobalFonts.families.length > 0) ready = true;

/** Сімейства для canvas: текст → символи → кольорові емодзі. */
const FF = [TEXT_FAMILY, hasSymbols && 'CardSymbols', hasEmoji && 'CardEmoji']
  .filter(Boolean)
  .join(', ');

export const canRender = ready;
if (!canRender) log.warn('Шрифтів не знайдено — картки вимкнено (буде текстовий вигляд).');

// ── Тема ──────────────────────────────────────
const S = 2;      // рендер у 2× для чіткості
const W = 720;    // логічна ширина
const PAD = 28;   // симетричні поля
const INNER = 22; // внутрішній відступ панелей

const C = {
  bg0: '#0d1017',
  bg1: '#141926',
  card: '#181d2a',
  line: 'rgba(255,255,255,0.07)',
  text: '#f2f5fa',
  dim: '#93a0b8',
  faint: '#5c6880',
  good: '#43c47b',
  mid: '#e9b949',
  bad: '#ef5350',
  accent: '#6b7cff',
};

function levelColor(v) {
  if (v >= 80) return C.good;
  if (v >= 60) return '#7ec96a';
  if (v >= 40) return C.mid;
  if (v >= 20) return '#ef8b4a';
  return C.bad;
}

// ── Полотно й примітиви ───────────────────────
function makeCanvas(h) {
  const canvas = createCanvas(W * S, h * S);
  const ctx = canvas.getContext('2d');
  ctx.scale(S, S);
  ctx.textBaseline = 'middle'; // усе центруємо вертикально — головне для рівності
  return { canvas, ctx };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Тло у колірному тоні ролі учасника: темна база + підмішаний відтінок,
 * діагональне світло та акцентна смуга зверху.
 */
function backdrop(ctx, h, tint = C.accent) {
  const g = ctx.createLinearGradient(0, 0, W, h);
  g.addColorStop(0, C.bg0);
  g.addColorStop(1, C.bg1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, h);

  // загальний тон по всій картці
  const wash = ctx.createLinearGradient(0, 0, W * 0.75, h);
  wash.addColorStop(0, hexA(tint, 0.14));
  wash.addColorStop(0.55, hexA(tint, 0.05));
  wash.addColorStop(1, hexA(tint, 0.02));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, W, h);

  // світло у верхньому правому куті
  const glow = ctx.createRadialGradient(W - 96, 46, 8, W - 96, 46, 320);
  glow.addColorStop(0, hexA(tint, 0.22));
  glow.addColorStop(1, hexA(tint, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, h);

  // акцентна смуга зверху
  const strip = ctx.createLinearGradient(0, 0, W, 0);
  strip.addColorStop(0, hexA(tint, 0.9));
  strip.addColorStop(1, hexA(tint, 0.15));
  ctx.fillStyle = strip;
  ctx.fillRect(0, 0, W, 3);
}

function panel(ctx, x, y, w, h, r = 16, fill = C.card, tint = null) {
  roundRect(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (tint) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = hexA(tint, 0.05);
    ctx.fill();
  }
  ctx.strokeStyle = tint ? hexA(tint, 0.16) : C.line;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Текст із вертикальним центруванням у точці `cy`. */
function txt(ctx, str, x, cy, { size = 21, color = C.text, weight = 400, align = 'left', maxWidth = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${FF}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(maxWidth ? fitText(ctx, String(str), maxWidth) : String(str), x, cy);
  ctx.textAlign = 'left';
}

function measure(ctx, str, size, weight = 400) {
  ctx.font = `${weight} ${size}px ${FF}`;
  return ctx.measureText(String(str)).width;
}

function fitText(ctx, str, maxWidth) {
  if (ctx.measureText(str).width <= maxWidth) return str;
  let s = str;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

/** Смуга, центрована по `cy` — завжди на одній лінії з текстом рядка. */
function bar(ctx, x, cy, w, value, color, h = 12) {
  const y = cy - h / 2;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();

  const v = Math.max(0, Math.min(100, value));
  if (v <= 0) return;
  const fw = Math.max(h, (w * v) / 100);
  const g = ctx.createLinearGradient(x, y, x + fw, y);
  g.addColorStop(0, hexA(color, 0.72));
  g.addColorStop(1, color);
  roundRect(ctx, x, y, fw, h, h / 2);
  ctx.fillStyle = g;
  ctx.fill();
}

function ring(ctx, cx, cy, r, value, max, color, tint = null) {
  const start = Math.PI * 0.78;
  const end = Math.PI * 2.22;
  const frac = Math.max(0, Math.min(1, value / max));

  ctx.lineCap = 'round';
  ctx.lineWidth = 13;
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();

  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, color);
  g.addColorStop(1, tint ?? '#a8b4ff');
  ctx.strokeStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, start + (end - start) * frac);
  ctx.stroke();
}

/** Кільце + число + підпис, усе відносно центру `cy`. */
function scoreRing(ctx, cx, cy, score, { r = 58, big = 36, label = 'РЕЙТИНГ', tint = null } = {}) {
  ring(ctx, cx, cy, r, score, 1000, levelColor(score / 10), tint);
  txt(ctx, score, cx, cy - 8, { size: big, weight: 700, align: 'center' });
  if (label) txt(ctx, label, cx, cy + 18, { size: 12, weight: 600, color: C.dim, align: 'center' });
}

async function avatar(ctx, url, x, cy, size, borderColor) {
  const y = cy - size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, cy, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  try {
    if (!url) throw new Error('no url');
    const img = await loadImage(url);
    ctx.drawImage(img, x, y, size, size);
  } catch {
    ctx.fillStyle = '#1e2434';
    ctx.fillRect(x, y, size, size);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(x + size / 2, cy, size / 2, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = borderColor || C.accent;
  ctx.stroke();
}

/**
 * Смуга банера вгорі картки — така сама, як на сторінці рейтингу.
 * Без банера лишається градієнт у кольорі ролі: смуга не має бути порожньою.
 */
async function bannerStrip(ctx, url, h, tint) {
  ctx.save();
  roundRectTop(ctx, 0, 0, W, h, 0);
  ctx.clip();

  const g = ctx.createLinearGradient(0, 0, W, h);
  g.addColorStop(0, hexA(tint, 0.55));
  g.addColorStop(1, '#0a0d16');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, h);

  if (url) {
    try {
      const img = await loadImage(url);
      // вписуємо «по ширині», центруючи по висоті — як background-size:cover
      const scale = Math.max(W / img.width, h / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, (W - dw) / 2, (h - dh) / 2, dw, dh);
    } catch { /* лишається градієнт */ }
  }

  // низ смуги розчиняється в картці — стик не має бути різким
  const fade = ctx.createLinearGradient(0, h * 0.35, 0, h);
  fade.addColorStop(0, 'rgba(13,16,23,0)');
  fade.addColorStop(1, C.bg0);
  ctx.fillStyle = fade;
  ctx.fillRect(0, h * 0.35, W, h * 0.65);
  ctx.restore();
}

function roundRectTop(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.closePath();
}

/** Чип статистики: значок, число, підпис — як на сторінці рейтингу. */
function statChip(ctx, x, cy, icon, value, label) {
  const vSize = 19;
  const lSize = 14;
  const wIcon = measure(ctx, icon, 15, 400);
  const wVal = measure(ctx, value, vSize, 700);
  const wLab = measure(ctx, label, lSize, 400);
  const w = 14 + wIcon + 8 + wVal + 7 + wLab + 14;
  const h = 34;

  roundRect(ctx, x, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = 'rgba(5,7,13,0.5)';
  ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.stroke();

  let cx = x + 14;
  txt(ctx, icon, cx, cy, { size: 15, color: C.dim });
  cx += wIcon + 8;
  txt(ctx, value, cx, cy, { size: vSize, weight: 700 });
  cx += wVal + 7;
  txt(ctx, label, cx, cy, { size: lSize, color: C.dim });
  return w;
}

/**
 * Чип ролі з кольоровою крапкою — такий самий, як на сайті: крапка кольору
 * ролі, потім назва тим же кольором.
 */
function rolePill(ctx, label, x, cy, color, size = 15) {
  const dot = 7;
  const h = 26;
  const w = 11 + dot + 7 + measure(ctx, label, size, 600) + 11;

  roundRect(ctx, x, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = hexA(color, 0.15);
  ctx.fill();
  ctx.strokeStyle = hexA(color, 0.42);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x + 11 + dot / 2, cy, dot / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  txt(ctx, label, x + 11 + dot + 7, cy, { size, weight: 600, color });
  return w;
}

/** Пігулка з назвою ролі, центрована по `cy`. */
function pill(ctx, label, x, cy, color, size = 18) {
  const h = 30;
  const w = measure(ctx, label, size, 600) + 24;
  roundRect(ctx, x, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = hexA(color, 0.16);
  ctx.fill();
  ctx.strokeStyle = hexA(color, 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();
  txt(ctx, label, x + 12, cy, { size, weight: 600, color });
  return w;
}

async function attach(canvas, name) {
  return new AttachmentBuilder(await canvas.encode('png'), { name });
}

// ─────────────────────────────────────────────
//  ПРОФІЛЬ
// ─────────────────────────────────────────────
/**
 * Картка профілю — та сама, що й на сторінці рейтингу: смуга банера, аватар
 * унахлест, нік із роллю та рівнем, рейтинг праворуч і чипи статистики.
 *
 * Розкладу репутації тут навмисно немає: він закритий для всіх. Замість нього
 * — смуга поступу до наступної ролі: видно, скільки лишилось, але не видно
 * самих оцінок.
 */
export async function profileCard(profile, {
  username, avatarUrl, roleName, roleColor, accent: tone,
  bannerUrl = null, level = 1,
} = {}) {
  if (!canRender) return null;
  try {
    const tint = roleColor || tone || C.accent;
    const accent = roleColor || tone || C.faint;

    const headH = 150;
    const H = 276;
    const { canvas, ctx } = makeCanvas(H);
    backdrop(ctx, H, tint);

    // ── Смуга банера ──
    await bannerStrip(ctx, bannerUrl, headH, tint);

    // ── Аватар унахлест на смугу ──
    const avSize = 96;
    const avCy = headH + 6;
    await avatar(ctx, avatarUrl, PAD, avCy, avSize, accent);

    // ── Нік, роль, рівень ──
    // Рядок ніка й рядок рейтингу мають спільні осі: раніше число було
    // центроване вище й наїжджало на смугу банера.
    const nameCy = avCy + 8;
    const metaCy = avCy + 42;

    const textX = PAD + avSize + 20;
    const scoreRight = W - PAD;
    const nameMax = scoreRight - 130 - textX;

    txt(ctx, username, textX, nameCy, { size: 30, weight: 700, maxWidth: nameMax });

    // Роль — чипом із крапкою, рівень — дрібним написом поруч: рівно так,
    // як на картці сайту, щоб дві картки читались однаково.
    let metaX = textX;
    if (roleName) {
      metaX += rolePill(ctx, fitText2(ctx, roleName, nameMax - 110, 15), textX, metaCy, accent) + 10;
    }
    txt(ctx, `◆ ${level} РІВЕНЬ`, metaX, metaCy, { size: 12, weight: 600, color: tint });

    // ── Рейтинг праворуч ──
    // Число велике, тож центрується нижче за нік: інакше воно тягнеться
    // вгору й наїжджає на смугу банера.
    txt(ctx, String(profile.aiScore), scoreRight, nameCy + 6, {
      size: 34, weight: 700, align: 'right', color: tint,
    });
    txt(ctx, 'РЕЙТИНГ', scoreRight, metaCy + 4, { size: 12, align: 'right', color: C.dim });

    // ── Чипи статистики ──
    const chipCy = avCy + avSize / 2 + 34;
    let cx = PAD;
    cx += statChip(ctx, cx, chipCy, '✉', fmt(profile.totalMessages), 'повідомлень') + 10;
    // 🎧 — той самий значок, що й на сайті; символ ♪ у наявних шрифтах
    // малювався порожньою рамкою
    cx += statChip(ctx, cx, chipCy, '🎧', `${Math.round(profile.voiceMinutes / 60)} год`, 'у голосових') + 10;
    statChip(ctx, cx, chipCy, '◷', fmt(profile.daysOnServer), 'на сервері');

    return attach(canvas, 'profile.png');
  } catch (err) {
    log.warn('profileCard впав', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
//  РЕПУТАЦІЯ
// ─────────────────────────────────────────────
export async function reputationCard(profile, categories, { accent: tone } = {}) {
  if (!canRender) return null;
  try {
    const tint = tone || C.accent;
    const rowH = 46;
    const headH = 118;
    const boxH = categories.length * rowH + INNER * 2 - 10;
    const H = headH + boxH + PAD;

    const { canvas, ctx } = makeCanvas(H);
    backdrop(ctx, H, tint);

    txt(ctx, 'Репутація', PAD, 52, { size: 32, weight: 700 });
    txt(ctx, `Загальний рейтинг ${profile.aiScore} / 1000`, PAD, 84, { size: 19, color: C.dim });
    scoreRing(ctx, W - PAD - 52, 66, profile.aiScore, { r: 44, big: 26, label: '', tint });

    const contentW = W - PAD * 2;
    panel(ctx, PAD, headH, contentW, boxH, 18, C.card, tint);

    const labelX = PAD + INNER;
    const valueRight = W - PAD - INNER;
    const barX = PAD + 250;
    const barW = valueRight - 52 - barX;

    categories.forEach((c, i) => {
      const cy = headH + INNER + rowH / 2 - 5 + i * rowH;
      txt(ctx, c.label, labelX, cy, { size: 20, maxWidth: barX - labelX - 14 });
      bar(ctx, barX, cy, barW, c.level, levelColor(c.level));
      txt(ctx, Math.round(c.value), valueRight, cy, { size: 20, weight: 600, color: C.dim, align: 'right' });
    });

    return attach(canvas, 'reputation.png');
  } catch (err) {
    log.warn('reputationCard впав', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────
//  ПЕРЕВІРКА
// ─────────────────────────────────────────────
export async function verificationCard(ev, { username, avatarUrl, accent: tone }) {
  if (!canRender) return null;
  try {
    const list = ev.results.slice(0, 8);
    const rowH = 58;
    const headH = 132;
    const H = headH + list.length * rowH + PAD;

    const earned = ev.earned ? disp(ev.earned) : null;
    const accent = earned?.color || tone || C.faint;
    const tint = tone || earned?.color || C.accent;

    const { canvas, ctx } = makeCanvas(H);
    backdrop(ctx, H, tint);

    const headCy = 68;
    const avSize = 72;
    await avatar(ctx, avatarUrl, PAD, headCy, avSize, accent);

    const textX = PAD + avSize + 18;
    const ringCx = W - PAD - 52;
    const nameMax = ringCx - 60 - textX;

    txt(ctx, username, textX, headCy - 16, { size: 27, weight: 700, maxWidth: nameMax });
    pill(ctx, fitText2(ctx, earned?.name ?? 'Рівень не досягнуто', nameMax - 8, 17), textX, headCy + 18, accent, 17);
    scoreRing(ctx, ringCx, headCy, ev.metrics.score, { r: 44, big: 26, label: '', tint });

    const contentW = W - PAD * 2;
    const barW = 170;

    list.forEach((r, i) => {
      const top = headH + i * rowH;
      const cy = top + (rowH - 10) / 2;
      const d = disp(r);
      const isEarned = earned && r.tier.key === ev.earned.tier.key;
      const done = r.checks.filter((c) => c.ok).length;
      const total = r.checks.length || 1;

      panel(ctx, PAD, top, contentW, rowH - 10, 14, isEarned ? hexA(d.color, 0.13) : C.card, isEarned ? d.color : tint);

      roundRect(ctx, PAD, top, 5, rowH - 10, 3);
      ctx.fillStyle = r.pass ? d.color : (r.held ? C.mid : 'rgba(255,255,255,0.10)');
      ctx.fill();

      const barX = W - PAD - INNER - barW;
      const countX = barX - 16;

      txt(ctx, d.name, PAD + INNER, cy, {
        size: 20,
        weight: isEarned ? 600 : 400,
        color: r.pass ? C.text : C.dim,
        maxWidth: countX - 60 - (PAD + INNER),
      });
      txt(ctx, `${done}/${total}`, countX, cy, { size: 17, color: C.dim, align: 'right' });
      bar(ctx, barX, cy, barW, (done / total) * 100, r.pass ? d.color : C.mid, 11);
    });

    return attach(canvas, 'verification.png');
  } catch (err) {
    log.warn('verificationCard впав', err.message);
    return null;
  }
}

// ── утиліти ───────────────────────────────────
/** Назва/колір для показу: реальна роль Discord, якщо її передали. */
function disp(result) {
  return {
    name: result.display?.name ?? result.tier.name,
    color: result.display?.color ?? result.tier.color ?? C.accent,
  };
}

/** Обрізання під ширину з урахуванням розміру шрифту. */
function fitText2(ctx, str, maxWidth, size) {
  ctx.font = `600 ${size}px ${FF}`;
  return fitText(ctx, String(str), Math.max(40, maxWidth));
}

function fmt(n) {
  return new Intl.NumberFormat('uk-UA').format(n ?? 0);
}

function hexA(hex, a) {
  const h = String(hex ?? '#6b7cff').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${a})`;
}
