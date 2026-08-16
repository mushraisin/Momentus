/**
 * Перевірка «дротів»: кожна кнопка й селектор мають долітати до обробника.
 *
 * Саме тут ловиться помилка, через яку панель модерації мовчала:
 * простір імен був неоголошений, і customId починався з порожнього рядка.
 */
import 'dotenv/config';
import assert from 'node:assert';
import { initDatabase } from '../src/database/db.js';

await initDatabase();
const { NS } = await import('../src/config/constants.js');
const { parseCid } = await import('../src/ui/components.js');
const { configService } = await import('../src/services/configService.js');
const panels = await import('../src/ui/panels.js');
const admin = await import('../src/ui/adminPanel.js');
const mod = await import('../src/ui/modPanel.js');

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

const G = `web-wire-${Date.now()}`;
await configService.load(G);

const guild = {
  id: G,
  name: 'Тест',
  iconURL: () => null,          // embeds беруть іконку гільдії
  roles: { cache: new Map() },
  channels: { cache: new Map() },
  members: { cache: new Map(), fetch: async () => null },
};
const member = { id: '1', guild, permissions: { has: () => true }, roles: { cache: new Map() } };

// 1. кожен простір імен оголошений і унікальний
const values = Object.values(NS);
assert.ok(values.every((v) => typeof v === 'string' && v.length), 'усі NS визначені');
assert.equal(new Set(values).size, values.length, 'без дублікатів');
ok(`простори імен: ${values.join(', ')}`);

/** Збираємо всі customId з панелі. */
function idsOf(payload) {
  return payload.components.flatMap((row) => row.toJSON().components)
    .map((c) => c.custom_id)
    .filter(Boolean);
}

// 2. жоден customId не має порожнього простору імен
const screens = {
  'панель для всіх': panels.hubPanel(guild),
  'майстер: канали': admin.setupPanel(guild, 0),
  'майстер: медіа': admin.setupPanel(guild, 1),
  'канал модерації': panels.modEntryPanel(guild),
  'адмін-панель': await admin.adminHome(guild),
  'розділ конфігу': admin.adminGroup(guild, 'moderation'),
  'модерація: головна': mod.modHome(guild, member),
  'модерація: учасник': await mod.modTarget(guild, '999888777666555444', member),
  'модерація: термін': mod.modDuration(guild, '999888777666555444', 'text', member),
};

const known = new Set(values);
for (const [name, payload] of Object.entries(screens)) {
  const ids = idsOf(payload);
  assert.ok(ids.length, `${name}: жодного елемента`);
  for (const id of ids) {
    assert.ok(!id.startsWith(':'), `${name}: порожній простір імен у «${id}»`);
    const { ns } = parseCid(id);
    assert.ok(known.has(ns), `${name}: невідомий простір імен «${ns}» у «${id}»`);
  }
}
ok(`усі ${Object.keys(screens).length} екранів мають робочі customId`);

// 3. кнопки модерації ведуть саме в свій обробник
const targetIds = idsOf(await mod.modTarget(guild, '999888777666555444', member));
for (const kind of ['text', 'voice', 'full']) {
  const btn = targetIds.find((id) => id === `${NS.MOD}:ask:999888777666555444:${kind}`);
  assert.ok(btn, `кнопка «${kind}» веде в обробник модерації`);
}
assert.ok(targetIds.some((id) => id.startsWith(`${NS.MOD}:lift:`)), 'кнопка зняття');
ok('кнопки мутів прив\'язані до обробника');

// 4. типи селекторів, які роутер мусить приймати
const homeRows = mod.modHome(guild, member).components.map((r) => r.toJSON());
const selectTypes = homeRows.flatMap((r) => r.components).map((c) => c.type).filter((t) => t !== 2);
assert.ok(selectTypes.includes(5), 'вибір учасника — селектор типу 5 (user)');
ok('селектор учасника присутній — роутер має його приймати');

console.log(`\n✅ Усі ${passed} перевірок звʼязності пройдено.`);
process.exit(0);
