/**
 * Перевірка веб-сайту без Discord: піднімає сервер з мок-клієнтом
 * і робить реальні HTTP-запити (лендинг, галерея, завантаження, лайки, мови).
 */
import 'dotenv/config';
import assert from 'node:assert';
import { initDatabase } from '../src/database/db.js';

process.env.WEB_PORT = process.env.WEB_PORT || '8199';
process.env.WEB_PUBLIC_URL = '';
await initDatabase();

const {
  usersRepo, activityRepo, traitsRepo, sitePagesRepo, siteAssetsRepo, sessionsRepo, galleryRepo,
} = await import('../src/database/repositories.js');
const { reputationService } = await import('../src/services/reputationService.js');
const { configService } = await import('../src/services/configService.js');
const { ruleAnalyzeBatch } = await import('../src/services/analysis/ruleEngine.js');
const { startWebServer, stopWebServer } = await import('../src/web/server.js');

const G = `web-${Date.now()}`;
const U = '111222333444555666';
await configService.load(G);

// дані
await usersRepo.ensure(G, U, 'Тестовий', Date.now() - 90 * 86400_000);
for (let i = 0; i < 200; i++) {
  await usersRepo.bump(G, U, 'total_messages', 1);
  await activityRepo.bump(G, U, 'messages', 1);
}
const batch = ruleAnalyzeBatch(Array.from({ length: 20 }, (_, i) => ({
  id: i + 1, userId: U, content: 'Дякую! Ось як це зробити: спробуй оновити конфіг.',
})));
for (const b of batch) await traitsRepo.applySample(G, U, b.traits);
await reputationService.recompute(G, U);

await sitePagesRepo.save(G, { slug: 'rules', title: 'Правила', body: '<p>Будьте ввічливі.</p>' });
await siteAssetsRepo.save(G, { path: '/custom.css', mime: 'text/css', content: 'body{--accent:#e91e63}' });

// сесія для авторизованих дій
const SID = `test-session-${Date.now()}`;
const AVATAR = 'a1b2c3d4e5f6';
await sessionsRepo.create({ token: SID, guildId: G, userId: U, username: 'Тестовий', avatar: AVATAR, ttlMs: 600_000 });

// голосовий канал кінотеатру: спершу порожній, далі «саджаємо» туди учасника
const voiceMembers = new Map();
const voiceChannel = { id: 'vc-1', name: 'Кінозал', members: voiceMembers };

const guild = {
  id: G,
  name: 'Тестова Спільнота',
  premiumTier: 0,
  // потрібен панелям бота: вони кладуть іконку сервера у підвал ембеда
  iconURL: () => null,
  members: { cache: new Map(), fetch: async () => null },
  roles: { cache: new Map() },
  channels: { cache: new Map([['vc-1', voiceChannel]]), fetch: async () => null },
};
startWebServer({ guilds: { cache: new Map([[G, guild]]) } });
await new Promise((r) => setTimeout(r, 400));

const BASE = `http://127.0.0.1:${process.env.WEB_PORT}`;
let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, { redirect: 'manual', ...opts });
  return { status: r.status, body: await r.text(), type: r.headers.get('content-type'), loc: r.headers.get('location') };
}
const auth = { headers: { cookie: `sid=${SID}` } };

// 1. лендинг
const home = await req('/');
assert.equal(home.status, 200);
assert.ok(home.body.includes('>М<') && home.body.includes('>С<'), 'літери МОМЕНТУС');
assert.ok(home.body.includes('задрипанка'), 'підпис');
assert.ok(home.body.includes('id="fog"') && home.body.includes('id="stars"'), 'полотна тла');
assert.ok(home.body.includes('/gallery'), 'кнопка галереї');
assert.ok(!/\.logo\{[^}]*linear-gradient/.test(home.body), 'без градієнта');
ok('GET / — лендинг (Вхід + Галерея, дим і зірки)');

// 2. мови
for (const [code, word] of [['en', 'zadrypanka'], ['uk', 'задрипанка']]) {
  const r = await fetch(`${BASE}/?lang=${code}`, { redirect: 'manual' });
  assert.equal(r.status, 302, 'перемикач ставить cookie і редіректить');
  const page = await req('/', { headers: { cookie: `lang=${code}` } });
  assert.ok(page.body.includes(word), `мова ${code}`);
}
const langMenu = await req('/');
assert.ok(langMenu.body.includes('langmenu'), 'спадне меню мов');
assert.ok(!/🇺🇦|🇬🇧|🇷🇺/.test(langMenu.body), 'без прапорів');
assert.ok(!langMenu.body.includes('lang=ru'), 'російську прибрано');
{
  // знята мова тихо стає українською, а не 404
  const r = await fetch(`${BASE}/?lang=ru`, { redirect: 'manual' });
  assert.equal(r.status, 302);
  assert.ok(/lang=uk/.test(r.headers.get('set-cookie') ?? ''), 'ru → uk');
}
ok('перемикач мов — спадне меню UA / EN, російську прибрано');

// 3. галерея порожня
let gal = await req('/gallery');
assert.equal(gal.status, 200);
assert.ok(gal.body.includes('langs'), 'вибір мови в шапці');
ok('GET /gallery — сторінка галереї');

// 4. завантаження файлу (multipart)
const png = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000100' +
  '05fe02fea7f0e9c50000000049454e44ae426082', 'hex',
);
const BND = '----testboundary9182';
const parts = Buffer.concat([
  Buffer.from(`--${BND}\r\nContent-Disposition: form-data; name="title"\r\n\r\nМій кліп\r\n`),
  Buffer.from(`--${BND}\r\nContent-Disposition: form-data; name="file"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n`),
  png,
  Buffer.from(`\r\n--${BND}--\r\n`),
]);
const up = await req('/upload', {
  method: 'POST',
  headers: { ...auth.headers, 'content-type': `multipart/form-data; boundary=${BND}` },
  body: parts,
});
assert.equal(up.status, 302, 'редірект після завантаження');
assert.ok(!String(up.loc).includes('e='), `без помилки, отримали: ${up.loc}`);
const items = await galleryRepo.list(G);
assert.equal(items.length, 1, 'елемент у БД');
assert.equal(items[0].kind, 'image');
assert.equal(items[0].title, 'Мій кліп');
ok(`завантаження в БД (${items[0].size_bytes} байт, kind=${items[0].kind})`);

// 5. віддача медіа
const media = await req(`/media/${items[0].id}`);
assert.equal(media.status, 200);
assert.ok(media.type.includes('image/png'), 'MIME із БД');
ok('GET /media/:id — файл віддається з БД');

// 6. лайк
const like1 = await req(`/api/like/${items[0].id}`, { method: 'POST', ...auth });
const j1 = JSON.parse(like1.body);
assert.equal(j1.liked, true);
assert.equal(j1.likes, 1);
const like2 = await req(`/api/like/${items[0].id}`, { method: 'POST', ...auth });
const j2 = JSON.parse(like2.body);
assert.equal(j2.liked, false);
assert.equal(j2.likes, 0);
ok('лайк / зняття лайка');

// 7. лайк без входу — заборонено
const anon = await req(`/api/like/${items[0].id}`, { method: 'POST' });
assert.equal(anon.status, 401);
ok('лайк без авторизації відхилено');

// 8. завантаження без входу — заборонено
const noAuth = await req('/upload', {
  method: 'POST',
  headers: { 'content-type': `multipart/form-data; boundary=${BND}` },
  body: parts,
});
assert.ok(String(noAuth.loc).includes('e=auth'), 'редірект з помилкою auth');
ok('завантаження без авторизації відхилено');

// 9. галерея показує елемент
gal = await req('/gallery', auth);
assert.ok(gal.body.includes('Мій кліп'), 'підпис у стрічці');
assert.ok(gal.body.includes(`/media/${items[0].id}`), 'медіа в розмітці');
assert.ok(gal.body.includes(AVATAR), 'аватар автора під публікацією');
assert.equal(items[0].avatar, AVATAR, 'аватар збережено разом із публікацією');
ok('галерея відображає завантажене разом з аватаром автора');

// 9.0 посилання автора в куті: репозиторій і Telegram
{
  const g = await req('/gallery');
  assert.ok(g.body.includes('class="ghbar"'), 'кут із посиланнями є');
  assert.ok(g.body.includes('https://github.com/mushraisin?tab=repositories'), 'GitHub на місці');
  assert.ok(g.body.includes('https://t.me/mushbarry'), 'Telegram поруч');
  assert.equal((g.body.match(/class="gh"/g) ?? []).length, 2, 'дві іконки, однакові на вигляд');
  // обидві відкриваються в новій вкладці й не течуть реферером
  assert.equal((g.body.match(/rel="noopener noreferrer"/g) ?? []).length >= 2, true, 'безпечні посилання');
  const home = await req('/');
  assert.ok(home.body.includes('https://t.me/mushbarry'), 'на головній теж');
}
ok('у куті — GitHub і Telegram');

