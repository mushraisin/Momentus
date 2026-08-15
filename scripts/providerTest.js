/** Перевірка резолвера джерел для кінотеатру (без мережі). */
import assert from 'node:assert';
import { resolveSource, extractFromHtml, bestFromPlaylist, scanForStream } from '../src/web/providers.js';

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };
const P = 'https://site.example/watch';

// ── відомі майданчики ──
assert.deepEqual(await resolveSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  { provider: 'youtube', src: 'dQw4w9WgXcQ', sync: 'full' });
assert.equal((await resolveSource('https://youtu.be/abc123XYZ')).provider, 'youtube');
assert.equal((await resolveSource('https://vimeo.com/76979871')).provider, 'vimeo');
assert.equal((await resolveSource('https://twitch.tv/videos/42')).sync, 'cue');
assert.equal((await resolveSource('https://cdn.x/a.mp4')).provider, 'file');
assert.equal((await resolveSource('https://cdn.x/live.m3u8')).provider, 'hls');
assert.equal((await resolveSource('/media/7')).src, '/media/7');
assert.equal(await resolveSource('ftp://x/y'), null);
assert.equal(await resolveSource('http://192.168.0.10/v.mp4'), null);
ok('майданчики, файли, стріми, локальні адреси');

// ── Playerjs ──
const pjs = {
  'просте посилання': [
    '<script>new Playerjs({id:"player",file:"https://cdn.site/v/720.mp4"});</script>',
    { provider: 'file', src: 'https://cdn.site/v/720.mp4' },
  ],
  'список якостей — беремо найвищу': [
    '<script>new Playerjs({file:"[360p]https://c/1.mp4,[1080p]https://c/3.mp4,[720p]https://c/2.mp4"})</script>',
    { provider: 'file', src: 'https://c/3.mp4' },
  ],
  'HLS у списку якостей': [
    '<script>new Playerjs({file:"[480p]//c/a/480.m3u8,[1080p]//c/a/1080.m3u8"})</script>',
    { provider: 'hls', src: 'https://c/a/1080.m3u8' },
  ],
  'JSON-плейлист із сезонами': [
    '<script>new Playerjs({file:[{"title":"Сезон 1","folder":[{"title":"Серія 1","file":"[720p]https://c/s1e1.mp4"}]}]})</script>',
    { provider: 'file', src: 'https://c/s1e1.mp4' },
  ],
  'file у змінній': [
    '<script>var pl="[1080p]https://c/x.mp4"; new Playerjs({file:pl})</script>',
    { provider: 'file', src: 'https://c/x.mp4' },
  ],
  'екрановані слеші': [
    '<script>new Playerjs({file:"https:\\/\\/c\\/e.mp4"})</script>',
    { provider: 'file', src: 'https://c/e.mp4' },
  ],
  'зовнішній плейлист': [
    '<script>new Playerjs({file:"https://c/list.txt"})</script>',
    { provider: 'playlist', src: 'https://c/list.txt' },
  ],
};
for (const [name, [html, want]] of Object.entries(pjs)) {
  const got = extractFromHtml(html, P);
  assert.ok(got, `${name}: нічого не знайдено`);
  assert.equal(got.provider, want.provider, `${name}: провайдер`);
  assert.equal(got.src, want.src, `${name}: посилання`);
}
ok(`Playerjs: ${Object.keys(pjs).length} варіантів конфігу`);

// ── озвучки: кожна доріжка зі своїми якостями ──
{
  const html = '<script>new Playerjs({file:[{"title":"Дубляж","file":"[480p]https://c/d480.mp4,[1080p]https://c/d1080.mp4"},'
    + '{"title":"Оригінал","file":"[720p]https://c/o720.mp4"}]})</script>';
  const r = extractFromHtml(html, P);
  assert.equal(r.src, 'https://c/d1080.mp4', 'активна — найкраща якість першої озвучки');
  assert.equal(r.variants.length, 2, 'дві озвучки');
  assert.equal(r.variants[0].label, 'Дубляж');
  assert.equal(r.variants[0].qualities.length, 2, 'у дубляжу дві якості');
  assert.equal(r.variants[1].qualities.length, 1, 'в оригіналу одна');

  // серії (folder) озвучками не вважаємо
  const series = '<script>new Playerjs({file:[{"title":"Сезон 1","folder":[{"title":"Серія 1","file":"https://c/s1.mp4"}]}]})</script>';
  const s = extractFromHtml(series, P);
  assert.equal(s.src, 'https://c/s1.mp4');
  assert.ok(!s.variants, 'сезони не плутаються з озвучками');
}
ok('озвучки з плейлиста, у кожної свої якості');

