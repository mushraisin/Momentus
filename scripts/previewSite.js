/** Локальне превʼю сайту з демо-галереєю (нічого не пише в бойову БД, окрім web-* гільдії). */
import 'dotenv/config';
import { initDatabase } from '../src/database/db.js';

process.env.WEB_PORT = '8123';
process.env.WEB_PUBLIC_URL = '';
await initDatabase();

const base = '../src';
const { usersRepo, sessionsRepo, galleryRepo } = await import(`${base}/database/repositories.js`);
const { configService } = await import(`${base}/services/configService.js`);
const { startWebServer } = await import(`${base}/web/server.js`);

const G = `web-preview`;
await configService.load(G);
await usersRepo.ensure(G, '574231866396114944', 'kosta', Date.now() - 100 * 86400_000);

// маленькі кольорові PNG як демо-медіа
const PNG = (hex) => Buffer.from(
  `iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==`,
  'base64',
);

const existing = await galleryRepo.list(G, { limit: 5 });
if (!existing.length) {
  for (let i = 0; i < 7; i++) {
    await galleryRepo.add({
      guildId: G, userId: '574231866396114944', username: 'kosta',
      title: i % 2 ? `Кліп №${i + 1} — вечірній рейд` : null,
      kind: 'image', mime: 'image/png', sizeBytes: 70,
      content: PNG().toString('base64'), storage: 'db',
    });
  }
  const items = await galleryRepo.list(G, { limit: 10 });
  for (const [n, it] of items.entries()) {
    for (let k = 0; k <= n; k++) await galleryRepo.toggleLike(Number(it.id), `fake-${k}`);
  }
}

const SID = 'preview-session';
await sessionsRepo.remove(SID).catch(() => {});
await sessionsRepo.create({ token: SID, guildId: G, userId: '574231866396114944', username: 'kosta', avatar: null, ttlMs: 3600_000 });

// голосовий канал кінотеатру з парою «глядачів»
const me = { id: '574231866396114944', displayName: 'kosta', user: { displayAvatarURL: () => 'https://cdn.discordapp.com/embed/avatars/1.png' } };
const voice = { id: 'vc-1', name: 'Кінозал', members: new Map([[me.id, me]]) };
await configService.set(G, 'cinema.voiceChannelId', 'vc-1');

const guild = {
  id: G, name: 'Задрипанка', premiumTier: 0,
  members: { cache: new Map(), fetch: async () => null },
  roles: { cache: new Map() },
  channels: { cache: new Map([['vc-1', voice]]), fetch: async () => null },
};
startWebServer({ guilds: { cache: new Map([[G, guild]]) } });
console.log(`\nhttp://127.0.0.1:8123/   cookie sid=${SID}\n`);