// 9.05 один стиль кнопок на весь сайт
{
  const g = await req('/gallery', auth);
  // «обрано» скрізь однакове: шапка, вкладки, мови, пункти меню, якість
  const GRAD = 'linear-gradient(180deg,var(--accent-hi),var(--accent-lo))';
  for (const sel of ['nav a.active', '.tabs a.on', '.langmenu a.on', '.drop-opt.on', '.qopt.on']) {
    const rule = new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^{]*\\{[^}]*${GRAD.replace(/[()]/g, '\\$&')}`);
    assert.ok(rule.test(g.body) || g.body.includes(`${sel},`) || g.body.includes(`,${sel}`),
      `${sel} користується спільним стилем вибору`);
  }

  // колір бере токени, тож обраний акцент діє й під курсором,
  // а не повертається до типового синього
  assert.match(g.body, /--accent:#6b7cff;--accent-lo:#5b6bf0;--accent-hi:#7d8bff;--accent-up:#8b97ff/,
    'акцент заданий токенами');
  assert.ok(!/:hover\{[^}]*linear-gradient\(180deg,#8b97ff/.test(g.body),
    'наведення не має жорстко вписаного кольору');
  // рідна кнопка вибору файлу не лишилася суцільно фіолетовою
  assert.ok(!/::file-selector-button\{[^}]*background:var\(--accent\)/.test(g.body),
    'кнопка файлу в стилі сайту, а не рідна акцентна');
  // місце під «✓» зарезервоване там, де є власні відступи
  assert.match(g.body, /\.langmenu a\{[^}]*padding:9px 28px 9px 11px/, 'галочка не налазить на мову');
  assert.match(g.body, /\.qopt,\.vopt,\.sopt\{padding:8px 28px 8px 11px/,
    'галочка не налазить на якість, озвучку й субтитри');
}
ok('єдиний стиль кнопок і позначки «обрано»');

// 9.06 стрічка: однакові картки з прев’ю 16:9
{
  const g = await req('/gallery', auth);
  assert.match(g.body, /\.item \.media\{width:100%;aspect-ratio:16\/9/, 'прев’ю однакових пропорцій');
  assert.ok(!/\.item\.tall \.media/.test(g.body), 'різновисоких плиток більше немає');
  assert.match(g.body, /\.item \.cap\{[^}]*min-height:2\.7em/, 'місце під підпис лишається завжди');
  assert.match(g.body, /\.item \.meta\{display:grid/, 'підпис-панель сталої розкладки');
  assert.ok(!/class="item tall"/.test(g.body), 'у розмітці немає високих плиток');
}
ok('стрічка: однакові картки, прев’ю 16:9');

// 9.1 велике вікно публікації: клік по плитці розгортає її
{
  const g = await req('/gallery', auth);
  assert.ok(g.body.includes('id="lb"'), 'шар для великого вікна є');
  assert.match(g.body, /\.lbox\{--stage/, 'стиль великого вікна');
  assert.match(g.body, /\.lbnav\{position:absolute/, 'стрілки до сусідніх публікацій');
  assert.ok(g.body.includes("shot=e.target.closest('.shot,.spot-m')"), 'клік по плитці відкриває вікно');
  assert.ok(g.body.includes("e.key==='ArrowRight'") && g.body.includes("e.key==='ArrowLeft'"),
    'гортання клавішами');
  assert.ok(g.body.includes("e.key==='Escape'"), 'Esc закриває');
  // у стрічці відео — прев'ю без рідних кнопок, керування вже у вікні
  assert.ok(!/<video class="media[^"]*"[^>]*controls/.test(g.body), 'у плитці немає рідних кнопок відео');
  assert.match(g.body, /\.item video\.media\{cursor:zoom-in;pointer-events:none\}/, 'клік по відео йде до плитки');

  // вікно однакове для будь-якої публікації: стала сцена + сталий підвал
  assert.match(g.body, /\.lbox\{--stage:62vh;--foot:72px/, 'сталі розміри вікна');
  assert.match(g.body, /height:calc\(var\(--stage\) \+ var\(--foot\)\)/, 'висота не залежить від медіа');
  assert.match(g.body, /\.lbm img,\.lbm video\{max-width:100%;max-height:100%/, 'медіа вписується в сцену');

  // індекс відкритої публікації не має зватися cur — у слухачі вже є така змінна
  assert.ok(g.body.includes('var viewIdx=-1'), 'своє імʼя для індексу');
  assert.ok(!/open\(cur[+-]1\)/.test(g.body), 'гортання не спирається на перекриту cur');
}
ok('публікація відкривається у великому вікні з гортанням');

// 10. решта сторінок
const top = await req('/top');
assert.equal(top.status, 200);
const prof = await req(`/u/${U}`);
assert.ok(prof.body.includes('РЕЙТИНГ'));
const rules = await req('/rules');
assert.ok(rules.body.includes('Будьте ввічливі'));
const css = await req('/custom.css');
assert.ok(css.type.includes('text/css'));
const nf = await req('/no-such');
assert.equal(nf.status, 404);
ok('рейтинг, профіль, сторінка з БД, CSS, 404');

// 11. XSS
const { esc } = await import('../src/web/render.js');
assert.equal(esc('<script>x</script>'), '&lt;script&gt;x&lt;/script&gt;');
ok('екранування HTML (XSS)');

// ── адмінська сесія (власник бота) ──
const { OWNER_ID } = await import('../src/config/constants.js');
const ASID = `test-admin-${Date.now()}`;
await sessionsRepo.create({ token: ASID, guildId: G, userId: OWNER_ID, username: 'Власник', avatar: null, ttlMs: 600_000 });
const adm = { headers: { cookie: `sid=${ASID}` } };
const jreq = (path, opts = {}, body) => req(path, {
  method: 'POST',
  ...opts,
  headers: { ...(opts.headers ?? {}), 'content-type': 'application/json' },
  body: JSON.stringify(body ?? {}),
});

// 12. редагування підпису
const itemId = items[0].id;
const edited = await jreq(`/api/item/${itemId}/title`, adm, { title: 'Новий підпис' });
assert.equal(edited.status, 200);
assert.equal(JSON.parse(edited.body).title, 'Новий підпис');
const stranger = await jreq(`/api/item/${itemId}/title`, {}, { title: 'зламано' });
assert.equal(stranger.status, 401, 'без входу редагувати не можна');
ok('адміністратор редагує підпис публікації');

// 13. видалення — тільки адміністратор
const denied = await req(`/api/item/${itemId}/delete`, { method: 'POST', ...auth });
assert.equal(denied.status, 403, 'звичайний учасник не видаляє');
ok('видалення закрите для звичайного учасника');

// 14. кінотеатр: дивитись можна всім, керувати — лише з голосового каналу
await configService.set(G, 'cinema.voiceChannelId', 'vc-1');
const gate = await req('/cinema', auth);
assert.ok(gate.body.includes('Кінозал'), 'підказка про голосовий канал');
assert.ok(gate.body.includes('cin-gate'), 'спливаюче вікно про замкнене керування');
assert.ok(/id="cin-toggle"[^>]*disabled/.test(gate.body), 'кнопка паузи замкнена');

const locked = JSON.parse((await req('/api/cinema/state', auth)).body);
assert.equal(locked.allowed, true, 'перегляд відкритий усім');
assert.equal(locked.canControl, false, 'керування замкнене поза каналом');
const denyPlay = await jreq('/api/cinema/play', auth);
assert.equal(denyPlay.status, 403, 'пуск поза каналом відхилено');

// адміністратор керує залом і поза каналом — інакше не запустити сеанс,
// поки всі ще збираються
const admOut = JSON.parse((await req('/api/cinema/state', adm)).body);
assert.equal(admOut.canControl, true, 'адміністратор керує без входу в канал');

voiceMembers.set(U, { id: U, displayName: 'Тестовий', user: { displayAvatarURL: () => '/a.png' } });
const st1 = JSON.parse((await req('/api/cinema/state', auth)).body);
assert.equal(st1.canControl, true, 'у каналі — керування є');
assert.equal(st1.viewers.length, 1, 'глядач у списку');
ok('перегляд для всіх, керування — лише з голосового каналу');

// 15. керування: пауза всім у залі, перемотка — лише адміну
// адміністратор теж має бути в каналі — керування прив'язане до залу, а не до прав
voiceMembers.set(OWNER_ID, { id: OWNER_ID, displayName: 'Власник', user: { displayAvatarURL: () => '/a.png' } });
const src = await jreq('/api/cinema/source', adm, { source: '/media/' + itemId, title: 'Фільм' });
assert.equal(src.status, 200);
assert.equal(JSON.parse(src.body).source, `/media/${itemId}`);
const played = await jreq('/api/cinema/play', auth);
assert.equal(JSON.parse(played.body).playing, true, 'учасник може запустити');
const seekDenied = await jreq('/api/cinema/seek', auth, { positionMs: 60_000 });
assert.equal(seekDenied.status, 403, 'учасник не перемотує');
const seekOk = await jreq('/api/cinema/seek', adm, { positionMs: 60_000 });
assert.ok(JSON.parse(seekOk.body).positionMs >= 60_000, 'адмін перемотав');
const page = await req('/cinema', auth);
assert.ok(page.body.includes('id="cin-stage"') && page.body.includes(`/media/${itemId}`), 'плеєр на сторінці');
ok('пуск/пауза — усім у залі, перемотка — лише адміністратору');

// 16. підхоплення чужих плеєрів
{
  const { resolveSource, extractFromHtml } = await import('../src/web/providers.js');
  const yt = await resolveSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.deepEqual(yt, { provider: 'youtube', src: 'dQw4w9WgXcQ', sync: 'full' });
  assert.equal((await resolveSource('https://vimeo.com/76979871')).provider, 'vimeo');
  assert.equal((await resolveSource('https://www.twitch.tv/videos/99')).sync, 'cue');
  assert.equal((await resolveSource('https://cdn.x/a.m3u8')).provider, 'hls');
  assert.equal(await resolveSource('ftp://x/y'), null, 'чужий протокол відкинуто');
  assert.equal(await resolveSource('http://127.0.0.1/x.mp4'), null, 'локальна адреса відкинута');

  // сторінка з плеєром: беремо метатег
  const scraped = extractFromHtml('<meta property="og:video" content="https://cdn.x/v.mp4">', 'https://site/p');
  assert.equal(scraped.src, 'https://cdn.x/v.mp4');

  // через API: YouTube зберігається як провайдер із повною синхронізацією
  const setYt = await jreq('/api/cinema/source', adm, { source: 'https://youtu.be/AbCdEfGhIjK', title: 'Кліп' });
  const stYt = JSON.parse(setYt.body);
  assert.equal(stYt.provider, 'youtube');
  assert.equal(stYt.source, 'AbCdEfGhIjK');
  assert.equal(stYt.syncMode, 'full');

  const bad = await jreq('/api/cinema/source', adm, { source: 'не посилання' });
  assert.equal(bad.status, 400, 'сміття відхилено');

  const cinPage = await req('/cinema', auth);
  assert.ok(cinPage.body.includes('cin-stage'), 'сцена плеєра');
  assert.ok(cinPage.body.includes('YouTube'), 'позначка провайдера');
  assert.ok(cinPage.body.includes('CinemaPlayer'), 'адаптери підключено');

  // якості з плейлиста доїжджають до сторінки
  const { extractPlayerjs } = await import('../src/web/providers.js');
  const multi = extractPlayerjs(
    '<script>new Playerjs({file:"[480p]https://c/480.mp4,[1080p]https://c/1080.mp4"})</script>',
    new URL('https://site/w'),
  );
  assert.equal(multi.qualities.length, 2, 'дві якості');
  assert.equal(multi.qualities[0].label, '1080p', 'найвища перша');

  // гучність і вибір якості в панелі
  assert.ok(cinPage.body.includes('id="cin-volrange"'), 'регулятор гучності');
  assert.ok(cinPage.body.includes('id="cin-qual"'), 'вибір якості');

  // прев'ю посилань: без тегів Discord показує голий текст
  const home = await req('/');
  assert.ok(home.body.includes('property="og:title"'), 'og:title на головній');
  assert.ok(home.body.includes('property="og:image"') || !process.env.WEB_PUBLIC_URL, 'og:image');
  const prof = await req(`/u/${U}`);
  assert.ok(prof.body.includes('property="og:title"'), 'og:title у профілі');
  assert.ok(prof.body.includes('Рейтинг'), 'опис із рейтингом');
  assert.ok(prof.body.includes('twitter:card'), 'теги для інших месенджерів');

  // картка профілю для прев'ю малюється тим самим рендером, що й у Discord
  const ogImg = await req(`/og/u/${U}`);
  assert.equal(ogImg.status, 200, 'картинка прев\'ю віддається');
  assert.ok(ogImg.type.includes('image/png'), 'PNG');

  // маніфест — сайт можна поставити як застосунок
  const man = await req('/manifest.webmanifest');
  assert.equal(man.status, 200);
  assert.ok(JSON.parse(man.body).start_url === '/', 'маніфест валідний');

  // іконка вкладки
  const fav = await req('/favicon.svg');
  assert.equal(fav.status, 200);
  assert.ok(fav.type.includes('image/svg+xml'), 'SVG-іконка');
  assert.ok(fav.body.includes('<svg'), 'вміст іконки');
  assert.equal((await req('/favicon.ico')).status, 200, 'старі браузери теж отримають іконку');
  assert.ok(cinPage.body.includes('rel="icon"'), 'іконка підключена на сторінці');

  // повний екран: панель ховається в спокої, але її можна повернути
  assert.ok(cinPage.body.includes('id="cin-wake"'), 'смуга повернення панелі');
  assert.ok(cinPage.body.includes('idlebar'), 'логіка автоприховування');
  assert.ok(cinPage.body.includes('id="cin-full"'), 'кнопка повного екрана');
  assert.ok(!/id="cin-full"[^>]*disabled/.test(cinPage.body), 'із джерелом кнопка активна');
  assert.ok(cinPage.body.includes('requestFullscreen'), 'логіка повного екрана');
  assert.ok(cinPage.body.includes(':fullscreen'), 'стилі повного екрана');

  await jreq('/api/cinema/stop', adm);
  const empty = await req('/cinema', auth);
  assert.ok(/id="cin-full"[^>]*disabled/.test(empty.body), 'без джерела кнопка вимкнена');
}
ok('кінотеатр підхоплює YouTube / Vimeo / Twitch / HLS / сторінки з плеєром');

// 17. черга, права, блокування, журнал
{
  // чергу поповнює будь-хто з залу
  const q1 = await jreq('/api/cinema/queue', auth, { source: 'https://youtu.be/QQQwwwEEE11', title: 'Наступне' });
  assert.equal(q1.status, 200);
  const st = JSON.parse(q1.body);
  assert.equal(st.queue.length, 1, 'відео стало в чергу');
  assert.equal(st.queue[0].provider, 'youtube');
  assert.equal(st.queue[0].addedName, 'Тестовий', 'видно, хто додав');

  // перемикання на наступне — лише тим, хто керує сеансом
  const denyNext = await jreq('/api/cinema/next', auth);
  assert.equal(denyNext.status, 403, 'звичайний учасник не перемикає');
  const next = JSON.parse((await jreq('/api/cinema/next', adm)).body);
  assert.equal(next.source, 'QQQwwwEEE11', 'увімкнулось наступне з черги');
  assert.equal(next.queue.length, 0, 'черга спорожніла');

  // видача прав на керування сеансом
  const granted = JSON.parse((await jreq('/api/cinema/grant', adm, { userId: U })).body);
  assert.ok(granted.ok, 'права видано');
  const asEditor = JSON.parse((await jreq('/api/cinema/seek', auth, { positionMs: 5000 })).body);
  assert.ok(asEditor.positionMs >= 5000, 'з правами перемотка дозволена');
  await jreq('/api/cinema/revoke', adm, { userId: U });
  assert.equal((await jreq('/api/cinema/seek', auth, { positionMs: 1000 })).status, 403, 'права забрано');

  // тимчасове закриття залу
  await jreq('/api/cinema/lock', adm, { minutes: 15 });
  const closed = JSON.parse((await req('/api/cinema/state', auth)).body);
  assert.equal(closed.allowed, false, 'для учасника зал зачинено');
  assert.ok(closed.lockedUntil > Date.now(), 'час закриття збережено');
  assert.equal((await jreq('/api/cinema/play', auth)).status, 403, 'керування теж закрите');
  const adminSees = JSON.parse((await req('/api/cinema/state', adm)).body);
  assert.equal(adminSees.allowed, true, 'адміністратор бачить зал');
  await jreq('/api/cinema/lock', adm, { minutes: 0 });
  assert.equal(JSON.parse((await req('/api/cinema/state', auth)).body).allowed, true, 'зал відкрито');

  // журнал бачить лише адміністратор
  const hist = JSON.parse((await req('/api/cinema/state', adm)).body).history;
  assert.ok(hist.length >= 5, 'дії записані в журнал');
  assert.ok(hist.some((h) => h.action === 'queue.add'), 'додавання в чергу в журналі');
  assert.ok(hist.some((h) => h.action === 'lock'), 'закриття залу в журналі');
  assert.equal(JSON.parse((await req('/api/cinema/state', auth)).body).history.length, 0, 'учасник журналу не бачить');
}
ok('черга, права на сеанс, тимчасове закриття залу, журнал дій');

// 17.5 галерея з Discord-каналу
{
  const { galleryChannelId, publishFrom, removeByMessage } = await import('../src/services/galleryWatcher.js');

  // без каналу — на сайті звичайна форма завантаження
  assert.equal(galleryChannelId(G), '', 'канал ще не задано');
  assert.ok((await req('/gallery', auth)).body.includes('form class="up"'), 'форма на місці');

  // канал заданий: бот сам кладе туди файли, тож перехоплюємо надсилання
  const sent = [];
  await configService.set(G, 'gallery.channelId', 'chan-1');
  guild.channels.cache.set('chan-1', {
    id: 'chan-1',
    name: 'галерея',
    isTextBased: () => true,
    send: async (payload) => {
      sent.push(payload);
      const ex2 = (Math.floor(Date.now() / 1000) + 86400).toString(16);
      return {
        id: `sent-${sent.length}`,
        attachments: new Map([['a', {
          url: `https://cdn.discordapp.com/attachments/1/2/from-site.png?ex=${ex2}&is=x&hm=y`,
        }]]),
      };
    },
  });

  const page = await req('/gallery', auth);
  assert.ok(page.body.includes('form class="up"'), 'форма на сайті лишається');
  // пояснення про канал прибрано: людина й так бачить результат
  assert.ok(!page.body.includes('Медіа зберігається в цьому каналі'), 'опису про канал більше немає');
  assert.ok(!page.body.includes('class="fromch"'), 'і його блока теж');

  // завантаження з сайту має піти в канал, а не в базу
  const up2 = await req('/upload', {
    method: 'POST',
    headers: { ...auth.headers, 'content-type': `multipart/form-data; boundary=${BND}` },
    body: parts,
  });
  assert.equal(up2.status, 302);
  assert.ok(!String(up2.loc).includes('e='), 'без помилки');
  assert.equal(sent.length, 1, 'бот надіслав файл у канал');
  assert.ok(sent[0].files?.length, 'файл прикріплено');
  assert.ok(sent[0].content.includes('Тестовий'), 'видно, хто завантажив');

  const [viaSite] = await galleryRepo.list(G, { limit: 1 });
  assert.equal(viaSite.storage, 'discord', 'у базі лише посилання на канал');
  assert.equal(viaSite.object_key, 'chan-1/sent-1', 'звʼязок із повідомленням у каналі');
  await galleryRepo.remove(Number(viaSite.id));

  // публікація з повідомлення: файл лишається в Discord, у базі — посилання
  const ex = (Math.floor(Date.now() / 1000) + 86400).toString(16);
  const msg = {
    id: 'msg-1',
    channelId: 'chan-1',
    guild: { id: G },
    content: 'Мій кадр',
    member: { displayName: 'Тестовий' },
    attachments: new Map([['a1', {
      contentType: 'image/png', size: 4242,
      url: `https://cdn.discordapp.com/attachments/1/2/a.png?ex=${ex}&is=x&hm=y`,
    }]]),
  };
  const n = await publishFrom(msg, { id: U, username: 'Тестовий', avatar: AVATAR });
  assert.equal(n, 1, 'опубліковано один файл');

  const [fresh] = await galleryRepo.list(G, { limit: 1 });
  assert.equal(fresh.storage, 'discord', 'зберігається як посилання на канал');
  assert.equal(fresh.object_key, 'chan-1/msg-1', 'звʼязок із повідомленням');
  assert.equal(fresh.title, 'Мій кадр', 'підпис із тексту повідомлення');
  assert.ok(Number(fresh.url_expires) > Date.now(), 'час протухання посилання збережено');

  // повідомлення видалили в Discord — публікація зникає й із сайту
  await removeByMessage(msg);
  const left = (await galleryRepo.list(G, { limit: 200 })).filter((i) => i.object_key === 'chan-1/msg-1');
  assert.equal(left.length, 0, 'публікацію прибрано');

  await configService.set(G, 'gallery.channelId', '');
}
ok('галерея з Discord-каналу: публікація, звʼязок із повідомленням, видалення');

