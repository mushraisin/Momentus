/**
 * Димовий тест ядра: репутація (сувора) → профіль → картки → рівні ролей.
 */
import 'dotenv/config';
import assert from 'node:assert';
import { initDatabase } from '../src/database/db.js';

await initDatabase();

const { usersRepo, traitsRepo, activityRepo, reputationRepo } = await import('../src/database/repositories.js');
const { ruleAnalyzeBatch } = await import('../src/services/analysis/ruleEngine.js');
const { reputationService } = await import('../src/services/reputationService.js');
const { profileService } = await import('../src/services/profileService.js');
const { verificationService } = await import('../src/services/verificationService.js');
const { configService } = await import('../src/services/configService.js');
const cards = await import('../src/ui/cards.js');
const { REPUTATION_CATEGORIES } = await import('../src/config/constants.js');

const G = `test-${Date.now()}`;
const U = 'user-1';
let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

await configService.load(G);

// 1. Користувач
await usersRepo.ensure(G, U, 'Тестовий', Date.now() - 200 * 86400_000);
assert.ok(await usersRepo.get(G, U));
ok('user ensure');

// 2. Активність
for (let i = 0; i < 400; i++) {
  await usersRepo.bump(G, U, 'total_messages', 1);
  await activityRepo.bump(G, U, 'messages', 1);
}
await usersRepo.bump(G, U, 'reactions_received', 120);
await usersRepo.bump(G, U, 'help_count', 40);
await usersRepo.bump(G, U, 'voice_minutes', 900);
ok('activity tracked');

// 3. Аналіз без ШІ → EMA
const msgs = [];
for (let i = 0; i < 12; i++) {
  msgs.push({ id: i + 1, userId: U, content: 'Дякую! Ось як це зробити: спробуй оновити конфіг, бо проблема в кеші.' });
}
const analyzed = ruleAnalyzeBatch(msgs);
for (const a of analyzed) await traitsRepo.applySample(G, U, a.traits);
const traits = await traitsRepo.get(G, U);
assert.equal(traits.samples, 12);
ok(`rule engine → ${traits.samples} семплів, helpfulness=${Math.round(traits.helpfulness)}`);

// 4. Репутація (сувора: мала вибірка → множник довіри тисне бал)
const rep = await reputationService.recompute(G, U);
assert.ok(rep.ai_score >= 0 && rep.ai_score <= 1000);
ok(`репутація: рейтинг=${rep.ai_score} (довіра=${Math.round(rep.trust)})`);

// 5. Профіль
const profile = await profileService.build(G, U, { fresh: true });
assert.equal(profile.totalMessages, 400);
assert.ok(Array.isArray(profile.scoreHistory));
ok('профіль зібрано');

// 6. Рівні ролей
const ev = verificationService.evaluate(G, profile, []);
assert.ok(Array.isArray(ev.results) && ev.results.length === 4);
assert.ok(ev.metrics.samples === 12);
ok(`перевірка: досягнуто «${ev.earned?.tier.name ?? '—'}», далі «${ev.next?.tier.name ?? '—'}»`);

// 7. Суворість: мало даних не дає високого рейтингу
assert.ok(rep.ai_score < 700, 'мала вибірка не має давати топовий бал');
ok('суворість підтверджено (мала вибірка → обмежений рейтинг)');

// 8. Картки рендеряться
const cats = REPUTATION_CATEGORIES.map((c) => {
  const value = profile.rep[c.key] ?? 0;
  return { label: c.inverted ? `${c.label} ↓` : c.label, value, level: c.inverted ? 100 - value : value };
});
if (cards.canRender) {
  const a = await cards.profileCard(profile, { username: 'Тестовий', avatarUrl: null, tierName: 'Косметична', tierColor: '#8b9bb4' });
  const b = await cards.reputationCard(profile, cats);
  const c = await cards.verificationCard(ev, { username: 'Тестовий', avatarUrl: null });
  assert.ok(a && b && c, 'усі три картки згенеровано');
  ok('картки-зображення відрендерено');
} else {
  ok('картки пропущено (немає шрифтів) — працює резерв');
}

// 9. Ранг
const rank = await reputationRepo.rank(G, U);
assert.ok(rank >= 1);
ok(`ранг = #${rank}`);

console.log(`\n✅ Усі ${passed} перевірок пройдено.`);
process.exit(0);
