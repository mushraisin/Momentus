/**
 * Перевірка проксі медіа: підпис, відмова чужим, переписування HLS-маніфеста,
 * кеш сегментів (щоб зал не качав той самий шматок стільки разів, скільки людей).
 */
import assert from 'node:assert';
import http from 'node:http';
import { signUrl, handleStream } from '../src/web/mediaProxy.js';

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

// ── «чужий» CDN, який пускає лише зі своїм Referer ──
let hits = 0;
const cdn = http.createServer((req, res) => {
  if (req.headers.referer !== 'https://site.example/') {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('forbidden');
  }
  if (req.url.startsWith('/master.m3u8')) {
    res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
    return res.end('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:6,\nseg1.ts\n/abs/seg2.ts\n');
  }
  if (req.url.startsWith('/seg1.ts')) {
    hits++;
    const body = Buffer.alloc(2048, 7);
    res.writeHead(200, { 'Content-Type': 'video/mp2t', 'Content-Length': body.length });
    return res.end(body);
  }
  res.writeHead(404);
  res.end();
});
await new Promise((r) => cdn.listen(0, '127.0.0.1', r));
const CDN = `http://127.0.0.1:${cdn.address().port}`;
const HDR = { referer: 'https://site.example/', 'user-agent': 'UA' };

// ── наш сервер лише з маршрутом /stream ──
const app = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/stream') return handleStream(req, res, url);
  res.writeHead(404);
  res.end();
});
await new Promise((r) => app.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${app.address().port}`;

const get = async (path, opts) => {
  const r = await fetch(BASE + path, opts);
  return { status: r.status, body: await r.text(), type: r.headers.get('content-type'), cache: r.headers.get('x-cache') };
};

// 1. без підпису — відмова
assert.equal((await get(`/stream?u=${encodeURIComponent(`${CDN}/seg1.ts`)}`)).status, 403);
// підроблений підпис теж не проходить
const forged = signUrl(`${CDN}/seg1.ts`, HDR).replace(/s=[^&]+/, 's=abcdef');
assert.equal((await get(forged)).status, 403);
ok('без коректного підпису проксі не працює (не відкритий проксі)');

// 2. напряму CDN не віддає, через проксі — віддає
const direct = await fetch(`${CDN}/seg1.ts`);
assert.equal(direct.status, 403, 'CDN справді перевіряє Referer');
const viaProxy = await get(signUrl(`${CDN}/seg1.ts`, HDR));
assert.equal(viaProxy.status, 200, 'проксі підставив Referer');
assert.equal(viaProxy.body.length, 2048);
ok('потік із перевіркою Referer грає через проксі');

// 3. кеш: другий глядач не змушує качати сегмент ще раз
const before = hits;
await get(signUrl(`${CDN}/seg1.ts`, HDR));
const second = await get(signUrl(`${CDN}/seg1.ts`, HDR));
assert.equal(hits, before, 'до CDN більше не ходили');
assert.equal(second.cache, 'hit', 'віддано з памʼяті');
ok('сегмент качається один раз на весь зал');

// 4. маніфест переписується — усі шляхи ведуть через проксі
const man = await get(signUrl(`${CDN}/master.m3u8`, HDR));
assert.equal(man.status, 200);
assert.ok(man.type.includes('mpegurl'));
const lines = man.body.split('\n').filter(Boolean);
assert.ok(lines.filter((l) => !l.startsWith('#')).every((l) => l.startsWith('/stream?')), 'сегменти через проксі');
assert.ok(/URI="\/stream\?/.test(man.body), 'ключ шифрування теж через проксі');
ok('HLS-маніфест переписано: сегменти й ключі йдуть через нас');

cdn.close();
app.close();
console.log(`\n✅ Усі ${passed} перевірок проксі пройдено.`);