// ── звичайні сторінки ──
assert.equal(extractFromHtml('<meta property="og:video" content="https://cdn.x/v.mp4">', P).src, 'https://cdn.x/v.mp4');
assert.equal(extractFromHtml('<video src="/f/c.webm"></video>', P).src, 'https://site.example/f/c.webm');
assert.equal(extractFromHtml('<meta property="og:video" content="https://youtube.com/embed/ZZZzzzYYY11">', P).provider, 'youtube');
assert.equal(extractFromHtml('<h1>нічого</h1>', P), null);
ok('метатеги, теги <video>, вбудований YouTube');

// ── підхоплюємо саме плеєр, а не сторінку сайту ──
const frames = {
  'kodik у рамці': ['<title>Фільм</title><iframe src="//kodik.info/serial/1/ab/720p"></iframe>',
    'https://kodik.info/serial/1/ab/720p'],
  'ліниве data-src': ['<title>Кіно</title><iframe data-src="https://videocdn.tv/embed/9"></iframe>',
    'https://videocdn.tv/embed/9'],
  'рамку підставляє скрипт': ['<title>С</title><script>var u="https://hdvb.site/embed/xyz"</script>',
    'https://hdvb.site/embed/xyz'],
  'реклама поруч із плеєром': ['<title>Т</title><iframe src="https://doubleclick.net/ad"></iframe>'
    + '<iframe src="https://player.site/embed/5"></iframe>', 'https://player.site/embed/5'],
};
for (const [name, [html, want]] of Object.entries(frames)) {
  const got = extractFromHtml(html, P);
  assert.equal(got.provider, 'iframe', `${name}: провайдер`);
  assert.equal(got.src.replace(/\/$/, ''), want, `${name}: адреса плеєра`);
  assert.ok(got.embedded, `${name}: позначено як вбудований плеєр`);
}
// коли плеєра немає — лишається сама сторінка
assert.equal(extractFromHtml('<title>Просто сторінка</title>', P).src, P);
ok(`вбудований плеєр замість сторінки сайту: ${Object.keys(frames).length} випадків`);

// ── потік у відповіді балансера чи в коді сторінки ──
{
  const B = 'https://balancer.x/t?token=1';
  assert.equal(scanForStream('{"data":{"hls":"https://cdn.x/master.m3u8?t=9"}}', B).provider, 'hls');
  assert.equal(scanForStream('{"result":[{"sources":[{"src":"https://cdn.x/720.mp4"}]}]}', B).src, 'https://cdn.x/720.mp4');
  assert.equal(scanForStream('cfg.stream="https://cdn.x/index.m3u8";', B).provider, 'hls', 'адреса просто в JS');
  assert.equal(scanForStream('{"file":"https:\\/\\/cdn.x\\/a.m3u8"}', B).src, 'https://cdn.x/a.m3u8', 'екрановані слеші');
  assert.equal(scanForStream('{"error":"forbidden"}', B), null, 'нема потоку — нема вигадок');
  assert.equal(scanForStream('', B), null);

  // і те саме, коли адреса захована в коді сторінки
  const page = '<title>Кіно</title><script>var p={};p.file="https://cdn.x/hls/main.m3u8";</script>';
  const got = extractFromHtml(page, P);
  assert.equal(got.provider, 'hls');
  assert.equal(got.src, 'https://cdn.x/hls/main.m3u8');
}
ok('HLS/mp4 із JSON балансера та з коду сторінки');

// ── плейлисти окремо ──
assert.equal(bestFromPlaylist('[720p]https://c/a.mp4,[2160p]https://c/b.mp4').src, 'https://c/b.mp4');
assert.equal(bestFromPlaylist('https://c/single.mp4').src, 'https://c/single.mp4');
assert.equal(bestFromPlaylist(''), null);
assert.equal(bestFromPlaylist('не посилання'), null);
ok('вибір найкращої якості з плейлиста');

console.log(`\n✅ Усі ${passed} перевірок резолвера пройдено.`);