// 17.7 панель модерації на сайті
{
  // звичайний учасник: ні кнопки, ні сторінки, ні дій
  const asMember = await req('/gallery', auth);
  assert.ok(!asMember.body.includes('href="/mod"'), 'кнопки модерації немає');

  const page = await req('/mod', auth);
  assert.equal(page.status, 403, 'прямим посиланням не зайти');
  assert.ok(page.body.includes('лише для модераторів'), 'зрозуміла відмова');

  const denied = await jreq('/api/mod/apply', auth, { userId: OWNER_ID, kind: 'text', minutes: 10 });
  assert.equal(denied.status, 403, 'дії теж закриті');

  // на головній кнопки теж немає без прав
  // (шукаємо саме посилання, бо клас modbtn є ще й у стилях на кожній сторінці)
  // (шукаємо саме посилання, бо клас modchip є ще й у стилях на кожній сторінці)
  const LINK = 'class="me modchip" href="/mod"';
  const memberHome = await req('/', auth);
  const adminHome = await req('/', adm);
  assert.ok(!memberHome.body.includes(LINK), 'на головній кнопки немає');
  assert.ok(adminHome.body.includes(LINK), 'адміністратор бачить її на головній');
  // саме поруч із чипом профілю, а не серед головних кнопок
  assert.ok(adminHome.body.indexOf(LINK) < adminHome.body.indexOf('class="cta"'), 'кнопка в шапці, біля профілю');
  assert.ok(!adminHome.body.includes('gbtn modbtn'), 'серед головних кнопок її немає');

  // адміністратор: кнопка є, сторінка відкривається
  const asAdmin = await req('/gallery', adm);
  assert.ok(asAdmin.body.includes('href="/mod"'), 'кнопка модерації для адміністратора');
  assert.ok(asAdmin.body.includes('apart'), 'кнопка стоїть окремо від основних');

  const modPage = await req('/mod', adm);
  assert.equal(modPage.status, 200);
  assert.ok(modPage.body.includes('mod-apply'), 'форма покарання');

  // учасник обирається зі списку з пошуком, а не вписуванням ID
  assert.ok(modPage.body.includes('pick-search'), 'пошук учасників');
  assert.ok(!modPage.body.includes('<select'), 'жодних нативних select — усі меню свої');
  assert.ok(modPage.body.includes('drop-menu'), 'спадне меню в стилі сайту');
  assert.ok(modPage.body.includes('mod-custom') && modPage.body.includes('mod-num'),
    'можна вписати свій термін');
  assert.ok(modPage.body.includes('aria-pressed') || modPage.body.includes('kindbtn'),
    'вид покарання видно як обраний');

  // сам розбір терміну й застосування перевіряються в moderationTest,
  // де є повноцінний мок учасника; тут — що поле є в розмітці

  // список учасників закритий для сторонніх
  assert.equal((await req('/api/members', auth)).status, 403, 'список учасників лише модераторам');
  const members = JSON.parse((await req('/api/members', adm)).body);
  assert.ok(Array.isArray(members.members), 'список повертається');

  // не можна карати того, хто рівний або вищий за правами
  const self = await jreq('/api/mod/apply', adm, { userId: OWNER_ID, kind: 'text', minutes: 10 });
  assert.equal(self.status, 400, 'себе — ні');

  // поле свого терміну не має світитися разом зі списком —
  // клас .row робив display:flex поверх атрибута hidden
  assert.match(modPage.body, /class="row custom-dur" id="mod-custom" hidden/, 'ручне поле сховане');
  assert.match(modPage.body, /\[hidden\]\{display:none!important\}/, 'hidden перемагає display із класу');
  assert.match(modPage.body, /\.up input\[type=number\]/, 'поле числа має стиль сайту');

  // кнопки видів покарання стоять сіткою — при виборі нічого не стрибає
  assert.match(modPage.body, /class="kindrow"/, 'кнопки в сітці');
  assert.match(modPage.body, /\.kindrow\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(170px/,
    'комірка не вужча за напис «голосовий мут»');
  assert.match(modPage.body, /\.up \.kindbtn \.kl\{white-space:normal/, 'напис переходить на другий рядок');
  assert.ok(!/\.up \.kindbtn \.kl\{[^}]*text-overflow:ellipsis/.test(modPage.body),
    'назву покарання не обрізаємо');
  assert.match(modPage.body, /\.pick-el::after\{content:'✓';font-size:12px;opacity:0/,
    'місце під «✓» зарезервоване завжди');
  assert.ok(modPage.body.includes('pick-el kindbtn'), 'кнопки користуються спільним стилем вибору');

  // спадне меню не має ховатися під сусідньою карткою (журнал)
  assert.match(modPage.body, /\.card:has\(\.drop\[open\]\)/, 'картка з відкритим меню підіймається');
}
ok('панель модерації на сайті: кнопка й сторінка лише для модераторів');

// 17.75 смуга навігації однакова на всіх сторінках
{
  const bars = [];
  for (const p of ['/gallery', '/top', '/mod', '/me', '/cinema']) {
    const r = await req(p, adm);
    const m = r.body.match(/<div class="topbar-in([^"]*)"/);
    bars.push(m ? m[1] : `(немає на ${p})`);
  }
  assert.equal(new Set(bars).size, 1, `смуга скрізь однакова, отримали: ${bars.join(' | ')}`);
  assert.equal(bars[0].trim(), '', 'без окремої широкої версії — вміст завжди тієї самої ширини');

  const g = await req('/gallery', adm);
  assert.ok(!/\.topbar-in\.wide/.test(g.body), 'широкого варіанта смуги більше немає');

  // службова кнопка модерації світиться червоним, а не синім
  assert.match(g.body, /nav a\.apart\.active\{background:linear-gradient\(180deg,#ef6b68,#d63c39\)/,
    'активна модерація — червона');

  // чип профілю світиться, коли ми саме на профілі
  const mePage = await req('/me', adm);
  assert.ok(/<div class="me active"/.test(mePage.body), 'на профілі чип активний');
  assert.ok(!/<div class="me active"/.test(g.body), 'на інших сторінках — ні');

  // головні дії — той самий стиль, що й «обрано»
  assert.match(g.body, /\.btn\{[^}]*linear-gradient\(180deg,var\(--accent-hi\),var\(--accent-lo\)\)/,
    '«Опублікувати» / «Застосувати» у спільному стилі');
  const home = await req('/', adm);
  assert.ok(home.body.includes('class="dbtn site"'), 'кнопка «Рейтинг» у стилі сайту');

  // вибраний вид покарання не має губити стиль через .btn.ghost
  assert.match(g.body, /\.pick-el\.on,\.btn\.ghost\.pick-el\.on/, 'вибране перемагає часткові стилі');
}
ok('шапка однакова скрізь; модерація червона, профіль і «Рейтинг» — у стилі');

// 17.8 журнал із системними записами — сторінка не має падати в 500
{
  const { warnRepo: wr } = await import('../src/database/repositories.js');
  await wr.add(G, U, { reason: 'тест', moderatorId: 'system' });
  const { modRepo: mr } = await import('../src/database/repositories.js');
  await mr.add({ guildId: G, userId: U, moderatorId: 'system', action: 'warn', reason: 'тест', result: 'applied' });

  const page = await req('/mod', adm);
  assert.equal(page.status, 200, 'сторінка з системними записами відкривається');
  assert.ok(page.body.includes('embed/avatars/'), 'для «system» підставлено типову аватарку');

  await wr.clear(G, U);
}
ok('журнал із записами від системи не ламає сторінку');

// 18. порядок черги, автоперехід і список редакторів
{
  await jreq('/api/cinema/queue', auth, { source: 'https://youtu.be/AAAaaaBBB11', title: 'Перше' });
  await jreq('/api/cinema/queue', auth, { source: 'https://youtu.be/CCCcccDDD22', title: 'Друге' });
  let q = JSON.parse((await req('/api/cinema/state', adm)).body).queue;
  assert.equal(q.length, 2);
  assert.equal(q[0].title, 'Перше', 'порядок додавання');

  // переставляння
  const moved = JSON.parse((await jreq('/api/cinema/queueMove', adm, { id: q[1].id, dir: -1 })).body);
  assert.equal(moved.queue[0].title, 'Друге', 'запис піднявся');
  assert.equal((await jreq('/api/cinema/queueMove', auth, { id: q[0].id, dir: -1 })).status, 403,
    'переставляти може лише той, хто керує сеансом');

  // автоперехід: перший виклик перемикає, повторний зі старим current — ні
  const cur = JSON.parse((await req('/api/cinema/state', adm)).body).source;
  const first = JSON.parse((await jreq('/api/cinema/next', adm, { current: cur })).body);
  assert.equal(first.source, 'CCCcccDDD22', 'увімкнулось перше з черги');
  assert.equal(first.playing, true, 'перехід у черзі не зупиняє сеанс');
  // позиція рахується «наживо», тож звіряємо з допуском, а не з нулем
  assert.ok(first.positionMs < 2000, `нове відео з початку (${first.positionMs} мс)`);
  const again = JSON.parse((await jreq('/api/cinema/next', adm, { current: cur })).body);
  assert.equal(again.source, 'CCCcccDDD22', 'повторний виклик нічого не перескочив');
  assert.equal(again.queue.length, 1, 'у черзі лишився один запис');

  // черга скінчилась — сеанс завершується, а не висить чорним екраном
  const cinPageEnd = await req('/cinema', adm);
  assert.ok(cinPageEnd.body.includes("post('stop')"), 'кінець без черги завершує сеанс');
  await jreq('/api/cinema/stop', adm);
  const stopped = JSON.parse((await req('/api/cinema/state', adm)).body);
  assert.equal(stopped.source, null, 'сеанс завершено');

  // список тих, кому видані права — навіть якщо їх немає в каналі
  await jreq('/api/cinema/grant', adm, { userId: '999888777666555444' });
  const st = JSON.parse((await req('/api/cinema/state', adm)).body);
  assert.ok(st.editorList.some((e) => e.id === '999888777666555444'), 'редактор у списку');
  await jreq('/api/cinema/revoke', adm, { userId: '999888777666555444' });

  // кнопки на сторінці
  const page = await req('/cinema', adm);
  assert.ok(page.body.includes('id="cin-next"'), 'кнопка «Далі»');
  assert.ok(page.body.includes('qup') && page.body.includes('qdown'), 'стрілки порядку черги');
  assert.ok(page.body.includes('onEnded'), 'автоперехід після завершення');
}
ok('порядок черги, автоперехід, кнопка «Далі», список редакторів');

// 19. озвучки та керована жорстка пауза
{
  // режим зупинки некерованого плеєра можна вимкнути, якщо сайт її не переживає
  const st0 = JSON.parse((await req('/api/cinema/state', adm)).body);
  assert.equal(st0.hardPause, true, 'типово увімкнена');
  const off = JSON.parse((await jreq('/api/cinema/hardPause', adm, { on: false })).body);
  assert.equal(off.hardPause, false, 'вимикається');
  assert.equal((await jreq('/api/cinema/hardPause', auth, { on: true })).status, 403,
    'перемикає лише той, хто керує сеансом');
  await jreq('/api/cinema/hardPause', adm, { on: true });

  // озвучки доїжджають зі стану в розмітку
  const { cinemaPage } = await import('../src/web/render.js');
  const page = cinemaPage({
    state: {
      channel: { id: 'vc-1', name: 'Кінозал' }, viewers: [], admin: true, canControl: true,
      canEdit: true, allowed: true, lockedUntil: 0, source: 'https://c/d1080.mp4',
      provider: 'file', syncMode: 'full', hardPause: true, queue: [], history: [],
      qualities: [{ label: '1080p', url: 'https://c/d1080.mp4' }, { label: '480p', url: 'https://c/d480.mp4' }],
      variants: [
        { label: 'Дубляж', src: 'https://c/d1080.mp4', qualities: [{ label: '1080p', url: 'https://c/d1080.mp4' }] },
        { label: 'Оригінал', src: 'https://c/o720.mp4', qualities: [{ label: '720p', url: 'https://c/o720.mp4' }] },
      ],
    },
    session: { user_id: OWNER_ID },
    lang: 'uk',
  });
  // ── чи вмикається проксі саме тоді, коли треба ──
  // Підіймаємо фальшивий CDN: один потік відкритий для всіх, другий —
  // лише для свого сайту (саме так поводяться справжні балансери).
  // два різних «CDN»: рішення кешується по хосту, тож і портів має бути два
  const http = await import('node:http');
  const mkCdn = async (allow) => {
    const s = http.createServer((rq, rs) => {
      rs.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': allow,
      });
      rs.end('#EXTM3U\n');
    });
    await new Promise((r) => s.listen(0, '127.0.0.1', r));
    return { s, base: `http://127.0.0.1:${s.address().port}` };
  };
  const openCdn = await mkCdn('*');
  const closedCdn = await mkCdn('https://foreign.site');

  const { corsWouldBlock } = await import('../src/web/server.js');
  const OUR = 'https://moments.example';
  assert.equal(await corsWouldBlock(`${openCdn.base}/a.m3u8`, OUR), false, 'відкритий потік грає напряму');
  assert.equal(await corsWouldBlock(`${closedCdn.base}/a.m3u8`, OUR), true, 'чужий сайт у ACAO — треба проксі');
  openCdn.s.close();
  closedCdn.s.close();
  // недосяжний хост — теж через проксі, щоб не лишити глядачів із чорним екраном
  assert.equal(await corsWouldBlock('https://nowhere.invalid/a.m3u8', OUR), true);

  // ручний Referer вмикає проксі незалежно від CORS
  const withRef = JSON.parse((await jreq('/api/cinema/source', adm, {
    source: 'https://cdn.example/hls/master.m3u8', referer: 'https://site.example/watch', title: 'З Referer',
  })).body);
  assert.ok(withRef.source.startsWith('/stream?'), 'потік загорнуто в проксі');
  assert.ok(withRef.source.includes('h='), 'заголовки передані');

  // право ставити на паузу — окремо для кожного глядача
  const denied = JSON.parse((await jreq('/api/cinema/denyControl', adm, { userId: U })).body);
  assert.ok(denied.blocked.includes(U), 'право забрано');
  const asBlocked = JSON.parse((await req('/api/cinema/state', auth)).body);
  assert.equal(asBlocked.canControl, false, 'учасник більше не керує');
  assert.equal((await jreq('/api/cinema/play', auth)).status, 403, 'пуск відхилено');
  await jreq('/api/cinema/allowControl', adm, { userId: U });
  assert.equal(JSON.parse((await req('/api/cinema/state', auth)).body).canControl, true, 'право повернуто');
  assert.equal((await jreq('/api/cinema/denyControl', auth, { userId: OWNER_ID })).status, 403,
    'керує правами лише адміністратор');

  assert.ok(page.includes('id="cin-voice"'), 'меню озвучок');
  assert.ok(page.includes('Дубляж') && page.includes('Оригінал'), 'обидві озвучки в меню');
  assert.ok(!/id="cin-voice"[^>]*hidden/.test(page), 'меню видиме, бо озвучок дві');
  assert.ok(page.includes('cin-curtain'), 'завіса на паузі');
}
ok('вибір озвучки, завіса на паузі, перемикач жорсткої паузи');

// 19.1 кінотеатр: єдиний стиль керування, без поля Referer
{
  const c = await req('/cinema', adm);
  assert.ok(!c.body.includes('cin-ref'), 'поля Referer більше немає');
  assert.ok(!/setReferer/.test(c.body), 'і підказки про нього теж');
  // вибір якості й озвучки виглядають однаково і мають позначку «обрано»
  assert.match(c.body, /\.qopt,\.vopt,\.sopt\{padding/, 'озвучка стилізована так само, як якість');
  assert.match(c.body, /\.qopt\.on::after,\.vopt\.on::after/, 'позначка «✓» в обох списках');
  assert.match(c.body, /\.pick-el\.on,[^{]*\.btn\.icon\.on/, 'перемикачі панелі у спільному стилі');
  // смуга часу товщає під курсором, але висота елемента стала
  assert.match(c.body, /\.seek\{position:relative;flex:1;min-width:180px;height:22px/, 'стала висота смуги');
  assert.match(c.body, /\.seek\[data-admin="1"\]:hover::before,\.seek\[data-admin="1"\]:hover i\{height:8px/,
    'під курсором смугу легше зачепити');
}
ok('кінотеатр: один стиль керування, без ручного Referer');

// 19.2 автоматична якість у HLS
{
  const c = await req('/cinema', adm);
  // без цього hls.js тримає низьку картинку в невеликому вікні
  assert.match(c.body, /capLevelToPlayerSize:false/, 'якість не обмежується розміром плеєра');
  assert.match(c.body, /startLevel:-1/, 'старт із автовибору');
  assert.match(c.body, /abrEwmaDefaultEstimate:2500000/, 'перші секунди не в найгіршій якості');
  assert.match(c.body, /abrBandWidthUpFactor:0\.9/, 'рівень підвищується сміливіше');
  // «Авто» стає першим пунктом меню й повертає рівень −1
  assert.match(c.body, /levels\.unshift\(\{label:cfg\.autoText\|\|'Авто',index:-1,auto:true\}\)/,
    '«Авто» додається в меню якості');
  assert.match(c.body, /setLevel:function\(i\)\{if\(hls\)hls\.currentLevel=Number\(i\)\}/,
    '−1 повертає автовибір');
  // поруч зі словом «Авто» видно, на чому плеєр зупинився
  assert.match(c.body, /LEVEL_SWITCHED/, 'слухаємо перемикання рівня');
  assert.ok(c.body.includes('data-auto-text="Авто"'), 'підпис «Авто» приходить з перекладу');
}
ok('HLS: автоматичне підвищення якості з показом поточного рівня');

// 19.3 зал: службове — у шухляді, на сторінці лишається екран
{
  const c = await req('/cinema', adm);
  assert.ok(c.body.includes('id="cin-drawer"'), 'шухляда налаштувань є');
  assert.ok(c.body.includes('id="cin-settings"'), 'кнопка ⚙ у шапці залу');

  // джерело, зал, права й історія переїхали в шухляду
  const drawer = c.body.slice(c.body.indexOf('id="cin-drawer"'), c.body.indexOf('id="cin-gate"') + 1 || undefined);
  for (const id of ['cin-src', 'cin-load', 'data-lock', 'cin-log']) {
    assert.ok(drawer.includes(id), `${id} — усередині шухляди`);
  }
  // а на самій сторінці лишились черга й глядачі
  const page = c.body.slice(c.body.indexOf('class="cpanels"'), c.body.indexOf('id="cin-drawer"'));
  assert.ok(page.includes('cin-queue-list'), 'черга лишилась на сторінці');
  assert.ok(page.includes('cin-viewers'), 'зал теж');
  assert.ok(!page.includes('cin-src'), 'поля джерела на сторінці немає');

  // атмосфера: сяйво сцени й притлумлення панелей під час показу
  assert.match(c.body, /\.room\.live \.stagewrap::before\{opacity:1/, 'сцена світиться під час показу');
  assert.match(c.body, /\.room\.live \.screen\{box-shadow:[^}]*90px/, 'екран світить сильніше');
  assert.match(c.body, /\.cpanels\.dim\{opacity:\.5\}/, 'решта тьмяніє');
  assert.match(c.body, /@keyframes glowBreath/, 'світло дихає, а не стоїть');
  assert.ok(c.body.includes("room.classList.toggle('live'"), 'клас вішає сама синхронізація');
}
ok('кінотеатр: налаштування в шухляді, атмосфера залу під час показу');

// 19.4 субтитри: доріжки з потоку й окремі файли
{
  const c = await req('/cinema', adm);
  assert.ok(c.body.includes('id="cin-subs"'), 'кнопка субтитрів у панелі');
  assert.ok(c.body.includes('data-subs-off="Вимкнено"'), 'підпис «Вимкнено» з перекладу');

  // доріжки з маніфесту
  assert.match(c.body, /hls\.subtitleTracks\|\|\[\]/, 'субтитри з потоку зчитуються');
  assert.match(c.body, /hls\.subtitleDisplay=n>=0/, 'вимкнення ховає доріжку');
  // окремі файли .vtt чіпляються як рідні доріжки
  assert.match(c.body, /tr\.kind='subtitles'/, 'зовнішні файли стають доріжками');
  assert.match(c.body, /v\.textTracks\[ti\]\.mode='disabled'/, 'браузер не вмикає їх самовільно');
  // «Вимкнено» завжди перший пункт
  assert.match(c.body, /off\.dataset\.sub='-1'/, '«Вимкнено» — окремий пункт');
  // вигляд той самий, що й у якості з озвучкою
  assert.match(c.body, /\.qopt,\.vopt,\.sopt\{padding/, 'спільний стиль трьох списків');
  assert.match(c.body, /\.sopt\.on::after/, 'позначка «обрано» є й тут');
}
ok('субтитри: вибір доріжки та вимкнення');

// 19.5 живе світло від кадру
{
  const c = await req('/cinema', adm);
  assert.ok(c.body.includes('id="cin-ambient"'), 'полотно світла є');
  assert.match(c.body, /<canvas class="ambient"[^>]*width="32" height="18"/, 'кадр беремо зменшеним');
  assert.match(c.body, /\.ambient\{[^}]*filter:blur\(58px\) saturate\(1\.7\)/, 'кадр розмивається до плям');
  assert.match(c.body, /\.ambient\{[^}]*pointer-events:none/, 'світло не ловить кліки');
  assert.match(c.body, /\.room:fullscreen \.ambient/, 'у повному екрані світло ширше');

  // кадр малюється лише коли є що малювати
  assert.match(c.body, /if\(document\.hidden\|\|video\.paused\|\|video\.readyState<2\)return/,
    'на паузі й у схованій вкладці не тратимо кадри');
  // чужа рамка або потік без CORS — тихий відкат до рівного сяйва
  assert.match(c.body, /wrap\.classList\.add\('noframe'\)/, 'є запасний варіант без кадру');
  assert.match(c.body, /dead=true;clearInterval\(timer\)/, 'після SecurityError більше не пробуємо');
  assert.match(c.body, /prefers-reduced-motion: reduce/, 'системне «менше руху» враховано');

  // у повному екрані сцена займає весь екран, тож світлу нема куди вийти
  // за її межі — робимо саму сцену прозорою, і воно світить крізь чорні поля
  assert.match(c.body, /\.room\.fs \.screen,[^{]*\{background:transparent\}/,
    'у повному екрані сцена прозора');
  assert.match(c.body, /\.room\.fs \.ambient[^{]*\{\s*left:0;right:0;top:0;bottom:0/,
    'світло розтягується на весь екран');
  assert.match(c.body, /\.room\.fs\.live \.ambient\.show,[^{]*\{opacity:\.7\}/, 'і світить помітніше');

  // колір переходить плавно: два полотна змінюють одне одного
  assert.ok(c.body.includes('id="cin-ambient2"'), 'друге полотно для плавності');
  assert.match(c.body, /\.room\.live \.ambient\.show\{opacity:\.62\}/, 'видиме те, що зверху');
  assert.match(c.body, /\.room\.live \.ambient\{transition:opacity 1\.4s/, 'довгий перехід між кадрами');
  assert.ok(c.body.includes('top=!top;'), 'полотна міняються місцями');
  assert.match(c.body, /timer=setInterval\(draw,still\?3000:1500\)/,
    'кадр знімається рідше за перехід — світло не блимає');

  // світло лежить під сценою: інакше верхнє полотно накривало саме відео
  assert.match(c.body, /\.ambient,\.ambient\.next\{z-index:0\}/, 'полотна на нульовому шарі');
  assert.match(c.body, /\.stagewrap>\.screen,\.stagewrap>\.curtain\{position:relative;z-index:2\}/,
    'сцена вище за світло');
}
ok('світло залу підхоплює кольори кадру');

// 20. профіль: тільки загальне число + графік динаміки
{
  const { snapshotRepo } = await import('../src/database/repositories.js');
  const vals = [420, 435, 428, 455, 470, 462, 488];
  for (let i = 0; i < vals.length; i++) {
    const day = new Date(Date.now() - (vals.length - 1 - i) * 86400_000).toISOString().slice(0, 10);
    await snapshotRepo.take(G, U, { ai_score: vals[i] }, day);
  }

  const p = await req('/me', auth);
  assert.equal(p.status, 200);
  assert.ok(!p.body.includes('class="cat"'), 'розкладу по категоріях більше немає');
  assert.match(p.body, /class="score">\s*<b>\d+</, 'загальне число лишилось');

  assert.ok(p.body.includes('class="chart"'), 'графік намальовано');
  // лінія тепер плавна — сегменти йдуть кривими, а не ламаною
  assert.match(p.body, /<path class="chline" d="M[\d.]+ [\d.]+ C/, 'лінія плавна');
  assert.ok(p.body.includes('chgrid'), 'є сітка значень');
  assert.ok(p.body.includes('chlabel'), 'є підписи значень і дат');
  assert.ok(p.body.includes('chpt'), 'точки заміру видно');
  assert.ok(!p.body.includes('preserveAspectRatio="none"'), 'графік не розтягується непропорційно');
  assert.ok(p.body.includes('class="chdot"'), 'остання точка позначена');
  assert.ok(p.body.includes('сьогодні'), 'підказка на останній точці');
  assert.ok(p.body.includes('dchip'), 'зміни за тиждень і місяць');

  // шкала не від нуля, інакше рух на кілька десятків виглядав би прямою:
  // підписи сітки беремо з самого графіка
  const ticks = [...p.body.matchAll(/<text class="chlabel"[^>]*text-anchor="end">(\d+)<\/text>/g)]
    .map((m) => Number(m[1]));
  const lo = Math.min(...ticks);
  const hi = Math.max(...ticks);
  assert.ok(ticks.length >= 3, `сітка має підписи, отримали: ${ticks.join(', ')}`);
  assert.ok(lo > 0 && hi > lo, `межі шкали по даних: ${lo}…${hi}`);
  assert.ok(lo <= Math.min(...vals) && hi >= Math.max(...vals), 'усі точки вміщаються');
}
ok('профіль: загальне число й графік динаміки замість категорій');

// 21. магазин косметики: ✨FP, безкоштовний набір і гейт для бустерів
{
  const shop = await req('/shop', auth);
  assert.equal(shop.status, 200, 'сторінка магазину відкривається');
  assert.ok(shop.body.includes('sh-balance'), 'баланс FP на видноті');

  // Категорії списком ліворуч: шість розділів за призначенням плюс два
  // службові зрізи — «Усе» та «Моє». Окремого звалища «Кастом» більше немає:
  // робота учасника лягає в той самий розділ, що й каталожні речі того ж
  // призначення. Це фільтр, а не якір — показується лише обраний розділ.
  assert.ok(shop.body.includes('class="sh-side"'), 'категорії окремим списком');
  for (const cat of ['Фони', 'Банери', 'Ілюстрації', 'Акцентні кольори', 'Рамки', 'Вікна']) {
    assert.ok(shop.body.includes(`>${cat}<`), `категорія «${cat}» показана`);
  }
  assert.ok(!shop.body.includes('>Кастом<'), 'окремого «Кастому» більше немає');
  assert.equal((shop.body.match(/class="sh-cat/g) ?? []).length, 8, 'шість розділів + «Усе» і «Моє»');
  assert.ok(shop.body.includes('data-cat="all"'), 'зріз «Усе»');
  assert.ok(shop.body.includes('data-cat="mine"'), 'зріз «Моє»');
  assert.ok(!/<a class="sh-cat[^"]*" href="#/.test(shop.body), 'категорія більше не якір, а фільтр');

  // поштучні речі мають власну ціну, а набором лишились тільки безкоштовні кольори
  assert.ok(shop.body.includes('data-id="frame.spin"'), 'рамка продається окремо');
  assert.ok(shop.body.includes('data-id="pack.solid"'), 'безкоштовні кольори — набором');
  assert.ok(!shop.body.includes('data-id="pack.gradient"'), 'градієнти більше не набір');

  // зайвих підписів у гаманці більше немає
  assert.ok(!shop.body.includes('нараховуються щодня'), 'опис про нарахування прибрано');
  assert.ok(!shop.body.includes('Зароблено за весь час'), 'підсумок зароблених прибрано');
  assert.ok(!shop.body.includes('Ви бустите сервер'), 'підпис про буст прибрано');
  assert.ok(!shop.body.includes('Забустіть сервер'), 'і зворотний теж');

  // банер/опис із магазину прибрано — це базова персоналізація
  assert.ok(!shop.body.includes('Банер профілю') && !shop.body.includes('Опис про себе'),
    'банер і опис більше не товар');

  // бустерське видно всім, але замкнене й позначене
  assert.ok(shop.body.includes('sh-card locked'), 'бустерське замкнене');
  assert.ok(shop.body.includes('Лише бустерам'), 'зрозуміло, чому замкнено');
  // позначки стоять чипами в рядку з назвою, а не плитою поверх прев'ю
  assert.ok(shop.body.includes('sh-chip boost'), 'позначка «лише для бустерів» на картці');
  assert.ok(!shop.body.includes('sh-badge'), 'накладених плит більше немає');

  // анонім у магазин не заходить
  assert.equal((await req('/shop')).status, 302, 'без входу — на сторінку входу');

  // безкоштовний набір береться цілком, вдруге — вже свій
  assert.equal((await jreq('/api/shop/buy', auth, { item: 'pack.solid' })).status, 200, 'набір береться');
  assert.equal((await jreq('/api/shop/buy', auth, { item: 'pack.solid' })).status, 400, 'двічі не візьмеш');
  assert.equal(JSON.parse((await jreq('/api/shop/buy', auth, { item: 'motion.tide' })).body).error,
    'booster', 'бустерська річ закрита');

  // фон закритий четвертим рівнем — навіть куплений
  const lockedBg = await jreq('/api/shop/equip', auth, { item: 'solid.dusk' });
  assert.equal(lockedBg.status, 403, 'до четвертого рівня фон не вдягнеш');
  assert.equal(JSON.parse(lockedBg.body).need, 4, 'названо потрібний рівень');

  // доростаємо — і та сама річ вдягається
  {
    const { walletRepo } = await import('../src/database/repositories.js');
    const { cosmeticsService } = await import('../src/services/cosmeticsService.js');
    await walletRepo.add(G, U, 50);
    for (let i = 1; i < 4; i++) await cosmeticsService.buyLevel(G, U);
  }

  // вдягається річ із купленого набору; чуже — ні
  assert.equal((await jreq('/api/shop/equip', auth, { item: 'solid.dusk' })).status, 200, 'своє вдягається');
  assert.equal((await jreq('/api/shop/equip', auth, { item: 'grad.ember' })).status, 400, 'чуже — ні');

  // оформлення діє на всьому сайті, а не лише в профілі
  for (const page of ['/me', '/gallery', '/top']) {
    assert.match((await req(page, auth)).body, /\.bg\{background:#150f22\}/,
      `фон застосовано на ${page}`);
  }
  const me = await req('/me', auth);
  assert.ok(me.body.includes('id="stars"') && me.body.includes('id="fog"'), 'зорі й дим на місці');
  assert.match(me.body, /#fog\{opacity:\.34/, 'дим притлумлено, щоб не забивав колір');
  assert.ok(me.body.includes('class="fpchip"'), 'FP видно в профілі окремим чипом');

  // зняти оформлення
  assert.equal((await jreq('/api/shop/clear', auth, { what: 'background' })).status, 200, 'знімається');
  assert.ok(!/\.bg\{background:#150f22\}/.test((await req('/me', auth)).body), 'фон повернувся до типового');

  // ціну й позначку править лише адміністратор — і в окремому вікні
  assert.equal((await jreq('/api/shop/price', auth, { item: 'grad.aurora', price: 500 })).status, 403,
    'звичайний учасник ціну не змінить');
  assert.equal((await jreq('/api/shop/price', adm, { item: 'grad.aurora', price: 500 })).status, 200,
    'адміністратор змінює ціну');
  const shopAdm = await req('/shop', adm);
  assert.ok(shopAdm.body.includes('500 ✨FP'), 'нова ціна показана');
  assert.ok(shopAdm.body.includes('id="sh-prices"'), 'вікно цін є');
  assert.ok(shopAdm.body.includes('id="sh-openprices"'), 'відкривається однією кнопкою');
  assert.ok(!shopAdm.body.includes('sh-setprice'), 'поля цін більше не на картках');

  // у вікні видно саму річ і її категорію, а не лише назву
  assert.ok(shopAdm.body.includes('class="sh-pv"'), 'у рядку є зразок речі');
  assert.match(shopAdm.body, /<span class="sh-pn">\s*<b>[^<]+<\/b>\s*<i>[^<]+<\/i>/,
    'назва разом із категорією');
  assert.ok(shopAdm.body.includes('class="sh-pgroup"'), 'рядки згруповані за категоріями');

  // Кілька цін зберігаються одним запитом — окремі запити перезаписували
  // мапу одне одному, і доїжджала лише остання правка.
  const many = { 'grad.aurora': 111, 'accent.mint': 222, 'frame.spin': 333, 'card.dense': 444 };
  assert.equal((await jreq('/api/shop/prices', auth, { prices: many })).status, 403,
    'масову зміну теж закрито для звичайних');
  assert.equal((await jreq('/api/shop/prices', adm, { prices: many })).status, 200, 'адміністратор зберігає');

  const afterAll = await req('/shop', adm);
  for (const [id, price] of Object.entries(many)) {
    assert.ok(afterAll.body.includes(`${price} ✨FP`), `ціна ${id} доїхала (${price})`);
  }

  // позначка «лише для бустерів» ставиться й знімається
  assert.equal((await jreq('/api/shop/flag', auth, { item: 'grad.aurora', booster: true })).status, 403,
    'звичайний учасник позначку не поставить');
  const flagged = await jreq('/api/shop/flag', adm, { item: 'grad.aurora', booster: true });
  assert.equal(JSON.parse(flagged.body).booster, true, 'адміністратор закрив річ бустом');
  assert.equal(JSON.parse((await jreq('/api/shop/buy', auth, { item: 'grad.aurora' })).body).error,
    'booster', 'після позначки річ закрита');
  await jreq('/api/shop/flag', adm, { item: 'grad.aurora', booster: false });
}
ok('магазин: набори, категорії ліворуч, ціни від адміністратора');

// 21.5 «Кастом»: вітрина робіт учасників — гроші йдуть авторові
{
  const { assetsRepo, walletRepo } = await import('../src/database/repositories.js');
  const AUTHOR = '777000777000777000';

  // роботу автора виставлено на вітрину
  const assetId = await assetsRepo.add(G, AUTHOR, {
    kind: 'background', mime: 'image/png', sizeBytes: 100, objectKey: 'ch/1', url: 'https://x/1',
  });
  await assetsRepo.setListing(G, AUTHOR, assetId, { listed: true, price: 40, title: 'Нічний ліс' });

  const shop = await req('/shop', auth);
  assert.ok(shop.body.includes('Нічний ліс'), 'робота видно у вітрині');
  assert.ok(shop.body.includes(`asset:${assetId}`), 'її можна купити');
  assert.ok(/class="sh-by"/.test(shop.body), 'видно, хто виклав');

  // купуємо: у покупця списується, авторові нараховується
  await walletRepo.add(G, U, 100);
  const before = (await walletRepo.get(G, AUTHOR)).balance;
  const buy = await jreq('/api/shop/buy', auth, { item: `asset:${assetId}` });
  assert.equal(buy.status, 200, 'робота купується');
  assert.equal((await walletRepo.get(G, AUTHOR)).balance, before + 40, 'гроші пішли авторові');

  // куплене можна вдягти
  assert.equal((await jreq('/api/shop/equip', auth, { item: `asset:${assetId}` })).status, 200,
    'куплена робота вдягається');
  assert.match((await req('/me', auth)).body, new RegExp(`url\\(/asset/${assetId}\\)`),
    'вона стала фоном');

  // двічі не купиш, свою — теж
  assert.equal(JSON.parse((await jreq('/api/shop/buy', auth, { item: `asset:${assetId}` })).body).error,
    'owned', 'двічі не купиш');

  // виставляти може лише бустер
  assert.equal((await jreq('/api/shop/list', auth, { asset: assetId, price: 10 })).status, 403,
    'без бусту нічого не виставиш');
}
ok('кастом: вітрина учасників, оплата авторові, покупка й вдягання');

// 22. персоналізація профілю: опис усім, картинки — бустерам
{
  // опис — базова можливість, без покупок
  const saved = await jreq('/api/profile', auth, { about: 'Люблю довгі прогулянки <script>' });
  assert.equal(saved.status, 200, 'опис зберігається без покупок');

  const me = await req('/me', auth);
  assert.ok(me.body.includes('Люблю довгі прогулянки'), 'опис видно на сторінці');
  assert.ok(!me.body.includes('<script>Л') && me.body.includes('&lt;script&gt;'), 'текст екрановано');
  assert.ok(me.body.includes('pf-edit'), 'власник бачить кнопку редагування');

  // гардероб — усе придбане в одному місці, з передпереглядом
  assert.ok(me.body.includes('id="look"'), 'вікно оформлення на сторінці');
  // кнопка стоїть у рядку з ніком, а не окремою смугою під графіком
  assert.match(me.body, /<div class="pf-nrow">[\s\S]{0,200}class="name"[\s\S]{0,200}pf-lookopen/,
    'кнопка оформлення — праворуч від ніка');
  assert.match(me.body, /\.pf-nrow\{display:flex/, 'нік і кнопка в одному рядку');

  // блоки сторінки можна вимикати
  for (const block of ['chart', 'showcase', 'about']) {
    assert.ok(me.body.includes(`data-block="${block}"`), `перемикач «${block}» є`);
  }
  assert.equal((await jreq('/api/profile', auth, { hidden: { chart: true } })).status, 200,
    'графік ховається');
  assert.ok(!/class="card pane rise chartbox"/.test((await req('/me', auth)).body),
    'і його справді немає на сторінці');
  await jreq('/api/profile', auth, { hidden: { chart: false } });
  assert.ok(/class="card pane rise chartbox"/.test((await req('/me', auth)).body), 'і повертається');

  // вітрина ілюстрацій: приймаємо лише свої або куплені картинки
  assert.equal((await jreq('/api/profile', auth, { showcase: [999999] })).status, 200, 'запит проходить');
  assert.ok(!/class="pf-show"/.test((await req('/me', auth)).body), 'чужу картинку у вітрину не взяли');

  // Поштучна річ не має «items», і сторінка на цьому падала з 500.
  assert.equal((await jreq('/api/shop/buy', auth, { item: 'card.glass' })).status, 200, 'поштучне береться');
  const afterSingle = await req('/me', auth);
  assert.equal(afterSingle.status, 200, 'профіль після покупки поштучного відкривається');
  assert.ok(afterSingle.body.includes('data-item="card.glass"'), 'річ зʼявилась у гардеробі');
  assert.ok(me.body.includes('pf-sw'), 'зразки для вибору');
  assert.ok(me.body.includes('data-item2'), 'зразок несе дані для передперегляду');
  assert.ok(me.body.includes('CosmeticPreview'), 'вікно передперегляду підключено');

  // свої картинки — лише бустерам: заливка платна й закрита, а поставити
  // можна тільки те, що справді твоє (чужий чи вигаданий id не пройде)
  const alien = await jreq('/api/profile', auth, { background: 999999 });
  assert.equal(alien.status, 400, 'чужу картинку не поставиш');
  assert.equal(JSON.parse(alien.body).error, 'not yours', 'і сказано чому');
  assert.ok(me.body.includes('Заливати свої картинки можуть бустери'), 'сказано, чому замкнено');

  // чужий профіль редагувати не можна
  const other = await req(`/u/${OWNER_ID}`, auth);
  assert.ok(!other.body.includes('id="pf-edit"'), 'на чужій сторінці кнопки редагування немає');
  assert.ok(!other.body.includes('id="look"'), 'і гардероба теж');
}
ok('профіль: опис усім, гардероб із передпереглядом, картинки — бустерам');

// 23. персоналізація по вкладках, фільтр магазину, заливка з підтвердженням
{
  const me = await req('/me', auth);

  // вікно оформлення розбите на розділи — раніше все лежало одним сувоєм
  assert.equal((me.body.match(/<button class="pf-tab/g) ?? []).length, 4, 'чотири вкладки');
  for (const tab of ['look', 'images', 'page', 'settings']) {
    assert.ok(me.body.includes(`data-tab="${tab}"`), `вкладка «${tab}»`);
    assert.ok(me.body.includes(`data-panel="${tab}"`), `панель «${tab}»`);
  }
  assert.equal((me.body.match(/data-panel="(images|page|settings)" hidden/g) ?? []).length, 3,
    'видно рівно один розділ');
  assert.ok(me.body.includes('id="pf-clearall"'), 'можна скинути все одним рухом');

  // ── магазин: категорія фільтрує, а не гортає ──
  const shop = await req('/shop', auth);
  assert.ok(shop.body.includes('data-cat="all"') && shop.body.includes('data-cat="mine"'),
    'зрізи «Усе» та «Моє»');
  assert.ok(shop.body.includes('id="sh-empty"'), 'є що показати, коли розділ порожній');
  // перегляд — у ряду дій, поруч із покупкою, а не плитою під курсором
  assert.ok(shop.body.includes('sh-prev'), 'перегляд окремою кнопкою на картці');
  assert.ok(!shop.body.includes('sh-prevbtn'), 'кнопка більше не лежить поверх прев’ю');
  assert.ok(shop.body.includes('sh-chip">У наборі'), 'видно, скільки зразків у наборі');
  // без бусту заливка замкнена; сам перехід «одразу на вкладку заливки»
  // перевіряємо нижче, на розмітці профілю
  assert.ok(shop.body.includes('🔒'), 'без бусту заливка замкнена');
  assert.ok(me.body.includes("if(location.hash==='#upload')go('images')"),
    'посилання #upload відкриває саме вкладку заливки');

  // передперегляд показує весь набір стрічкою, а не по одному за клік
  assert.ok(shop.body.includes('pv-strip'), 'стрічка варіантів');
  assert.ok(shop.body.includes('pv-th'), 'мініатюри варіантів');
  assert.ok(!shop.body.includes('Клікайте ще'), 'підказки «клікайте ще» більше немає');
  assert.ok(!/dataset\.pi/.test(shop.body), 'і перебору по колу теж');

  // ── відмови показуються реченням, а не міткою сервера ──
  for (const [lang, word] of [['uk', 'Не вистачає'], ['en', 'Not enough']]) {
    const page = await req('/shop', { headers: { cookie: `sid=${SID}; lang=${lang}` } });
    assert.ok(page.body.includes('window.ERRS='), `словник відмов (${lang})`);
    assert.ok(page.body.includes(word), `відмови перекладено (${lang})`);
  }
  assert.ok(!shop.body.includes("funds:'Не вистачає FP'"), 'вписаних у скрипт текстів більше немає');

  // ── заливка живе тільки в магазині ──
  const { shopPage, profilePage } = await import('../src/web/render.js');
  const { cosmeticsService } = await import('../src/services/cosmeticsService.js');
  const upKinds = cosmeticsService.UPLOAD_KINDS;
  const shopBoost = shopPage({
    items: [], categories: cosmeticsService.CATEGORIES, market: [], mine: [],
    owned: [], booster: true, kinds: upKinds, lang: 'uk',
    uploads: { background: 2, banner: 3, art: 1 }, uploadLimit: 3,
  });
  assert.ok(shopBoost.includes('id="sh-upwin"'), 'вікно заливки в магазині');
  assert.ok(shopBoost.includes('id="sh-upfile"'), 'вибір файлу');
  assert.ok(shopBoost.includes('id="sh-upshot"'), 'передперегляд самої картинки');
  assert.ok(shopBoost.includes('id="sh-upgo"'), 'публікацію треба підтвердити');
  assert.ok(/id="sh-upgo"[^>]*disabled/.test(shopBoost), 'без файлу підтвердити не можна');
  for (const k of ['background', 'banner', 'art']) {
    assert.ok(shopBoost.includes(`data-kind="${k}"`), `можна залити «${k}»`);
  }
  assert.ok((shopBoost.match(/sh-upopen/g) ?? []).length >= 3,
    'заливка є в заголовку кожного розділу, куди робота й лягає');
  assert.ok(shopBoost.includes('2/3') && shopBoost.includes('1/3'), 'видно залишок лімітів');

  // у профілі заливки більше немає — там лише вибір із залитого
  const kinds = [
    { id: 'b1', name: 'Фон', kind: 'background', value: { type: 'solid', color: '#111' } },
    { id: 'a1', name: 'Акцент', kind: 'accent', value: { color: '#43c47b' } },
    { id: 'f1', name: 'Рамка', kind: 'frame', value: { color: '#6b7cff' } },
    { id: 'c1', name: 'Вікно', kind: 'card', value: { bg: 'rgba(1,2,3,.5)', line: '#fff' } },
  ];
  const page = profilePage(
    { aiScore: 1, totalMessages: 1, messages30d: 1, voiceMinutes: 1, activeDays: 1, daysOnServer: 1, scoreHistory: [1, 2, 3] },
    {
      username: 'x', avatar: '/a', rank: 1, lang: 'uk', mine: true,
      look: { scope: {}, layout: {}, showcase: [] },
      wardrobe: {
        packs: [{ id: 'p', name: 'Набір', items: kinds }],
        canUpload: true, showcaseMax: 6, kinds: upKinds,
        assets: [
          { id: 1, kind: 'background', url: '/asset/1' },
          { id: 2, kind: 'banner', url: '/asset/2' },
          { id: 3, kind: 'art', url: '/asset/3' },
        ],
        bought: [], images: [],
      },
    },
  );
  assert.ok(!page.includes('id="pf-upfile"'), 'у профілі файл більше не заливають');
  assert.ok(!page.includes('id="pf-upwin"'), 'і вікна публікації там немає');
  assert.ok(page.includes('/shop#upload'), 'звідти ведуть у магазин');

  // свої картинки розкладені за призначенням
  for (const g of ['Фон', 'Банер', 'Ілюстрація']) {
    assert.ok(page.includes(`<span>${g}</span>`), `свої картинки: група «${g}»`);
  }
  assert.ok(page.includes('data-slot="background"') && page.includes('data-slot="banner"'),
    'фон і банер вдягаються кліком');
  assert.ok(page.includes('data-show="3"'), 'ілюстрація йде у вітрину');

  // куплені речі згруповані за призначенням, а не за набором
  for (const g of ['Фони', 'Акценти', 'Рамки аватара', 'Стиль вікон']) {
    assert.ok(page.includes(`<span>${g}</span>`), `група «${g}»`);
  }
  assert.ok(!page.includes('<span>Набір</span>'), 'назва набору більше не заголовок');

  // емодзі вкладок мають селектор подання — без нього браузер малює рамку
  assert.ok(page.includes('🖼️') && page.includes('⚙️'), 'емодзі вкладок із U+FE0F');
  assert.ok(!/[^️]🖼[^️]/.test(page) && !/[^️]⚙[^️]/.test(page), 'голих варіантів не лишилось');

  // ── hls.js їде з нашого сервера, а не з чужого CDN ──
  const cin = await req('/cinema', auth);
  assert.ok(cin.body.includes("loadScript('/vendor/hls.min.js')"), 'спершу свій файл');
  const vendor = await req('/vendor/hls.min.js');
  assert.equal(vendor.status, 200, 'файл віддається');
  assert.ok(vendor.body.length > 100_000, `це справді бібліотека (${vendor.body.length} б)`);
  assert.ok(vendor.type.includes('javascript'), 'із правильним типом');
}
ok('персоналізація по вкладках, фільтр магазину, заливка з підтвердженням, свій hls.js');

// 24. керування власним контентом: правка, буст, видалення з поверненням
{
  const { assetsRepo, walletRepo, itemsRepo, prefsRepo } = await import('../src/database/repositories.js');
  const { cosmeticsService } = await import('../src/services/cosmeticsService.js');
  const AUTHOR = '888000888000888000';
  const BUYER = '999000999000999000';

  const id = await assetsRepo.add(G, AUTHOR, {
    kind: 'background', mime: 'image/png', sizeBytes: 1, objectKey: 'ch/del',
  });
  await assetsRepo.setListing(G, AUTHOR, id, { listed: true, price: 40, title: 'Ліс' });

  // робота, закрита бустом, поводиться як каталожна річ
  await cosmeticsService.editAsset(G, id, { booster: true });
  assert.equal((await cosmeticsService.buy(G, BUYER, null, `asset:${id}`)).reason, 'booster',
    'закриту бустом роботу без бусту не купиш');
  await cosmeticsService.editAsset(G, id, { booster: false });

  // правка опису й ціни
  const edited = await cosmeticsService.editAsset(G, id, { title: 'Нічний ліс', price: 55 });
  assert.equal(edited.asset.title, 'Нічний ліс', 'опис змінено');
  assert.equal(Number(edited.asset.price), 55, 'ціну змінено');

  // покупка й вдягання
  await walletRepo.add(G, BUYER, 200);
  await cosmeticsService.buy(G, BUYER, null, `asset:${id}`);
  await cosmeticsService.setOwnImage(G, BUYER, { slot: 'background', asset: id });
  await prefsRepo.save(G, BUYER, { layout: { showcase: [id] } });
  const buyerAfterBuy = (await walletRepo.get(G, BUYER)).balance;
  const authorAfterSale = (await walletRepo.get(G, AUTHOR)).balance;

  // видалення: покупцю повертається половина, авторові — нічого
  const del = await cosmeticsService.deleteAsset(G, id);
  assert.equal(del.refunded, 1, 'повернуто одному покупцю');
  assert.equal(del.total, 27, 'половина від 55 — 27');
  assert.equal((await walletRepo.get(G, BUYER)).balance, buyerAfterBuy + 27, 'покупцю повернулось');
  assert.equal((await walletRepo.get(G, AUTHOR)).balance, authorAfterSale, 'авторові не повертали');

  // річ зникає звідусіль, а не лишається порожньою рамкою
  assert.ok(!await assetsRepo.meta(id), 'робота зникла з бази');
  assert.ok(!await itemsRepo.has(G, BUYER, `asset:${id}`), 'і з володінь покупця');
  const prefs = await prefsRepo.get(G, BUYER);
  assert.equal(prefs.background, null, 'знята з оформлення');
  assert.equal((prefs.layout?.showcase ?? []).length, 0, 'і з вітрини');

  // ── доступ: чужу роботу править лише адміністратор ──
  const id2 = await assetsRepo.add(G, AUTHOR, {
    kind: 'art', mime: 'image/png', sizeBytes: 1, objectKey: 'ch/a2',
  });
  await assetsRepo.setListing(G, AUTHOR, id2, { listed: true, price: 10, title: 'Робота' });
  assert.equal((await jreq('/api/shop/asset', auth, { asset: id2, price: 5 })).status, 403,
    'сторонній чужу роботу не править');
  assert.equal((await jreq('/api/shop/assetDelete', auth, { asset: id2 })).status, 403,
    'і не видаляє');
  assert.equal((await jreq('/api/shop/asset', adm, { asset: id2, title: 'Від адміна' })).status, 200,
    'адміністратор править');
  assert.equal((await jreq('/api/shop/assetDelete', adm, { asset: id2 })).status, 200,
    'і видаляє');

  // ── інтерфейс ──
  const shop = await req('/shop', adm);
  assert.ok(shop.body.includes('sh-mydel'), 'кнопка видалення роботи');
  assert.ok(shop.body.includes('sh-myboost'), 'перемикач бусту для роботи');
  assert.ok(shop.body.includes('Роботи учасників'), 'адміністратор править чужі роботи у вікні цін');
  assert.ok(shop.body.includes('window.toast='), 'спливаючі повідомлення підключено');
  assert.ok(!shop.body.includes('id="sh-err"'), 'смуги помилок унизу сторінки більше немає');
  assert.ok(shop.body.includes('🚀') && !shop.body.includes('💜'), 'позначка бустерів — ракета');
  assert.ok(!/class="btn ghost sm sh-prev"/.test(shop.body), 'окремої кнопки «Подивитись» немає');
  assert.ok(shop.body.includes('<button class="sh-prev"'), 'саме прев’ю і є кнопкою перегляду');
  assert.match(shop.body, /\.sh-wallet\{position:sticky/, 'баланс FP видно під час гортання');

  const shopBooster = await req('/shop', adm);
  assert.ok(!/id="sh-upprice"[^>]*value=/.test(shopBooster.body), 'ціна не підставляється наперед');

  const me = await req('/me', auth);
  assert.ok(me.body.includes('id="pf-txt"'), 'тексти повідомлень профілю');
  assert.ok(me.body.includes('window.toast='), 'спливаючі повідомлення в профілі');
}
ok('свій контент: правка, буст, видалення з поверненням; спливаючі повідомлення');

// 25. персоналізація доходить до всього сайту, а не наполовину
{
  const { prefsRepo, itemsRepo } = await import('../src/database/repositories.js');
  const { cosmeticsService, CATEGORIES } = await import('../src/services/cosmeticsService.js');

  // ── акцент ──
  // Раніше десятки правил тримали синій жорстко вписаним, тож обраний колір
  // фарбував самі кнопки, а їхній фон, рамки й світіння лишалися типовими.
  const base = await req('/gallery', auth);
  assert.ok(!base.body.includes('rgba(107,124,255,'),
    'жодного жорстко вписаного акценту в CSS не лишилось');
  assert.ok(base.body.includes('--accent-rgb:107,124,255'), 'акцент числами — окремим токеном');
  assert.ok(base.body.includes('rgba(var(--accent-rgb)'), 'підсвітки беруть саме токен');

  await itemsRepo.give(G, U, 'accent.lime');
  await cosmeticsService.equip(G, U, 'accent.lime');
  const tinted = await req('/gallery', auth);
  assert.match(tinted.body, /--accent-rgb:168,224,95/, 'обраний колір доїхав і числами');
  assert.match(tinted.body, /--accent:#a8e05f/, 'і як сам колір');

  // ── стиль вікон ──
  await itemsRepo.give(G, U, 'card.neon');
  await cosmeticsService.equip(G, U, 'card.neon');
  const styled = await req('/me', auth);
  for (const sel of ['.pv', '.pf-lookwin', '.cdrawer', '.drop-menu', '.langmenu']) {
    assert.ok(styled.body.includes(sel), `стиль вікон дістає до ${sel}`);
  }
  assert.ok(styled.body.includes('--line-w:2px'), 'товщина рамки — теж частина стилю');
  assert.ok(styled.body.includes('--menu:'), 'поверхня спливних меню задана');
  // піл гаманця й повідомлення свідомо не беруть радіус вікон
  assert.ok(!/\.sh-wallet[^{]*\{border-radius/.test(styled.body.split('--line-w')[1] ?? ''),
    'гаманець лишається пілом');

  // під курсором рамка не має збиватись на типову білу
  assert.match(styled.body, /\.pane:hover\{border-color:rgba\(var\(--accent-rgb\)/,
    'наведення тримається обраного кольору');

  await cosmeticsService.clear(G, U, 'accent');
  await prefsRepo.save(G, U, { layout: {} });

  // ── каталог помітно поповнився, а стилі вікон стали різними ──
  const cat = cosmeticsService.catalog(G);
  const per = {};
  for (const p of cat) per[p.category] = (per[p.category] ?? 0) + 1;
  assert.ok(per.bg >= 18, `фонів побільшало (${per.bg})`);
  assert.ok(per.accent >= 12, `акцентів побільшало (${per.accent})`);
  assert.ok(per.frame >= 11, `рамок побільшало (${per.frame})`);
  assert.ok(per.card >= 9, `стилів вікон побільшало (${per.card})`);

  const ids = cat.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'жодного повтору id');

  // Кожен стиль вікон мусить читатися з першого погляду, тому вони різняться
  // не альфа-каналом, а помітними речами — і в кожного є пояснення.
  const cards = cat.filter((p) => p.category === 'card');
  assert.ok(cards.every((c) => c.hint), 'у кожного стилю вікон є опис, що він робить');
  assert.equal(new Set(cards.map((c) => c.value.radius)).size >= 5, true,
    'округлість помітно різна');
  assert.ok(cards.some((c) => (c.value.width ?? 1) > 1), 'є стилі з товстою рамкою');
  assert.ok(cards.some((c) => c.value.shadow), 'є стилі з тінню');

  assert.ok(CATEGORIES.every((c) => cat.some((p) => p.category === c.id)
    || ['banner', 'art'].includes(c.id)), 'кожна каталожна категорія має товар');
}
ok('персоналізація діє на весь сайт; каталог поповнено, стилі вікон стали різними');

// 26. рівні, рейтинг картками, вітрина на все полотно
{
  const { walletRepo, assetsRepo, prefsRepo } = await import('../src/database/repositories.js');
  const { cosmeticsService, levelCost, hasPerk } = await import('../src/services/cosmeticsService.js');

  // Ціна подвоюється, але впирається у стелю: без неї до десятого рівня
  // набігало 511 ✨FP — це була стіна, а не поступ.
  assert.equal(levelCost(1), 1, '1→2 коштує 1');
  assert.equal(levelCost(2), 2, '2→3 коштує 2');
  assert.equal(levelCost(3), 4, '3→4 коштує 4');
  assert.equal(levelCost(4), 8, '4→5 коштує 8');
  assert.equal(levelCost(5), 15, '5→6 упирається у стелю');
  assert.equal(levelCost(20), 15, 'і далі не дорожчає');

  let toTen = 0;
  for (let l = 1; l < 10; l++) toTen += levelCost(l);
  assert.equal(toTen, 90, `до десятого рівня — 90 ✨FP (було ${511})`);

  const L = '555000555000555000';
  assert.equal((await cosmeticsService.level(G, L)).level, 1, 'у всіх стартує перший рівень');

  // без грошей рівень не купиш
  assert.equal((await cosmeticsService.buyLevel(G, L)).reason, 'funds', 'без FP не піднімешся');

  await walletRepo.add(G, L, 1000);
  const up = await cosmeticsService.buyLevel(G, L);
  assert.equal(up.level, 2, 'рівень піднявся');
  assert.equal(up.balance, 999, 'списалось рівно 1 FP');
  assert.equal(up.next, 2, 'наступний уже дорожчий');

  // ── плюшка пʼятого рівня: банер у профілі ──
  const B = '444000444000444000';
  const bAsset = await assetsRepo.add(G, B, {
    kind: 'banner', mime: 'image/png', sizeBytes: 1, objectKey: 'ch/b',
  });
  assert.equal((await cosmeticsService.level(G, B)).level, 1, 'починаємо з першого');

  const denied = await cosmeticsService.setOwnImage(G, B, { slot: 'banner', asset: bAsset });
  assert.equal(denied.ok, false, 'до пʼятого рівня банер не поставиш');
  assert.equal(denied.reason, 'level', 'і сказано чому');
  assert.equal(denied.need, 5, 'названо потрібний рівень');

  // фон відкривається раніше за банер — четвертим рівнем
  const bgAsset = await assetsRepo.add(G, B, {
    kind: 'background', mime: 'image/png', sizeBytes: 1, objectKey: 'ch/bg',
  });
  const bgDenied = await cosmeticsService.setOwnImage(G, B, { slot: 'background', asset: bgAsset });
  assert.equal(bgDenied.ok, false, 'до четвертого рівня фон не поставиш');
  assert.equal(bgDenied.need, 4, 'названо потрібний рівень');

  // доростаємо до пʼятого — і банер відкривається
  await walletRepo.add(G, B, 100);
  for (let i = 1; i < 5; i++) await cosmeticsService.buyLevel(G, B);
  assert.equal((await cosmeticsService.level(G, B)).level, 5, 'дійшли до пʼятого');
  assert.equal((await cosmeticsService.setOwnImage(G, B, { slot: 'banner', asset: bAsset })).ok,
    true, 'тепер банер ставиться');

  // зняти банер можна завжди — інакше можна було б застрягти з чужим вибором
  assert.equal((await cosmeticsService.setOwnImage(G, B, { slot: 'banner', asset: null })).ok,
    true, 'зняти банер рівня не потребує');

  assert.equal(hasPerk(4, 'banner'), false, 'на четвертому ще ні');
  assert.equal(hasPerk(5, 'banner'), true, 'на пʼятому — так');

  // дійшовши до пʼятого, ми проминули четвертий — фон уже свій
  assert.equal((await cosmeticsService.setOwnImage(G, B, { slot: 'background', asset: bgAsset })).ok,
    true, 'з четвертого рівня фон ставиться');

  // ── плюшка другого рівня: ілюстрації у вітрині ──
  assert.equal(hasPerk(1, 'art'), false, 'на першому вітрини ще немає');
  assert.equal(hasPerk(2, 'art'), true, 'на другому — є');
  assert.equal(hasPerk(3, 'background'), false, 'фон на третьому ще закритий');
  assert.equal(hasPerk(4, 'background'), true, 'на четвертому — відкритий');

  // ── плюшка десятого рівня: заливка без бусту ──
  assert.equal(hasPerk(9, 'upload'), false, 'на девʼятому ще ні');
  assert.equal(hasPerk(10, 'upload'), true, 'на десятому — так');
  assert.equal(cosmeticsService.canUpload(G, null, 10), true, 'десятий рівень замінює буст');
  assert.equal(cosmeticsService.canUpload(G, null, 1), false, 'перший — ні');

  // сторінка показує рівень
  const meLvl = await req('/me', auth);
  assert.ok(meLvl.body.includes('class="lvchip"'), 'рівень видно в профілі');
  assert.ok(meLvl.body.includes('id="pf-levelup"'), 'власник може підняти його звідти');
  const alien = await req(`/u/${OWNER_ID}`, auth);
  assert.ok(!alien.body.includes('id="pf-levelup"'), 'на чужій сторінці кнопки немає');

  // ── рейтинг картками, а не списком ──
  const top = await req('/top', auth);
  assert.equal(top.status, 200);
  assert.ok(top.body.includes('class="tp-podium"'), 'трійка окремим блоком');
  assert.ok(top.body.includes('tp-top tp-1'), 'перше місце виділене');
  assert.ok(top.body.includes('class="tp-face"'), 'аватар учасника на картці');
  assert.ok(top.body.includes('class="tp-bg"'), 'банер учасника тлом картки');
  assert.ok(!/<table>[\s\S]*<th>/.test(top.body), 'таблиці більше немає');
  assert.match(top.body, /--f:/, 'колір рамки учасника доїжджає в картку');

  // статистика просто на картці — заради неї в рейтинг і заходять
  assert.ok(top.body.includes('class="tp-stats"'), 'блок статистики є');
  assert.equal((top.body.match(/class="tp-stat"/g) ?? []).length % 3, 0,
    'на кожній картці три показники');
  for (const label of ['повідомлень', 'у голосових', 'на сервері']) {
    assert.ok(top.body.includes(label), `показано «${label}»`);
  }

  // Оформлення на картці — власника, а не того, хто дивиться: людина без
  // свого стилю має лишатись нейтральною, інакше рейтинг показував би чуже.
  assert.match(top.body, /\.tp\{[^}]*border-radius:var\(--tp-r,18px\)/,
    'відкат стилю картки нейтральний');
  // Стиль вікон має міняти й КОЛІР картки: без цього він майже не читався —
  // збігались лише радіус і рамка, а сама картка лишалась однаковою.
  assert.match(top.body, /\.tp\{[^}]*background:var\(--tp-bg,/, 'колір картки — від стилю власника');
  // Банер має бути смугою вгорі, а не ледь помітним тлом під накладкою.
  assert.ok(top.body.includes('class="tp-head"'), 'банер окремою смугою');
  assert.ok(!/\.tp-bg\{[^}]*opacity:\.3/.test(top.body), 'банер більше не притлумлений до невидимості');
  assert.ok(!/\.tp::before\{[^}]*width:3px/.test(top.body), 'смужки зліва більше немає');
  assert.match(top.body, /\.tp-place\{[^}]*left:12px/, 'номер місця не налазить на рейтинг');
  assert.ok(!/\.tp\{[^}]*var\(--tp-r,var\(--radius\)\)/.test(top.body),
    'картка не переймає стиль глядача');

  // підказка про плюшку 10-го рівня зі смуги прибрана
  assert.ok(!meLvl.body.includes('на 10-му:'), 'опису плюшки в смузі рівня немає');

  // ── ілюстрації: gif і відео, вітрина на все полотно ──
  const vid = await assetsRepo.add(G, U, {
    kind: 'art', mime: 'video/mp4', sizeBytes: 10, objectKey: 'ch/v',
  });
  await prefsRepo.save(G, U, { layout: { showcase: [vid] } });
  const withVideo = await req('/me', auth);
  assert.ok(withVideo.body.includes('class="pf-stage"'), 'вітрина окремою сценою');
  assert.ok(withVideo.body.includes('<video class="pf-big-m"'), 'відео грає як відео');
  assert.ok(withVideo.body.includes('autoplay muted loop'), 'без звуку й по колу');
  assert.ok(!/pf-showgrid/.test(withVideo.body), 'сітки дрібних плиток більше немає');

  // сервер приймає відео саме для ілюстрації, а не для фону
  const { UPLOAD_KINDS } = await import('../src/services/cosmeticsService.js');
  assert.ok(UPLOAD_KINDS.some((k) => k.kind === 'art'), 'ілюстрація — окремий вид');

  await prefsRepo.save(G, U, { layout: {} });

  // ── стиль вікон дістає галерею й кінотеатр ──
  const gal = await req('/gallery', auth);
  assert.match(gal.body, /\.item\{[^}]*border-radius:var\(--radius\)/, 'плитки галереї — за стилем');
  assert.match(gal.body, /\.spot\{[^}]*border-radius:var\(--radius\)/, '«кліп дня» — теж');
  const cin = await req('/cinema', auth);
  assert.match(cin.body, /\.room\{[^}]*background:var\(--card\)/, 'зал більше не має свого фону');

  // ── ігри: вимкнено за замовчуванням, і це свідомо ──
  const { gamesEnabled } = await import('../src/services/gamesService.js');
  assert.equal(gamesEnabled(), false, 'стеження за іграми вимкнене без TRACK_GAMES');
  assert.ok(!meLvl.body.includes('gmbox'), 'вимкнене — блока ігор немає взагалі');
}
ok('рівні за FP, рейтинг картками, вітрина на все полотно, стиль у галереї й залі');

// 27. тло, ролі, картка бота й вимоги до довіреної
{
  const me = await req('/me', auth);

  // ── Дим і зорі не мають зникати під власним фоном ──
  // Накладка для картинки раніше йшла після полотен у порядку документа,
  // тож малювалась поверх них — фон «зʼїдав» усю атмосферу сайту.
  assert.match(me.body, /#fog\{[^}]*z-index:1/, 'дим має свій шар');
  assert.match(me.body, /#stars\{[^}]*z-index:2/, 'зорі поверх диму');
  assert.match(me.body, /\.bg::after\{z-index:0\}/, 'накладка — під полотнами');
  assert.ok(me.body.includes('--accent-rgb'), 'дим бере колір з акценту');
  assert.match(me.body, /getPropertyValue\('--accent-rgb'\)/, 'і читає його на льоту');

  // ── Шрифт у сайта й картки бота має бути один ──
  // CSS просив «Inter», але ніде його не постачав: браузер тихо брав
  // системний, а картки малювались справжнім Inter із assets/fonts.
  assert.match(me.body, /@font-face\{font-family:'Inter'/, 'Inter оголошений');
  assert.ok(me.body.includes('/vendor/inter.ttf'), 'і справді постачається');
  const font = await req('/vendor/inter.ttf');
  assert.equal(font.status, 200, 'шрифт віддається');
  assert.ok(font.body.length > 100_000, `це справді шрифт (${font.body.length} б)`);

  // ── Найвища роль у своєму кольорі ──
  assert.ok(me.body.includes('tp-role'), 'чип ролі є в профілі');
  const top = await req('/top', auth);
  assert.ok(top.body.includes('tp-role') || top.body.includes('tp-meta'),
    'і на картках рейтингу');
  assert.match(top.body, /\.tp-role\{[^}]*color:var\(--r\)/, 'роль у власному кольорі');

  // ── Вітрина без заголовка й підпису ──
  const { prefsRepo, assetsRepo } = await import('../src/database/repositories.js');
  const art = await assetsRepo.add(G, U, {
    kind: 'art', mime: 'image/png', sizeBytes: 1, objectKey: 'ch/art2',
  });
  await prefsRepo.save(G, U, { layout: { showcase: [art] } });
  const shown = await req('/me', auth);
  assert.ok(shown.body.includes('pf-showbare'), 'вітрина без зайвої обгортки');
  assert.ok(!/pf-show[^b][^>]*>\s*<div class="pane-h">/.test(shown.body),
    'заголовка «Вітрина» з лінією немає');
  assert.ok(!shown.body.includes('pf-bigcap'), 'підпису під ілюстрацією немає');
  await prefsRepo.save(G, U, { layout: {} });

  // ── Бот: кнопки прибрані, маршрути закриті ──
  const panels = await import('../src/ui/panels.js');
  const hub = panels.hubPanel(guild);
  const labels = hub.components.flatMap((row) => (row.components ?? []).map((c) => c.data?.label));
  assert.ok(!labels.includes('Репутація'), 'кнопки «Репутація» більше немає');
  assert.ok(!labels.includes('Перевірка'), 'кнопки «Перевірка» теж');
  assert.ok(labels.includes('Профіль'), 'профіль лишився');

  // ── Вимоги до довіреної ролі знижено ──
  const { DEFAULT_TIERS } = await import('../src/config/roleTiers.js');
  const trusted = DEFAULT_TIERS.find((t) => t.key === 'trusted');
  assert.ok(trusted.req.minScore <= 500, `рейтинг знижено (${trusted.req.minScore})`);
  assert.ok(trusted.req.minMessages <= 150, `повідомлень знижено (${trusted.req.minMessages})`);
  assert.ok(trusted.req.minDays <= 14, `днів знижено (${trusted.req.minDays})`);
  assert.ok(trusted.req.minSamples <= 60, `проаналізованих знижено (${trusted.req.minSamples})`);
  // але не нижче за косметичну — порядок рівнів має лишатись осмисленим
  const cosmetic = DEFAULT_TIERS.find((t) => t.key === 'cosmetic');
  assert.ok(trusted.req.minScore > cosmetic.req.minScore, 'довірена все ще вища за косметичну');
  assert.ok(trusted.req.minMessages > cosmetic.req.minMessages, 'і за повідомленнями теж');
}
ok('тло не гасне під фоном, роль у своєму кольорі, бот без зайвих кнопок, довірена доступніша');

// 28. голосування на сторінці рейтингу й щоденні нагороди за місця
{
  const { usersRepo: ur, walletRepo: wr, duelRepo, reputationRepo: rr } = await import('../src/database/repositories.js');
  const V = await import('../src/services/voteService.js');

  // учасники для пари + бот, який не має в неї потрапити
  for (const [id, name] of [['701', 'Аня'], ['702', 'Борис'], ['703', 'Влад']]) {
    await ur.ensure(G, id, name, Date.now() - 50 * 86400_000);
    guild.members.cache.set(id, { id, displayName: name, user: { bot: false } });
  }
  await ur.ensure(G, 'botX', 'Робот', Date.now());
  guild.members.cache.set('botX', { id: 'botX', displayName: 'Робот', user: { bot: true } });

  // ── пара ──
  const d = await V.duelFor(guild, '701');
  const ids = (d?.people ?? []).map((p) => p.userId);
  assert.ok(ids.length >= 2, `показано кількох (${ids.length})`);
  assert.equal(new Set(ids).size, ids.length, 'усі різні');
  assert.ok(!ids.includes('701'), 'сам себе не пропонується');
  assert.ok(!ids.includes('botX'), 'ботів у виборі немає');

  const same = await V.duelFor(guild, '701');
  assert.deepEqual(same.people.map((p) => p.userId), ids, 'вибір не перекидається до голосу');

  // ── голос: обидва отримують по 1 FP, голосуючий нічого не витрачає ──
  const mine = (await wr.get(G, '701')).balance;
  const theirs = (await wr.get(G, ids[0])).balance;
  const voted = await V.castVote(guild, '701', ids[0]);
  assert.ok(voted.ok, 'голос зараховано');
  assert.equal((await wr.get(G, ids[0])).balance, theirs + 1, 'обраному +1 FP');
  assert.equal((await wr.get(G, '701')).balance, mine + 1, 'голосуючому теж +1 FP');
  assert.equal(Number((await ur.get(G, ids[0])).votes_got), 1, 'голос порахований');

  const twice = await V.castVote(guild, '701', ids[1]);
  assert.equal(twice.reason, 'cooldown', 'двічі за добу не можна');
  assert.equal((await V.duelFor(guild, '701')).canVote, false, 'нова пара — лише за добу');

  // голос повз свою пару не проходить
  await duelRepo.set(G, '702', '703', '701', null);
  assert.equal((await V.castVote(guild, '702', 'botX')).reason, 'not in pair', 'чужий вибір відхилено');

  // ── щоденні нагороди 3 / 2 / 1 ──
  const board = (await rr.leaderboard(G, 20))
    .filter((r) => !guild.members.cache.get(r.user_id)?.user?.bot);
  const was = {};
  for (const r of board.slice(0, 3)) was[r.user_id] = (await wr.get(G, r.user_id)).balance;

  const paid = await V.payoutTop(guild);
  assert.equal(paid, 6, 'видано 3+2+1');
  const got = [];
  for (const r of board.slice(0, 3)) got.push((await wr.get(G, r.user_id)).balance - was[r.user_id]);
  assert.deepEqual(got, [3, 2, 1], `місця отримали 3/2/1 (${got.join('/')})`);
  assert.equal(await V.payoutTop(guild), 0, 'удруге за день не нараховується');

  // ── боти не потрапляють у рейтинг на сайті ──
  const page = await req('/top', auth);
  assert.ok(!page.body.includes('>Робот<'), 'бота в рейтингу немає');
  assert.ok(page.body.includes('id="vs"'), 'блок голосування є');
  assert.ok((page.body.match(/class="vs-one"/g) ?? []).length >= 2, 'кількох показано на вибір');
  assert.ok(!/<div class="vs[^"]*"[^>]*>[\s\S]{0,200}<p/.test(page.body),
    'без пояснювального тексту');

  // анонімам голосувати нічим — блока немає
  const anon = await req('/top');
  assert.ok(!anon.body.includes('id="vs"'), 'без входу блока голосування немає');

  // порядок рейтингу сталий — інакше трійка перетасовувалась би щодня
  assert.match(page.body, /ORDER BY|tp-podium/, 'рейтинг рендериться');
  const twiceBoard = await rr.leaderboard(G, 10);
  const again2 = await rr.leaderboard(G, 10);
  assert.deepEqual(twiceBoard.map((r) => r.user_id), again2.map((r) => r.user_id),
    'порядок повторюваний навіть за рівних балів');
}
ok('голосування за учасників, нагороди за місця, боти поза рейтингом');

// 18. адмін видаляє публікацію
const gone = await req(`/api/item/${itemId}/delete`, { method: 'POST', ...adm });
assert.equal(gone.status, 200);
assert.equal((await galleryRepo.list(G)).length, 0, 'запис прибрано з БД');
ok('адміністратор видаляє публікацію');

stopWebServer();
console.log(`\n✅ Усі ${passed} перевірок сайту пройдено.`);
setTimeout(() => process.exit(0), 150);
