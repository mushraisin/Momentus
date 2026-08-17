/**
 * Анімований банер бота — у стилі його ж аватарки: глибоке фіолетове небо,
 * золоті чотирипроменеві зірки, які дихають і повільно обертаються, і розсип
 * дрібних іскор.
 *
 * Результат: assets/banner.gif (680×240 — розмір банера профілю Discord).
 *
 *   node scripts/makeBanner.js [кадрів]
 *   node scripts/setBanner.js          # застосувати до бота
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { buildPalette, quantizer, encodeGif } from '../src/core/gif.js';

const W = 680;
const H = 240;
const FRAMES = Number(process.argv[2] || 30);
const DELAY_CS = 8;
const OUT = path.join(process.cwd(), 'assets', 'banner.gif');

// Кольори аватарки: нічне небо від майже чорного до фіолетового,
// і тепле золото зірок.
const SKY_TOP = [26, 18, 54];
const SKY_BOT = [61, 42, 106];
const GOLD = [255, 209, 92];
const GOLD_HI = [255, 244, 200];

// Більшість кольорів віддано фіолетовим півтонам: саме на них лягають ореоли
// зірок, і без щільної шкали навколо кожної проступали кільця від квантування.
const PALETTE = buildPalette([
  [SKY_TOP, SKY_BOT, 30],            // саме небо
  [SKY_BOT, [122, 92, 178], 26],     // світліший край
  [[122, 92, 178], [168, 138, 190], 20], // ореоли зірок
  [[168, 138, 190], GOLD, 24],       // перехід до золота
  [GOLD, GOLD_HI, 16],               // осердя зірок
  [SKY_TOP, [140, 128, 190], 10],    // дрібні іскри
], SKY_TOP);

const nearest = quantizer(PALETTE);
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/** Детермінований шум — щоб малюнок був однаковий при кожній генерації. */
function rnd(i) {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Чотирипроменева зірка — саме така, як на аватарці: довгі гострі промені
 * по осях і коротші по діагоналях.
 */
function star(ctx, cx, cy, r, spin, glow) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin);

  // Ореол: ширший і слабший, із проміжними зупинками — так перехід стає
  // достатньо пологим, щоб після квантування не проступали кільця.
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 2.6);
  halo.addColorStop(0, rgb(GOLD, 0.34 * glow));
  halo.addColorStop(0.22, rgb(GOLD, 0.16 * glow));
  halo.addColorStop(0.48, rgb(GOLD, 0.06 * glow));
  halo.addColorStop(0.72, rgb(GOLD, 0.02 * glow));
  halo.addColorStop(1, rgb(GOLD, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, r * 2.6, 0, Math.PI * 2);
  ctx.fill();

  // Промені: тонка талія робить їх гострими, як на аватарці. Ширша талія
  // перетворювала зірку на пухкий ромб.
  const waist = r * 0.085;
  const draw = (len, thick) => {
    ctx.beginPath();
    ctx.moveTo(0, -len);
    ctx.quadraticCurveTo(thick, -thick, len, 0);
    ctx.quadraticCurveTo(thick, thick, 0, len);
    ctx.quadraticCurveTo(-thick, thick, -len, 0);
    ctx.quadraticCurveTo(-thick, -thick, 0, -len);
    ctx.closePath();
    ctx.fill();
  };

  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgb(GOLD_HI, 1));
  g.addColorStop(0.35, rgb(GOLD, 1));
  g.addColorStop(1, rgb(GOLD, 0.85));
  ctx.fillStyle = g;

  draw(r, waist);
  ctx.rotate(Math.PI / 4);
  draw(r * 0.34, waist * 0.55);   // коротші діагональні промені

  // осердя
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = rgb(GOLD_HI, 0.95);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.13, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** Три головні зірки — велика ліворуч і дві менші, як на аватарці. */
const MAIN = [
  { x: 0.30, y: 0.52, r: 46, speed: 0.10, phase: 0 },
  { x: 0.46, y: 0.34, r: 26, speed: -0.14, phase: 1.9 },
  { x: 0.55, y: 0.63, r: 17, speed: 0.18, phase: 3.4 },
  { x: 0.76, y: 0.44, r: 22, speed: -0.11, phase: 5.1 },
];

