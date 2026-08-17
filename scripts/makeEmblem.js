/**
 * Генератор анімованої емблеми «Моментус» — та сама естетика, що й на сайті:
 * темне тло, дим, піксельні зірки й світний знак «пуск».
 *
 * Результат: assets/emblem.gif (аватар бота + прикраса головної сторінки).
 * Кодер GIF89a написаний тут же, щоб не тягнути залежностей у проєкт.
 *
 *   node scripts/makeEmblem.js [розмір] [кадрів]
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import { buildPalette, quantizer, encodeGif } from '../src/core/gif.js';

const SIZE = Number(process.argv[2] || 256);
const FRAMES = Number(process.argv[3] || 24);
const DELAY_CS = 7;                     // сотих секунди на кадр
const OUT = path.join(process.cwd(), 'assets', 'emblem.gif');

// ─────────────────────────────────────────────
//  Шум для диму (той самий підхід, що на сайті)
// ─────────────────────────────────────────────
function hash(x, y, s) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(s, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12; h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function vn(u, v, G, s) {
  const x = u * G; const y = v * G;
  const xi = Math.floor(x); const yi = Math.floor(y);
  const xf = x - xi; const yf = y - yi;
  const sx = xf * xf * (3 - 2 * xf); const sy = yf * yf * (3 - 2 * yf);
  const x0 = ((xi % G) + G) % G; const x1 = (x0 + 1) % G;
  const y0 = ((yi % G) + G) % G; const y1 = (y0 + 1) % G;
  const a = hash(x0, y0, s); const b = hash(x1, y0, s);
  const c = hash(x0, y1, s); const d = hash(x1, y1, s);
  const t1 = a + (b - a) * sx; const t2 = c + (d - c) * sx;
  return t1 + (t2 - t1) * sy;
}
const fbm = (u, v, s) => vn(u, v, 3, s) * 0.52 + vn(u, v, 6, s + 7) * 0.26
  + vn(u, v, 12, s + 13) * 0.14 + vn(u, v, 24, s + 19) * 0.08;
/** Спотворення координат — саме воно робить із хмаринок пасма диму. */
function warped(u, v, s) {
  const wx = fbm(u + 0.13, v + 0.71, s + 101) - 0.5;
  const wy = fbm(u + 0.57, v + 0.29, s + 211) - 0.5;
  return fbm(u + wx * 0.55, v + wy * 0.55, s);
}

/** Тайл диму заданого відтінку. */
function smokeTile(N, tint, seed, gamma) {
  const vals = new Float32Array(N * N);
  let mn = 1e9; let mx = -1e9; let i = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const v = warped(x / N, y / N, seed);
      vals[i++] = v;
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
  }
  const rng = (mx - mn) || 1;
  const cv = createCanvas(N, N);
  const cx = cv.getContext('2d');
  const img = cx.createImageData(N, N);
  const d = img.data;
  let j = 0;
  for (i = 0; i < vals.length; i++) {
    const k = Math.pow((vals[i] - mn) / rng, gamma);
    d[j++] = tint[0]; d[j++] = tint[1]; d[j++] = tint[2]; d[j++] = k * 255;
  }
  cx.putImageData(img, 0, 0);
  return cv;
}

// ─────────────────────────────────────────────
//  Малювання кадру
// ─────────────────────────────────────────────
const layers = [
  { tile: smokeTile(128, [128, 146, 242], 1337, 2.4), sc: 1.9, a: 0.34, ox: 16, oy: 12, k: 1 },
  { tile: smokeTile(128, [168, 120, 228], 4242, 2.9), sc: 1.1, a: 0.22, ox: 22, oy: 17, k: -1 },
];

const stars = Array.from({ length: 42 }, (_, i) => ({
  x: hash(i, 7, 11) * SIZE,
  y: hash(i, 13, 23) * SIZE,
  s: hash(i, 31, 5) < 0.7 ? 2 : 3,
  ph: hash(i, 17, 41) * Math.PI * 2,
}));

