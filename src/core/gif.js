/**
 * Кодер GIF89a з LZW — свій, щоб не тягнути залежність заради двох скриптів.
 *
 * Був написаний для емблеми бота; коли знадобився ще й банер, переїхав сюди
 * замість того, щоб дублюватися. Приймає готові кадри як індекси палітри.
 */

/**
 * Палітра з плавних переходів. Кожен «промінь» — рівний градієнт між двома
 * кольорами, тож на градієнтах не буде смуг.
 * @param {Array<[number[], number[], number]>} ramps [від, до, скільки кроків]
 * @param {number[]} first перший колір (зазвичай тло)
 */
export function buildPalette(ramps, first = [5, 7, 13], size = 128) {
  const pal = [first];
  for (const [from, to, n] of ramps) {
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      pal.push([
        Math.round(from[0] + (to[0] - from[0]) * k),
        Math.round(from[1] + (to[1] - from[1]) * k),
        Math.round(from[2] + (to[2] - from[2]) * k),
      ]);
    }
  }
  while (pal.length < size) pal.push([0, 0, 0]);
  return pal.slice(0, size);
}

/**
 * Квантувальник: колір → індекс у палітрі.
 * Тримає кеш по 15-бітному ключу, інакше кожен піксель шукав би серед 128.
 */
export function quantizer(palette) {
  const lut = new Int16Array(32 * 32 * 32).fill(-1);
  return function nearest(r, g, b) {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    if (lut[key] >= 0) return lut[key];
    let best = 0;
    let bestD = 1e9;
    for (let i = 0; i < palette.length; i++) {
      const p = palette[i];
      const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    lut[key] = best;
    return best;
  };
}

class ByteStream {
  constructor() { this.parts = []; }
  byte(b) { this.parts.push(Buffer.from([b & 0xff])); }
  bytes(arr) { this.parts.push(Buffer.from(arr)); }
  short(v) { this.parts.push(Buffer.from([v & 0xff, (v >> 8) & 0xff])); }
  str(s) { this.parts.push(Buffer.from(s, 'ascii')); }
  done() { return Buffer.concat(this.parts); }
}

/** LZW зі змінною шириною коду — як вимагає формат GIF. */
function lzw(indices, minCodeSize) {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  let dict = new Map();
  let next = eoi + 1;
  let width = minCodeSize + 1;

  const out = [];
  let bitBuf = 0;
  let bitCount = 0;
  const emit = (code) => {
    bitBuf |= code << bitCount;
    bitCount += width;
    while (bitCount >= 8) {
      out.push(bitBuf & 0xff);
      bitBuf >>= 8;
      bitCount -= 8;
    }
  };
  const reset = () => {
    dict = new Map();
    next = eoi + 1;
    width = minCodeSize + 1;
  };

  emit(clear);
  let prev = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prev * 4096 + k;
    if (dict.has(key)) {
      prev = dict.get(key);
      continue;
    }
    emit(prev);
    dict.set(key, next);
    if (next === (1 << width) && width < 12) width++;
    next++;
    if (next >= 4096) { emit(clear); reset(); }
    prev = k;
  }
  emit(prev);
  emit(eoi);
  if (bitCount > 0) out.push(bitBuf & 0xff);

  // розбиваємо на під-блоки по 255 байт
  const blocks = [];
  for (let i = 0; i < out.length; i += 255) {
    const chunk = out.slice(i, i + 255);
    blocks.push(chunk.length, ...chunk);
  }
  blocks.push(0);
  return blocks;
}

/**
 * Зібрати GIF із кадрів.
 * @param {Uint8Array[]} frames кадри як індекси палітри
 * @param {{width:number,height:number,palette:number[][],delayCs:number}} opts
 */
export function encodeGif(frames, { width, height, palette, delayCs = 7 }) {
  const s = new ByteStream();
  s.str('GIF89a');
  s.short(width); s.short(height);
  s.byte(0xf0 | 6);          // глобальна палітра, 2^(6+1)=128 кольорів
  s.byte(0); s.byte(0);
  for (const c of palette) s.bytes(c);

  // зациклення (розширення Netscape)
  s.byte(0x21); s.byte(0xff); s.byte(11);
  s.str('NETSCAPE2.0');
  s.byte(3); s.byte(1); s.short(0); s.byte(0);

  for (const idx of frames) {
    s.byte(0x21); s.byte(0xf9); s.byte(4);
    s.byte(0);                 // без прозорості, disposal = не задано
    s.short(delayCs);
    s.byte(0); s.byte(0);

    s.byte(0x2c);
    s.short(0); s.short(0); s.short(width); s.short(height);
    s.byte(0);

    const min = 7;             // 128 кольорів
    s.byte(min);
    s.bytes(lzw(idx, min));
  }

  s.byte(0x3b);
  return s.done();
}
