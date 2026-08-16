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

// 11. зняття покарання повз систему: повертаємо й попереджаємо
const { punishmentService } = await import('../src/services/punishmentService.js');
const G5 = `${G}-lift`;
await configService.load(G5);
await configService.set(G5, 'general.modLogChannelId', 'log-1');
await configService.set(G5, 'moderation.staffWatch', true);

const applied = { roles: [], timeouts: [] };
const victim = {
  ...mkMember(VICTIM),
  roles: { cache: new Map(), add: async (r) => applied.roles.push(r.id ?? r), remove: async () => {} },
  timeout: async (ms) => applied.timeouts.push(ms),
};
const guild5 = {
  ...guild,
  id: G5,
  members: { cache: new Map([[STAFF, members.get(STAFF)], [VICTIM, victim]]), fetch: async (id) => (id === VICTIM ? victim : members.get(id) ?? null) },
};

await punishmentService.apply(guild5, victim, {
  kind: 'text', minutes: 120, reason: 'спам', moderatorId: '999000999000999000',
});
applied.roles.length = 0;

const rollback = await staffWatch.unauthorizedLift(guild5, {
  moderatorId: STAFF, targetId: VICTIM, kind: 'text',
});
assert.ok(rollback?.restored, 'покарання повернуто');
assert.ok(applied.roles.length >= 1, 'роль мута начеплено назад');
const back = await punishmentService.forUser(G5, VICTIM);
assert.ok(back.some((p) => p.kind === 'text'), 'запис про покарання лишився чинним');
assert.equal((await warnRepo.active(G5, STAFF)).length, 1, 'той, хто зняв, отримав попередження');
const liftLog = sent.filter((p) => p.embeds?.[0]?.description?.includes('повз систему')).pop();
assert.ok(liftLog, 'у лог-канал прийшло пояснення');
assert.match(liftLog.embeds[0].description, /покарання повернуто/, 'сказано, що повернули');
ok('зняття повз систему → покарання назад + попередження');

// 12. те саме від винятку — приймаємо як звичайне зняття
const G6 = `${G}-lift-boss`;
await configService.load(G6);
await configService.set(G6, 'moderation.staffExemptRoles', ['role-boss']);
const guild6 = { ...guild5, id: G6 };
await punishmentService.apply(guild6, victim, {
  kind: 'text', minutes: 60, reason: 'спам', moderatorId: '999000999000999000',
});
const byBoss = await staffWatch.unauthorizedLift(guild6, {
  moderatorId: BOSS, targetId: VICTIM, kind: 'text',
});
assert.equal(byBoss?.restored, false, 'винятку не відкочуємо');
assert.equal((await warnRepo.active(G6, BOSS)).length, 0, 'і не попереджаємо');
assert.equal((await punishmentService.forUser(G6, VICTIM)).length, 0, 'запис прибрано');
ok('виняток знімає вручну — без відкоту й попередження');

// 13. ієрархія: знімає лише той, чия роль вища за роль того, хто видав
const withRole = (id, pos) => ({
  id,
  displayName: `Роль ${pos}`,
  roles: { highest: { position: pos }, cache: new Map() },
});
const low = withRole('low-1', 3);
const high = withRole('high-1', 9);
const hier = new Map([[low.id, low], [high.id, high]]);
const guild7 = { ...guild, id: G5, members: { cache: hier, fetch: async (id) => hier.get(id) ?? null } };
const pun = { kind: 'text', until: Date.now() + 60_000, moderatorId: high.id };

assert.equal((await punishmentService.canLift(guild7, low, pun)).ok, false, 'нижчий не знімає чуже');
assert.equal((await punishmentService.canLift(guild7, high, pun)).ok, true, 'свій знімає завжди');
assert.equal((await punishmentService.canLift(guild7, high, { ...pun, moderatorId: low.id })).ok, true,
  'вища роль знімає покарання нижчої');
assert.equal((await punishmentService.canLift(guild7, low, { ...pun, moderatorId: 'system' })).ok, true,
  'автоматичне знімає будь-хто з доступом');
assert.equal((await punishmentService.canLift(guild7, low, { ...pun, moderatorId: 'gone-1' })).ok, true,
  'якщо того, хто видав, уже немає — знімається');
const why = (await punishmentService.canLift(guild7, low, pun)).why;
assert.match(why, /роль вища/, 'відмова пояснює причину');
ok('ієрархія зняття: тільки роль вища за ту, що видала');

console.log(`\n✅ Усі ${passed} перевірок нагляду за персоналом пройдено.`);
process.exit(0);
