/**
 * Демо-стенд усього сайту — без Discord і без бойової бази.
 *
 * Піднімає сервер із вигаданим сервером, учасниками, галереєю, покупками
 * й записами модерації, щоб можна було відкрити кожну сторінку й дивитись
 * на неї наживо, а не уявляти за розміткою.
 *
 *   node scripts/previewSite.js
 *
 * Дані лягають у власний файл (data/preview-site.db).
 */
import 'dotenv/config';

process.env.TURSO_DATABASE_URL = '';
process.env.TURSO_AUTH_TOKEN = '';
process.env.DATABASE_PATH = './data/preview-site.db';
process.env.WEB_PORT = process.env.WEB_PORT || '8124';
process.env.WEB_PUBLIC_URL = '';

const { initDatabase } = await import('../src/database/db.js');
await initDatabase();

const {
  usersRepo, sessionsRepo, prefsRepo, walletRepo, assetsRepo, galleryRepo,
  itemsRepo, modRepo, punishRepo, warnRepo, activityRepo, duelRepo,
} = await import('../src/database/repositories.js');
const { configService } = await import('../src/services/configService.js');
const { reputationService } = await import('../src/services/reputationService.js');
const { startWebServer } = await import('../src/web/server.js');

const G = 'preview-site';
const ME = '574231866396114944';
await configService.load(G);
await configService.set(G, 'access.adminRoleIds', ['role-admin']);

const AVATAR = 'https://cdn.discordapp.com/embed/avatars/1.png';
const members = new Map();

const PEOPLE = [
  { id: ME, name: 'Костя', messages: 620, accent: '#a8e05f', level: 7, about: 'Тримаю тут лад і монтую ролики.' },
  { id: '201', name: 'Ліна', messages: 480, accent: '#ff7f6e', level: 5, about: 'Малюю, коли не сплю.' },
  { id: '202', name: 'Марко', messages: 360, accent: '#5aa9ff', level: 4, about: '' },
  { id: '203', name: 'Оля', messages: 300, accent: '#f0a44a', level: 3, about: 'Люблю довгі голосові.' },
  { id: '204', name: 'Тарас', messages: 190, accent: null, level: 2, about: '' },
  { id: '205', name: 'Іра', messages: 120, accent: null, level: 1, about: '' },
  { id: '206', name: 'Дем', messages: 70, accent: null, level: 1, about: '' },
];

for (const p of PEOPLE) {
  await usersRepo.ensure(G, p.id, p.name, Date.now() - 300 * 86400_000);
  await usersRepo.bump(G, p.id, 'total_messages', p.messages);
  await usersRepo.bump(G, p.id, 'voice_minutes', Math.round(p.messages * 2.4));
  await usersRepo.bump(G, p.id, 'reactions_given', Math.round(p.messages / 3));
  await usersRepo.bump(G, p.id, 'votes_got', Math.max(0, 9 - PEOPLE.indexOf(p) * 2));
  for (let d = 0; d < 26; d++) {
    const day = new Date(Date.now() - d * 86400_000).toISOString().slice(0, 10);
    await activityRepo.bump(G, p.id, 'messages', Math.round(4 + Math.abs(Math.sin(d + p.messages)) * 22), day);
    await activityRepo.bump(G, p.id, 'voice_minutes', Math.round(Math.abs(Math.cos(d)) * 40), day);
  }
  await reputationService.recompute(G, p.id);
  await walletRepo.add(G, p.id, 140);
  for (let i = 1; i < p.level; i++) await walletRepo.levelUp(G, p.id, 1);

  const banner = await assetsRepo.add(G, p.id, {
    kind: 'banner', mime: 'image/png', sizeBytes: 1, objectKey: `demo/b${p.id}`,
  });
  await prefsRepo.save(G, p.id, { accent: p.accent, banner: `asset:${banner}`, about: p.about });

  members.set(p.id, {
    id: p.id,
    displayName: p.name,
    user: { bot: false, avatar: null, displayAvatarURL: () => AVATAR },
    roles: { cache: new Map() },
    permissions: { has: () => p.id === ME },
    guild: { id: G },
  });
}

// ── магазин: щось уже куплено, щоб гардероб не був порожній ──
for (const item of ['pack.solid', 'accent.lime', 'accent.mint', 'accent.gold', 'frame.mint', 'frame.gold', 'card.glass', 'card.soft', 'grad.aurora', 'grad.teal']) {
  await itemsRepo.give(G, ME, item, 0);
}
await prefsRepo.save(G, ME, { accent: '#a8e05f', layout: { frame: 'frame.mint', card: 'card.glass' } });

// ── галерея: кілька публікацій із різними підписами ──
const PIC = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SHOTS = [
  ['Нічний Київ з даху', '201'], ['Ескіз персонажа', '201'], ['Кіт сусідів', '203'],
  ['Схема збірки', '202'], ['Знайшов у шафі', '204'], ['Перший рендер', '202'],
  ['Ранок після стріму', ME], ['Прогулянка', '205'],
];
for (const [title, uid] of SHOTS) {
  const who = PEOPLE.find((p) => p.id === uid);
  const id = await galleryRepo.add({
    guildId: G, userId: uid, username: who.name, avatar: null, title,
    kind: 'image', mime: 'image/png', sizeBytes: 120_000, content: PIC,
  });
  for (const p of PEOPLE.slice(0, 4)) await galleryRepo.toggleLike(id, p.id).catch(() => {});
}

// ── модерація: журнал і чинні покарання ──
for (const [uid, action, reason] of [
  ['204', 'warn', 'реклама в загальному'],
  ['205', 'mute.text', 'капс і флуд'],
  ['206', 'warn', 'сварка в голосовому'],
  ['204', 'unmute', ''],
]) {
  await modRepo.add({ guildId: G, userId: uid, moderatorId: ME, action, reason, result: 'applied' });
}
await warnRepo.add(G, '204', { reason: 'реклама в загальному', moderatorId: ME });
await punishRepo.set({
  guildId: G, userId: '205', kind: 'text', until: Date.now() + 3600_000,
  reason: 'капс і флуд', moderatorId: ME,
});

// Вибір для голосування чекає на нас — щоб вікно відкрилось одразу.
// SMALL=1 лишає одного кандидата: так виглядає маленький сервер.
await duelRepo.set(G, ME, '201', process.env.SMALL ? null : '202', process.env.SMALL ? null : '203');

const SID = 'preview-site-session';
await sessionsRepo.remove(SID).catch(() => {});
await sessionsRepo.create({
  token: SID, guildId: G, userId: ME, username: 'Костя', avatar: null, ttlMs: 12 * 3600_000,
});

const guild = {
  id: G,
  name: 'Задрипанка',
  premiumTier: 2,
  iconURL: () => AVATAR,
  members: { cache: members, fetch: async (id) => members.get(id) ?? null, me: { roles: { highest: { position: 90 } } } },
  roles: { cache: new Map() },
  channels: { cache: new Map(), fetch: async () => null },
};
startWebServer({ guilds: { cache: new Map([[G, guild]]) } });

const url = `http://127.0.0.1:${process.env.WEB_PORT}`;
console.log(`
── Демо-стенд сайту ──

  ${url}/            головна
  ${url}/top         рейтинг
  ${url}/me          свій профіль
  ${url}/u/201       чужий профіль
  ${url}/gallery     галерея
  ${url}/shop        магазин
  ${url}/mod         модерація

Cookie для входу:  document.cookie='sid=${SID}; path=/'
`);