function drawFrame(ctx, i) {
  const p = (i / FRAMES) * Math.PI * 2;          // повний цикл — щоб гіфка зациклилась
  const c = SIZE / 2;

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // ── дим: шари кружляють замкнутою орбітою, тож рух безшовний ──
  ctx.globalCompositeOperation = 'lighter';
  for (const L of layers) {
    ctx.save();
    ctx.globalAlpha = L.a;
    ctx.translate(c, c);
    ctx.rotate(L.k * p * 0.12);
    ctx.scale(L.sc, L.sc);
    ctx.translate(Math.sin(p) * L.ox, Math.cos(p) * L.oy);
    ctx.fillStyle = ctx.createPattern(L.tile, 'repeat');
    ctx.fillRect(-SIZE, -SIZE, SIZE * 2, SIZE * 2);
    ctx.restore();
  }

  // ── зірки ──
  for (const s of stars) {
    const a = (Math.sin(p * 2 + s.ph) * 0.5 + 0.5) ** 2;
    if (a < 0.05) continue;
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = '#dfe7ff';
    ctx.fillRect(s.x | 0, s.y | 0, s.s, s.s);
  }

  // ── знак «пуск» із пульсуючим сяйвом ──
  const pulse = 0.5 + 0.5 * Math.sin(p);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(c, c, 0, c, c, SIZE * (0.34 + pulse * 0.05));
  glow.addColorStop(0, `rgba(107,124,255,${(0.3 + pulse * 0.18).toFixed(3)})`);
  glow.addColorStop(1, 'rgba(107,124,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.globalCompositeOperation = 'source-over';
  const r = SIZE * 0.17;
  ctx.beginPath();
  ctx.moveTo(c - r * 0.72, c - r);
  ctx.lineTo(c + r, c);
  ctx.lineTo(c - r * 0.72, c + r);
  ctx.closePath();
  ctx.fillStyle = `rgba(${190 + pulse * 65 | 0},${200 + pulse * 55 | 0},255,1)`;
  ctx.fill();

  // тонке кільце по краю — щоб аватар читався кружечком
  ctx.strokeStyle = `rgba(107,124,255,${(0.35 + pulse * 0.2).toFixed(3)})`;
  ctx.lineWidth = Math.max(2, SIZE * 0.012);
  ctx.beginPath();
  ctx.arc(c, c, c - ctx.lineWidth, 0, Math.PI * 2);
  ctx.stroke();
}

// ─────────────────────────────────────────────
//  Палітра
// ─────────────────────────────────────────────
/** 128 кольорів: чорний, димчасті переходи, білі зірки. */
const PALETTE = buildPalette([
  [[5, 7, 13], [40, 48, 82], 24],          // тьмяний дим
  [[40, 48, 82], [107, 124, 255], 32],     // синій акцент
  [[60, 40, 90], [167, 120, 235], 28],     // фіолетові пасма
  [[107, 124, 255], [255, 255, 255], 24],  // світло знака й зірок
  [[5, 7, 13], [90, 90, 120], 18],         // сірі напівтони
]);

const nearest = quantizer(PALETTE);
// ─────────────────────────────────────────────
//  Збірка
// ─────────────────────────────────────────────
const canvas = createCanvas(SIZE, SIZE);
const ctx = canvas.getContext('2d');
const frames = [];

for (let i = 0; i < FRAMES; i++) {
  drawFrame(ctx, i);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const idx = new Uint8Array(SIZE * SIZE);
  for (let p = 0, q = 0; p < data.length; p += 4) {
    idx[q++] = nearest(data[p], data[p + 1], data[p + 2]);
  }
  frames.push(idx);
  process.stdout.write(`\r  кадр ${i + 1}/${FRAMES}`);
}

const gif = encodeGif(frames, { width: SIZE, height: SIZE, palette: PALETTE, delayCs: DELAY_CS });
await fs.mkdir(path.dirname(OUT), { recursive: true });
await fs.writeFile(OUT, gif);

console.log(`\n✅ ${OUT}`);
console.log(`   ${SIZE}×${SIZE}, ${FRAMES} кадрів, ${(gif.length / 1024).toFixed(0)} КБ`);