/** Дрібні іскри розсипом. */
const SPARKS = Array.from({ length: 90 }, (_, i) => ({
  x: rnd(i * 3.1),
  y: rnd(i * 7.7 + 1),
  s: 1 + Math.floor(rnd(i * 5.3 + 2) * 2.4),
  phase: rnd(i * 11.9 + 3) * Math.PI * 2,
  speed: 0.6 + rnd(i * 2.7 + 4) * 1.6,
}));

function drawFrame(ctx, f) {
  const t = (f / FRAMES) * Math.PI * 2;

  // ── Небо ──
  const sky = ctx.createLinearGradient(0, 0, W * 0.35, H);
  sky.addColorStop(0, rgb(SKY_BOT));
  sky.addColorStop(1, rgb(SKY_TOP));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // м'яке світло, що повільно ходить — небо перестає бути пласким
  const lx = W * (0.34 + Math.sin(t * 0.5) * 0.10);
  const ly = H * (0.42 + Math.cos(t * 0.4) * 0.12);
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.5);
  glow.addColorStop(0, rgb([122, 92, 178], 0.5));
  glow.addColorStop(1, rgb([122, 92, 178], 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Іскри ──
  for (const s of SPARKS) {
    const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
    ctx.fillStyle = rgb(GOLD_HI, a * 0.75);
    ctx.fillRect(Math.round(s.x * W), Math.round(s.y * H), s.s, s.s);
  }

  // ── Головні зірки ──
  for (const m of MAIN) {
    // дихання: розмір і яскравість ходять разом, як на аватарці
    const beat = 0.5 + 0.5 * Math.sin(t + m.phase);
    star(ctx, m.x * W, m.y * H, m.r * (0.9 + beat * 0.18), t * m.speed + m.phase, 0.65 + beat * 0.35);
  }

  // ── Легке затемнення країв, щоб банер не «витікав» ──
  const vig = ctx.createLinearGradient(0, 0, W, 0);
  vig.addColorStop(0, rgb(SKY_TOP, 0.35));
  vig.addColorStop(0.25, rgb(SKY_TOP, 0));
  vig.addColorStop(0.8, rgb(SKY_TOP, 0));
  vig.addColorStop(1, rgb(SKY_TOP, 0.45));
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
}

// ─────────────────────────────────────────────
//  Збірка
// ─────────────────────────────────────────────
/**
 * Впорядкований дизеринг 4×4 (матриця Баєра).
 *
 * У GIF лише 128 кольорів, а банер — це майже суцільні плавні градієнти неба
 * й ореолів. Без дизерингу вони розпадаються на видимі кільця й плями.
 * Дрібне зміщення кольору за позицією пікселя розбиває межі на шум, який
 * око читає як плавний перехід.
 */
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
const DITHER = 10; // сила: більше — помітніший шум, менше — знову смуги

const canvas = createCanvas(W, H);
const ctx = canvas.getContext('2d');
const frames = [];

for (let i = 0; i < FRAMES; i++) {
  drawFrame(ctx, i);
  const { data } = ctx.getImageData(0, 0, W, H);
  const idx = new Uint8Array(W * H);
  for (let q = 0; q < idx.length; q++) {
    const p = q * 4;
    const d = (BAYER[(q / W | 0) & 3][q % W & 3] / 16 - 0.5) * DITHER;
    idx[q] = nearest(
      Math.max(0, Math.min(255, data[p] + d)),
      Math.max(0, Math.min(255, data[p + 1] + d)),
      Math.max(0, Math.min(255, data[p + 2] + d)),
    );
  }
  frames.push(idx);
  process.stdout.write(`\r  кадр ${i + 1}/${FRAMES}`);
}

const gif = encodeGif(frames, { width: W, height: H, palette: PALETTE, delayCs: DELAY_CS });
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, gif);

console.log(`\n✅ ${OUT}`);
console.log(`   ${W}×${H}, ${FRAMES} кадрів, ${(gif.length / 1024).toFixed(0)} КБ`);
