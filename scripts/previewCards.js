/**
 * Локальний прев'ю карток у різних колірних тонах ролей.
 * Запуск: node scripts/previewCards.js  → PNG у ./data/preview/
 */
import fs from 'node:fs';
import { profileCard, verificationCard, reputationCard, canRender } from '../src/ui/cards.js';
import { REPUTATION_CATEGORIES } from '../src/config/constants.js';

if (!canRender) {
  console.log('Рендер недоступний (немає шрифтів).');
  process.exit(1);
}

const OUT = './data/preview';
fs.mkdirSync(OUT, { recursive: true });

const profile = {
  aiScore: 742, daysOnServer: 210, totalMessages: 3480, messages30d: 412,
  voiceMinutes: 5400, activeDays: 96,
  rep: {
    trust: 78, activity: 64, communication: 80, helpfulness: 70, usefulness: 66,
    stability: 62, behavior: 75, conflict: 14, toxicity: 12, violations: 8, peer: 71,
  },
};

const cats = REPUTATION_CATEGORIES.map((c) => {
  const v = profile.rep[c.key];
  return { label: c.inverted ? `${c.label} ↓` : c.label, value: v, level: c.inverted ? 100 - v : v };
});

const mk = (key, name, color, pass, held, ok, total) => ({
  tier: { key, name, color },
  display: { name, color },
  pass,
  held,
  checks: [...Array(ok).fill({ ok: true }), ...Array(total - ok).fill({ ok: false })],
});

const ev = {
  metrics: { score: 742 },
  results: [
    mk('a', '• Учасник •', '#95a5a6', true, true, 10, 10),
    mk('b', '✦ Довірений ✦', '#2ecc71', true, false, 10, 10),
    mk('c', 'Модератор 🛡️', '#5865f2', false, false, 6, 10),
    mk('d', '★ Старший модератор ★', '#f1c40f', false, false, 3, 10),
  ],
};
ev.earned = ev.results[1];

const username = 'Вадим 🔥 Коваленко ⚡';
const TONES = [
  ['purple', '#9b59b6'],
  ['red', '#e74c3c'],
  ['cyan', '#1abc9c'],
  ['none', null],
];

for (const [name, tone] of TONES) {
  const p = await profileCard(profile, {
    username, avatarUrl: null, roleName: '✦ Довірений ✦', roleColor: '#2ecc71', accent: tone,
  });
  fs.writeFileSync(`${OUT}/profile-${name}.png`, p.attachment);

  const v = await verificationCard(ev, { username, avatarUrl: null, accent: tone });
  fs.writeFileSync(`${OUT}/verify-${name}.png`, v.attachment);

  const r = await reputationCard(profile, cats, { accent: tone });
  fs.writeFileSync(`${OUT}/reputation-${name}.png`, r.attachment);
}

console.log(`Готово → ${OUT} (${TONES.length * 3} файлів)`);
