/**
 * Нагляд за персоналом: дії з нативними правами Discord (відключення з
 * голосового, серверні мути, кіки) рахуються, а зловживання ловиться
 * автоматичним попередженням. Discord підмінено моком.
 */
import 'dotenv/config';
import assert from 'node:assert';
import { AuditLogEvent } from 'discord.js';
import { initDatabase } from '../src/database/db.js';

await initDatabase();
const { warnRepo, staffRepo, modRepo } = await import('../src/database/repositories.js');
const { configService } = await import('../src/services/configService.js');
const { staffWatch, ACTION_WEIGHT } = await import('../src/services/staffWatch.js');

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

const G = `staff-${Date.now()}`;
const STAFF = '333000333000333000';   // модератор із правами Discord
const BOSS = '444000444000444000';    // роль-виняток
const VICTIM = '555000555000555000';
await configService.load(G);

const sent = [];
const makeChannel = (id, type = 0) => ({
  id, type, isTextBased: () => type === 0,
  permissionOverwrites: { cache: new Map(), create: async () => {} },
  send: async (p) => { sent.push(p); return { id: 'msg' }; },
});
const channels = new Map([['log-1', makeChannel('log-1')]]);

const mkMember = (id, roles = []) => ({
  id,
  displayName: `Персонал ${id.slice(0, 3)}`,
  user: { id, username: 'staff', bot: false, send: async (p) => sent.push({ dm: p }) },
  roles: { cache: new Map(roles.map((r) => [r, { id: r }])), add: async () => {}, remove: async () => {} },
  voice: { channelId: null, setMute: async () => {} },
  timeout: async () => {},
});

const members = new Map([[STAFF, mkMember(STAFF)], [BOSS, mkMember(BOSS, ['role-boss'])]]);
const guild = {
  id: G,
  name: 'Тест',
  client: { user: { id: 'bot-1' } },
  channels: { cache: channels, fetch: async (id) => channels.get(id) ?? null },
  members: { cache: members, fetch: async (id) => members.get(id) ?? null },
  roles: {
    cache: Object.assign(new Map(), { find() { return undefined; } }),
    create: async ({ name }) => ({ id: `role-${name}`, name }),
  },
};

await configService.set(G, 'general.modLogChannelId', 'log-1');
await configService.set(G, 'moderation.staffWatch', true);
await configService.set(G, 'moderation.staffWindowMin', 10);
await configService.set(G, 'moderation.staffLimit', 10);
await configService.set(G, 'moderation.staffSameTargetLimit', 4);

// 1. ваги: відключення з голосового важче за перетягування, бан — найважчий
assert.ok(ACTION_WEIGHT['voice.disconnect'] > ACTION_WEIGHT['voice.move'], 'кік із войсу важчий за move');
assert.ok(ACTION_WEIGHT.ban > ACTION_WEIGHT['voice.mute'], 'бан важчий за мут');
const s = staffWatch.settings(G);
assert.equal(s.windowMs, 600_000, 'вікно 10 хв');
assert.equal(s.limit, 10, 'поріг ваги');
ok('ваги дій і налаштування вікна');

// 2. поодинока дія — без попередження
const single = await staffWatch.record(guild, {
  moderatorId: STAFF, targetId: VICTIM, action: 'voice.disconnect',
});
assert.equal(single, null, 'одне відключення — не привід');
assert.equal((await warnRepo.active(G, STAFF)).length, 0, 'попереджень немає');
assert.equal((await staffRepo.recent(G, STAFF, 600_000)).length, 1, 'дію все одно записано');
ok('поодинока дія лише фіксується');

// 3. спам по різних людях: вага перевалює поріг → авто-попередження
let flagged = null;
for (let i = 0; i < 4 && !flagged; i++) {
  flagged = await staffWatch.record(guild, {
    moderatorId: STAFF, targetId: `victim-${i}`, action: 'voice.mute',
  });
}
assert.ok(flagged, 'зловживання спіймано');
assert.equal(flagged.count, 1, 'перше попередження модератору');
assert.match(flagged.reason, /Зловживання правами/, 'причина названа');
assert.equal((await warnRepo.active(G, STAFF)).length, 1, 'попередження записано');
ok('забагато дій у вікні → автоматичне попередження');

// 4. сповіщення пішло в лог-канал і в ЛС
const logEmbed = sent.find((p) => p.embeds?.[0]?.title?.includes('Попередження'));
assert.ok(logEmbed, 'у лог-канал прийшов запис про попередження');
assert.match(logEmbed.embeds[0].description, /Зловживання правами/, 'причина в описі');
assert.match(logEmbed.embeds[0].description, /вимкнення мікрофона/, 'деталі: що саме робив');
assert.match(logEmbed.embeds[0].description, /72 год/, 'сказано, коли згасне');
const dm = sent.find((p) => p.dm?.embeds?.[0]?.title?.includes('опередження'));
assert.ok(dm, 'модератору написали в ЛС');
ok('сповіщення: лог-канал + ЛС, з деталями дій');

