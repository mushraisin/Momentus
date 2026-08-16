/** Статус бота: що показує й як часто оновлює. */
import 'dotenv/config';
import assert from 'node:assert';
import { initDatabase } from '../src/database/db.js';

await initDatabase();
const { cinemaRepo } = await import('../src/database/repositories.js');
const { startPresence, stopPresence } = await import('../src/services/presenceService.js');

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

const G = `web-presence-${Date.now()}`;
process.env.WEB_GUILD_ID = G;

// мок клієнта: запамʼятовує, що йому виставили
const calls = [];
const client = {
  user: { setPresence: (p) => calls.push(p) },
  guilds: { cache: new Map([[G, { id: G }]]) },
};
const текст = () => calls.at(-1)?.activities?.[0]?.name ?? null;
const пауза = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. нічого не йде — активності немає
startPresence(client);
await пауза(300);
assert.equal(текст(), null, 'без сеансу статус порожній');
ok('порожній зал — бот просто «онлайн»');

// 2. запущено відео: назва й час
await cinemaRepo.save(G, {
  source: 'https://cdn/x.m3u8', title: 'Аватар', provider: 'hls',
  playing: true, positionMs: 125_000, updatedBy: 'test',
});
stopPresence();
startPresence(client);
await пауза(300);
const live = текст();
assert.ok(live.startsWith('Аватар · '), `назва у статусі, отримали: ${live}`);
assert.ok(/· \d+:\d{2}$/.test(live), 'час у статусі, без зайвих підписів');
const secs = Number(live.split(':').at(-1));
assert.ok(secs >= 5 && secs <= 8, `час іде від збереженої позиції (2:0X), отримали ${live}`);
ok(`під час показу: «${live}»`);

// довга назва не має вилізти за ліміт Discord у 128 символів
await cinemaRepo.save(G, {
  source: 'https://cdn/x.m3u8', title: 'Д'.repeat(300), provider: 'hls',
  playing: true, positionMs: 0, updatedBy: 'test',
});
stopPresence();
startPresence(client);
await пауза(300);
assert.ok(текст().length <= 128, `вкладаємось у ліміт: ${текст().length}`);

ok(`довга назва обрізається (${текст().length} символів)`);

// 3. пауза позначається окремо
await cinemaRepo.save(G, {
  source: 'https://cdn/x.m3u8', title: 'Аватар', provider: 'hls',
  playing: false, positionMs: 3_725_000, updatedBy: 'test',
});
stopPresence();
startPresence(client);
await пауза(300);
assert.equal(текст(), '⏸ Аватар · 1:02:05', 'пауза й години');
ok(`на паузі: «${текст()}»`);

// 4. однаковий текст не шлють двічі — інакше Discord обріже за лімітом
const before = calls.length;
await пауза(600);
assert.equal(calls.length, before, 'повторних запитів немає');
ok('без змін — статус не чіпаємо (ліміт Discord)');

// 5. сеанс завершено — активність знімається
await cinemaRepo.clear(G);
stopPresence();
startPresence(client);
await пауза(300);
assert.equal(текст(), null, 'після завершення статус чистий');
ok('сеанс завершено — активність знято');

stopPresence();
await cinemaRepo.clear(G);
console.log(`\n✅ Усі ${passed} перевірок статусу пройдено.`);
process.exit(0);
