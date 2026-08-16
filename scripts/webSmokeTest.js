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
  assert.ok(page.body.includes('#галерея'), 'вказано канал, куди все лягає');

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

  // адміністратор: кнопка є, сторінка відкривається
  const asAdmin = await req('/gallery', adm);
  assert.ok(asAdmin.body.includes('href="/mod"'), 'кнопка модерації для адміністратора');
  assert.ok(asAdmin.body.includes('apart'), 'кнопка стоїть окремо від основних');

  const modPage = await req('/mod', adm);
  assert.equal(modPage.status, 200);
  assert.ok(modPage.body.includes('mod-apply'), 'форма покарання');
  assert.ok(modPage.body.includes('mod-user'), 'поле учасника');

  // не можна карати того, хто рівний або вищий за правами
  const self = await jreq('/api/mod/apply', adm, { userId: OWNER_ID, kind: 'text', minutes: 10 });
  assert.equal(self.status, 400, 'себе — ні');
}
ok('панель модерації на сайті: кнопка й сторінка лише для модераторів');

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
  const again = JSON.parse((await jreq('/api/cinema/next', adm, { current: cur })).body);
  assert.equal(again.source, 'CCCcccDDD22', 'повторний виклик нічого не перескочив');
  assert.equal(again.queue.length, 1, 'у черзі лишився один запис');

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

// 18. адмін видаляє публікацію
const gone = await req(`/api/item/${itemId}/delete`, { method: 'POST', ...adm });
assert.equal(gone.status, 200);
assert.equal((await galleryRepo.list(G)).length, 0, 'запис прибрано з БД');
ok('адміністратор видаляє публікацію');

stopWebServer();
console.log(`\n✅ Усі ${passed} перевірок сайту пройдено.`);
setTimeout(() => process.exit(0), 150);