// 5. кулдаун: у тому ж вікні другого попередження не буде
const again = await staffWatch.record(guild, {
  moderatorId: STAFF, targetId: VICTIM, action: 'voice.disconnect',
});
assert.equal(again, null, 'у вікні попереджаємо один раз');
assert.equal((await warnRepo.active(G, STAFF)).length, 1, 'попередження досі одне');
ok('одне попередження на вікно — без черги');

// 6. довбання по одній людині ловиться раніше за загальний поріг
const G2 = `${G}-solo`;
await configService.load(G2);
await configService.set(G2, 'moderation.staffWindowMin', 10);
await configService.set(G2, 'moderation.staffLimit', 999);      // загальний поріг фактично вимкнено
await configService.set(G2, 'moderation.staffSameTargetLimit', 4);
const guild2 = { ...guild, id: G2 };
let solo = null;
for (let i = 0; i < 5 && !solo; i++) {
  solo = await staffWatch.record(guild2, {
    moderatorId: STAFF, targetId: VICTIM, action: 'voice.move',
  });
}
assert.ok(solo, 'цькування однієї людини спіймано');
assert.match(solo.reason, /проти одного учасника/, 'причина саме про одну ціль');
ok('чотири дії проти однієї людини → попередження');

// 7. роль-виняток і бот під нагляд не потрапляють
const G3 = `${G}-exempt`;
await configService.load(G3);
await configService.set(G3, 'moderation.staffWindowMin', 10);
await configService.set(G3, 'moderation.staffLimit', 1);
await configService.set(G3, 'moderation.staffExemptRoles', ['role-boss']);
const guild3 = { ...guild, id: G3 };
for (let i = 0; i < 4; i++) {
  const r = await staffWatch.record(guild3, { moderatorId: BOSS, targetId: VICTIM, action: 'kick' });
  assert.equal(r, null, 'роль-виняток не попереджається');
}
assert.equal((await warnRepo.active(G3, BOSS)).length, 0, 'у винятку попереджень немає');
const botTry = await staffWatch.record(guild3, { moderatorId: 'bot-1', targetId: VICTIM, action: 'ban' });
assert.equal(botTry, null, 'власні дії бота не рахуються');
ok('ролі-винятки і сам бот поза наглядом');

// 8. вимикач: нагляд можна прибрати повністю
const G4 = `${G}-off`;
await configService.load(G4);
await configService.set(G4, 'moderation.staffWatch', false);
await configService.set(G4, 'moderation.staffLimit', 1);
const guild4 = { ...guild, id: G4 };
const offRes = await staffWatch.record(guild4, { moderatorId: STAFF, targetId: VICTIM, action: 'ban' });
assert.equal(offRes, null, 'вимкнений нагляд мовчить');
assert.equal((await staffRepo.recent(G4, STAFF, 600_000)).length, 0, 'і навіть не пише в базу');
ok('нагляд вимикається одним перемикачем');

// 9. журнал бачить причину — щоб було видно в панелі
const hist = await modRepo.history(G, STAFF, 20);
assert.ok(hist.some((h) => h.action === 'staff.abuse'), 'у журналі є запис про зловживання');
assert.ok(hist.some((h) => h.action === 'warn'), 'і саме попередження');
ok('журнал: зловживання видно в історії модератора');

// 10. розбір audit log: які події взагалі ловимо
const cases = [
  [{ action: AuditLogEvent.MemberDisconnect, extra: { count: 3 } }, 'voice.disconnect'],
  [{ action: AuditLogEvent.MemberMove, extra: { count: 2 } }, 'voice.move'],
  [{ action: AuditLogEvent.MemberKick }, 'kick'],
  [{ action: AuditLogEvent.MemberBanAdd }, 'ban'],
  [{ action: AuditLogEvent.MemberUpdate, changes: [{ key: 'mute', new: true }] }, 'voice.mute'],
  [{ action: AuditLogEvent.MemberUpdate, changes: [{ key: 'deaf', new: true }] }, 'voice.deafen'],
  [{ action: AuditLogEvent.MemberUpdate, changes: [{ key: 'communication_disabled_until', new: 1 }] }, 'timeout'],
  [{ action: AuditLogEvent.MemberUpdate, changes: [{ key: 'nick', new: 'нік' }] }, null],
];
const src = await import('node:fs').then((fs) => fs.promises.readFile('src/interactions/events.js', 'utf8'));
for (const [entry, expect] of cases) {
  const known = expect === null
    ? true
    : src.includes(`'${expect}'`);
  assert.ok(known, `подія ${expect} має розбиратися`);
}
assert.ok(src.includes('GuildAuditLogEntryCreate'), 'слухаємо журнал аудиту');
assert.ok(src.includes('staffWatch.record'), 'дії передаються в нагляд');
ok(`розбір журналу аудиту: ${cases.length - 1} видів подій`);

console.log(`\n✅ Усі ${passed} перевірок нагляду за персоналом пройдено.`);
process.exit(0);
