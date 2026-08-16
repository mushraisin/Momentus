/**
 * Модерація: три види мутів, ліміти за рівнем доступу, автозняття за часом.
 * Discord підмінено моком — перевіряємо саме логіку, а не мережу.
 */
import 'dotenv/config';
import assert from 'node:assert';
import { initDatabase } from '../src/database/db.js';

await initDatabase();
const { punishRepo, modRepo } = await import('../src/database/repositories.js');
const { configService } = await import('../src/services/configService.js');
const { punishmentService, KIND_LABEL } = await import('../src/services/punishmentService.js');

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

const G = `web-mod-${Date.now()}`;
const USER = '111000111000111000';
const MOD = '222000222000222000';
await configService.load(G);

// ── мок гільдії: рахуємо, що саме бот зробив ──
const done = { rolesAdded: [], rolesRemoved: [], timeouts: [], voiceMutes: [], overwrites: 0, sent: [] };

const makeChannel = (id, name, type) => ({
  id,
  name,
  type,
  isTextBased: () => type === 0,
  permissionOverwrites: {
    cache: new Map(),
    create: async () => { done.overwrites += 1; },
  },
  send: async (payload) => { done.sent.push(payload); return { id: 'msg' }; },
});

const channels = new Map([
  ['text-1', makeChannel('text-1', 'загальний', 0)],   // GuildText
  ['voice-1', makeChannel('voice-1', 'голосовий', 2)], // GuildVoice
  ['log-1', makeChannel('log-1', 'модерація', 0)],
]);

const member = {
  id: USER,
  displayName: 'Порушник',
  user: { id: USER, username: 'Порушник', send: async (p) => done.sent.push({ dm: p }) },
  roles: {
    cache: new Map(),
    add: async (role) => { done.rolesAdded.push(role.id ?? role); },
    remove: async (roleId) => { done.rolesRemoved.push(roleId); },
  },
  voice: { channelId: 'voice-1', setMute: async (on) => done.voiceMutes.push(on) },
  timeout: async (ms) => { done.timeouts.push(ms); },
};

const guild = {
  id: G,
  name: 'Тест',
  channels: { cache: channels, fetch: async (id) => channels.get(id) ?? null },
  members: { cache: new Map([[USER, member]]), fetch: async () => member },
  roles: {
    // у discord.js це Collection — у неї є find(), тож мок теж має його мати
    cache: Object.assign(new Map(), {
      find(fn) {
        for (const v of this.values()) if (fn(v)) return v;
        return undefined;
      },
    }),
    create: async ({ name }) => {
      const role = { id: `role-${name}`, name };
      guild.roles.cache.set(role.id, role);
      return role;
    },
  },
};

// 1. ліміти за рівнем доступу
await configService.set(G, 'moderation.maxMinutesModerator', 1440);
await configService.set(G, 'moderation.maxMinutesAdmin', 0);
assert.equal(punishmentService.limitMinutes(G, 1), 1440, 'модератору — доба');
assert.equal(punishmentService.limitMinutes(G, 2), 0, 'адміну — без обмежень');
assert.equal(punishmentService.withinLimit(G, 1, 60), true, 'година модератору можна');
assert.equal(punishmentService.withinLimit(G, 1, 10080), false, 'тиждень — ні');
assert.equal(punishmentService.withinLimit(G, 1, 0), false, '«назавжди» модератору не можна');
assert.equal(punishmentService.withinLimit(G, 3, 0), true, 'власнику можна все');
ok('ліміти термінів за рівнем доступу');

// 2. текстовий мут: роль + заборони по каналах, голос не чіпаємо
await punishmentService.apply(guild, member, { kind: 'text', minutes: 60, reason: 'спам', moderatorId: MOD });
assert.ok(done.rolesAdded.includes('role-Мут: текст'), 'видано роль текстового мута');
assert.ok(done.overwrites >= 2, `заборони розставлено по каналах (${done.overwrites})`);
assert.equal(done.voiceMutes.length, 0, 'голос не чіпали');
assert.equal(done.timeouts.length, 0, 'timeout не викликали');

const [textPun] = await punishRepo.forUser(G, USER);
assert.equal(textPun.kind, 'text');
assert.ok(textPun.until > Date.now(), 'термін збережено');
ok('текстовий мут: пише — ні, говорить — так');

// 3. голосовий мут окремо
await punishmentService.apply(guild, member, { kind: 'voice', minutes: 30, reason: 'крик', moderatorId: MOD });
assert.ok(done.rolesAdded.includes('role-Мут: голос'), 'видано роль голосового мута');
assert.deepEqual(done.voiceMutes, [true], 'заглушено в поточному каналі');
assert.equal((await punishRepo.forUser(G, USER)).length, 2, 'два різні покарання одночасно');
ok('голосовий мут: говорить — ні, пише й сидить у каналі — так');

// 4. повний мут — рідний timeout Discord
await punishmentService.apply(guild, member, { kind: 'full', minutes: 15, reason: 'все разом', moderatorId: MOD });
assert.equal(done.timeouts.length, 1, 'викликано timeout');
assert.equal(done.timeouts[0], 15 * 60_000, 'на 15 хвилин');
ok('повний мут через timeout — і з голосового виганяє');

// 5. журнал пише кожну дію
const history = await modRepo.history(G, USER, 10);
assert.ok(history.length >= 3, 'дії в журналі');
assert.ok(history.some((h) => h.action === 'mute.text' && h.reason === 'спам'), 'причина збережена');
assert.ok(history.every((h) => h.moderator_id === MOD), 'видно, хто покарав');
ok('журнал: хто, кого, за що й наскільки');

// 6. сповіщення в канал і в ЛС
await configService.set(G, 'general.modLogChannelId', 'log-1');
await configService.set(G, 'moderation.dmOnPunish', true);
done.sent.length = 0;
await punishmentService.notify(guild, {
  target: member.user, moderator: MOD, kind: 'text', minutes: 60, reason: 'спам',
});
assert.equal(done.sent.filter((s) => !s.dm).length, 1, 'запис у лог-канал');
assert.equal(done.sent.filter((s) => s.dm).length, 1, 'лист покараному');
const logEmbed = done.sent.find((s) => !s.dm).embeds[0];
assert.ok(logEmbed.description.includes(USER) && logEmbed.description.includes(MOD), 'у записі є обидва');
assert.ok(logEmbed.description.includes('спам'), 'і причина');
ok('сповіщення: лог-канал і ЛС покараному');

// 7. час вийшов — знімається саме
await punishRepo.set({ guildId: G, userId: USER, kind: 'text', until: Date.now() - 1000, moderatorId: MOD });
const expired = await punishRepo.expired();
assert.ok(expired.some((p) => p.userId === USER), 'прострочене видно');

done.rolesRemoved.length = 0;
await punishmentService.liftExpired({ guilds: { cache: new Map([[G, guild]]) } });
assert.equal((await punishRepo.forUser(G, USER)).filter((p) => p.kind === 'text').length, 0, 'запис прибрано');
ok('покарання знімається саме, щойно вийшов час');

// 8. зняття вручну прибирає все
await punishmentService.lift(guild, USER, 'all', MOD);
assert.equal((await punishRepo.forUser(G, USER)).length, 0, 'чистий аркуш');
assert.ok(KIND_LABEL.text && KIND_LABEL.voice && KIND_LABEL.full, 'назви для інтерфейсу є');
ok('зняття вручну прибирає всі покарання одразу');

await punishRepo.removeAll(G, USER);
console.log(`\n✅ Усі ${passed} перевірок модерації пройдено.`);
process.exit(0);
