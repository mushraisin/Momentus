/**
 * Демонстрація голосування й сповіщень про ✨FP — без Discord і без бойової бази.
 *
 * Піднімає сайт із кількома вигаданими учасниками, готовим вибором для
 * голосування та двома непобаченими сповіщеннями (голос від людини й нагорода
 * за перше місце). Достатньо відкрити адресу, яку виведе скрипт.
 *
 *   node scripts/previewVote.js
 *
 * Дані лягають у власний файл (data/preview-vote.db) — бойової Turso це не чіпає.
 */
import 'dotenv/config';

// Своя база: демонстрація не має писати в те, чим користуються люди.
process.env.TURSO_DATABASE_URL = '';
process.env.TURSO_AUTH_TOKEN = '';
process.env.DATABASE_PATH = process.env.DATABASE_PATH || './data/preview-vote.db';
process.env.WEB_PORT = process.env.WEB_PORT || '8123';
process.env.WEB_PUBLIC_URL = '';

const { initDatabase } = await import('../src/database/db.js');
await initDatabase();

const {
  usersRepo, sessionsRepo, prefsRepo, walletRepo, voteInboxRepo, duelRepo, assetsRepo,
} = await import('../src/database/repositories.js');
const { configService } = await import('../src/services/configService.js');
const { reputationService } = await import('../src/services/reputationService.js');
const { startWebServer } = await import('../src/web/server.js');

const G = 'preview-vote';
const ME = '574231866396114944';
await configService.load(G);

const AVATAR = 'https://cdn.discordapp.com/embed/avatars/1.png';
const members = new Map();

/** Вигадані учасники: різні акценти, щоб було видно персоналізацію карток. */
const PEOPLE = [
  { id: ME, name: 'ви', messages: 420, accent: '#a8e05f', level: 4 },
  { id: '201', name: 'Ліна', messages: 380, accent: '#ff7f6e', level: 3 },
  { id: '202', name: 'Марко', messages: 300, accent: '#5aa9ff', level: 2 },
  { id: '203', name: 'Оля', messages: 240, accent: '#f0a44a', level: 2 },
  { id: '204', name: 'Тарас', messages: 160, accent: null, level: 1 },
  { id: '205', name: 'Іра', messages: 90, accent: null, level: 1 },
];

for (const p of PEOPLE) {
  await usersRepo.ensure(G, p.id, p.name, Date.now() - 300 * 86400_000);
  await usersRepo.bump(G, p.id, 'total_messages', p.messages);
  await usersRepo.bump(G, p.id, 'voice_minutes', p.messages * 3);
  await reputationService.recompute(G, p.id);
  await walletRepo.add(G, p.id, 50);
  for (let i = 1; i < p.level; i++) await walletRepo.levelUp(G, p.id, 1);

  // банер, щоб картки в рейтингу не були порожніми
  const banner = await assetsRepo.add(G, p.id, {
    kind: 'banner', mime: 'image/png', sizeBytes: 1, objectKey: `demo/${p.id}`,
  });
  await prefsRepo.save(G, p.id, {
    accent: p.accent, banner: `asset:${banner}`, about: `Демонстраційний профіль — ${p.name}`,
  });

  members.set(p.id, {
    id: p.id,
    displayName: p.name,
    user: { bot: false, avatar: null, displayAvatarURL: () => AVATAR },
    roles: { cache: new Map() },
    permissions: { has: () => false },
    guild: { id: G },
  });
}

// Вибір для голосування чекає на нас: вікно відкриється саме.
await duelRepo.set(G, ME, '201', '202', '203');

// Два сповіщення, які ще не бачили: голос від людини й нагорода за місце.
await voteInboxRepo.add(G, ME, '201');
await voteInboxRepo.add(G, ME, null, { kind: 'top', amount: 3, place: 1 });

const SID = 'preview-vote-session';
await sessionsRepo.remove(SID).catch(() => {});
await sessionsRepo.create({
  token: SID, guildId: G, userId: ME, username: 'ви', avatar: null, ttlMs: 6 * 3600_000,
});

const guild = {
  id: G,
  name: 'Задрипанка',
  premiumTier: 0,
  members: { cache: members, fetch: async (id) => members.get(id) ?? null },
  roles: { cache: new Map() },
  channels: { cache: new Map(), fetch: async () => null },
};
startWebServer({ guilds: { cache: new Map([[G, guild]]) } });

const url = `http://127.0.0.1:${process.env.WEB_PORT}`;
console.log(`
── Демонстрація ──

1. Відкрий:            ${url}/top
2. Постав cookie:      sid=${SID}
   (у консолі браузера: document.cookie='sid=${SID}; path=/'  і онови сторінку)

Що побачиш:
  • вікно голосування — троє на вибір, голос дає по ✨1FP обом;
  • спливаючі сповіщення — голос від Ліни (з аватаркою) і нагорода за 1 місце.

Сповіщення показуються ОДИН раз. Щоб побачити ще — перезапусти скрипт
або видали data/preview-vote.db.
`);
