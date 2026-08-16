/**
 * Панель бота: усі налаштування мають бути досяжними, а Discord має
 * прийняти розмітку (не більше 5 рядків і 5 кнопок у рядку).
 */
import 'dotenv/config';
import assert from 'node:assert';
import { initDatabase } from '../src/database/db.js';

await initDatabase();
const { configService } = await import('../src/services/configService.js');
const { CONFIG_SCHEMA } = await import('../src/config/defaults.js');
const admin = await import('../src/ui/adminPanel.js');

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

const G = `web-panel-${Date.now()}`;
await configService.load(G);

const guild = {
  id: G,
  name: 'Тест',
  roles: { cache: new Map() },
  channels: { cache: new Map() },
  members: { cache: new Map() },
};

/** Розмітку Discord приймає лише в межах лімітів. */
function checkLimits(payload, where) {
  const comps = payload.components.map((r) => r.toJSON());
  assert.ok(comps.length <= 5, `${where}: рядків ${comps.length} (максимум 5)`);
  for (const row of comps) {
    const kinds = row.components.map((c) => c.type);
    // 2 — кнопка, решта (3,5,6,8) — селектори, вони мають бути самі в рядку
    if (kinds.some((k) => k !== 2)) {
      assert.equal(row.components.length, 1, `${where}: селектор ділить рядок`);
    } else {
      assert.ok(row.components.length <= 5, `${where}: кнопок у рядку ${row.components.length}`);
    }
  }
  return comps;
}

// 1. головна: розділи однією кнопкою, а не списком
const home = await admin.adminHome(guild);
const homeComps = checkLimits(home, 'головна');
const homeIds = homeComps.flatMap((r) => r.components.map((c) => c.custom_id ?? ''));
assert.ok(homeIds.filter((id) => id.startsWith('adm:group:')).length >= 5, 'розділи кнопками');
assert.ok(!homeComps.some((r) => r.components.some((c) => c.type === 3)), 'списків на головній немає');
ok(`головна: ${homeIds.filter((i) => i.startsWith('adm:group:')).length} розділів по одному кліку`);

// 2. жодне налаштування не має загубитися через ліміти
const groups = new Set(Object.values(CONFIG_SCHEMA).map((f) => f.group));
const seen = new Set();
for (const g of groups) {
  const fields = Object.entries(CONFIG_SCHEMA).filter(([, f]) => f.group === g);
  let page = 0;
  for (;;) {
    const view = admin.adminGroup(guild, g, page);
    const comps = checkLimits(view, `розділ ${g}`);
    for (const row of comps) {
      for (const c of row.components) {
        const id = c.custom_id ?? '';
        const m = id.match(/^adm:(?:edit|toggle|setChannel|addRole|clearRoles):([^:]+)/);
        if (m) seen.add(m[1]);
        if (id.startsWith('adm:cycleLang')) seen.add('general.locale');
      }
    }
    // гортаємо, поки є наступна сторінка
    const hasNext = comps.some((r) => r.components.some(
      (c) => c.custom_id === `adm:group:${g}:${page + 1}` && !c.disabled,
    ));
    if (!hasNext) break;
    page += 1;
    assert.ok(page < 10, 'нескінченна пагінація');
  }

  for (const [key] of fields) {
    if (key === 'verification.tiers') continue;                 // редагується окремою панеллю
    assert.ok(seen.has(key), `${key} недосяжний у розділі ${g}`);
  }
}
ok(`усі ${seen.size} налаштувань досяжні, зокрема через сторінки`);

// 3. вимикачі перемикаються кнопкою, а не текстом
await configService.set(G, 'moderation.dmOnPunish', true);
const modView = admin.adminGroup(guild, 'moderation');
const toggle = modView.components.flatMap((r) => r.toJSON().components)
  .find((c) => c.custom_id?.startsWith('adm:toggle:moderation.dmOnPunish'));
assert.ok(toggle, 'кнопка-вимикач є');
assert.equal(toggle.style, 3, 'увімкнене — зелене');
await configService.set(G, 'moderation.dmOnPunish', false);
const off = admin.adminGroup(guild, 'moderation').components.flatMap((r) => r.toJSON().components)
  .find((c) => c.custom_id?.startsWith('adm:toggle:moderation.dmOnPunish'));
assert.equal(off.style, 2, 'вимкнене — сіре');
ok('вимикачі: клік замість вписування «true»');

// 4. канали й ролі — нативними селекторами
const mediaRows = admin.adminGroup(guild, 'media').components.map((r) => r.toJSON());
assert.ok(mediaRows.some((r) => r.components[0]?.type === 8), 'селектор каналу');
const accessRows = admin.adminGroup(guild, 'access').components.map((r) => r.toJSON());
assert.ok(accessRows.some((r) => r.components[0]?.type === 6), 'селектор ролі замість JSON');
ok('канали й ролі обираються, а не вписуються');

// 5. значення показані по-людськи
await configService.set(G, 'moderation.maxMinutesModerator', 1440);
const text = admin.adminGroup(guild, 'moderation').embeds[0].data.description;
assert.ok(text.includes('1 дн.'), `хвилини в людському вигляді, отримали: ${text.slice(0, 120)}`);
assert.ok(text.includes('❌') || text.includes('✅'), 'вимикачі позначені');
ok('значення читаються без розшифровки');

// 6. майстер первинного налаштування: усі шість каналів обираються
{
  const step0 = admin.setupPanel(guild, 0);
  const step1 = admin.setupPanel(guild, 1);
  const ids = [...step0.components, ...step1.components]
    .map((r) => r.toJSON())
    .flatMap((r) => r.components.map((c) => c.custom_id ?? ''));

  for (const key of ['bindChannel', 'bindAdmin', 'bindModPanel', 'bindGallery', 'bindMedia', 'bindCinema']) {
    assert.ok(ids.some((id) => id.startsWith(`adm:${key}`)), `у майстрі є ${key}`);
  }
  const desc = step0.embeds[0].data.description;
  assert.ok(desc.includes('Сховище медіа'), 'приватне сховище описане в майстрі');
  assert.ok(desc.includes('6. Кінотеатр'), 'кроки перенумеровані');
}
ok('майстер: шість каналів, зокрема приватне сховище');

console.log(`\n✅ Усі ${passed} перевірок панелі пройдено.`);
process.exit(0);
