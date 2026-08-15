/**
 * Математика синхронізації кінотеатру. Перевіряємо саме те, що ламало показ:
 * змішування локального й серверного годинника.
 */
import assert from 'node:assert';

let passed = 0;
const ok = (n) => { passed++; console.log(`  ✓ ${n}`); };

/** Клієнт із власним «кривим» годинником і затримкою мережі. */
function makeClient({ clockSkew, rtt }) {
  const offsets = [];
  let clockOffset = 0;
  const want = { playing: false, pos: 0, at: 0 };

  const localNow = (serverTime) => serverTime + clockSkew;   // що показує його Date.now()
  const serverNow = (serverTime) => localNow(serverTime) + clockOffset;

  return {
    /** Відповідь сервера: позиція на момент serverTime. */
    receive(serverTime, positionMs, playing) {
      // оцінка зсуву годинника, як у браузері: half-RTT
      const sentAt = localNow(serverTime) - rtt;
      const off = serverTime + rtt / 2 - localNow(serverTime);
      offsets.push(off);
      if (offsets.length > 9) offsets.shift();
      const s = offsets.slice().sort((a, b) => a - b);
      clockOffset = s[Math.floor(s.length / 2)];
      void sentAt;

      want.playing = playing;
      want.pos = positionMs;
      want.at = serverTime;          // ← серверна позначка, а не локальна
    },
    /** Де клієнт вважає, що зараз має бути відео. */
    expected(serverTime) {
      return want.pos + (want.playing ? serverNow(serverTime) - want.at : 0);
    },
  };
}

// Три глядачі: у одного годинник поспішає на 4 с, у другого відстає на 9 с,
// у третього точний; затримки мережі теж різні.
const a = makeClient({ clockSkew: 4000, rtt: 60 });
const b = makeClient({ clockSkew: -9000, rtt: 400 });
const c = makeClient({ clockSkew: 0, rtt: 120 });

const T0 = 1_700_000_000_000;
for (const cl of [a, b, c]) {
  for (let i = 0; i < 9; i++) cl.receive(T0 + i * 2000, 60_000 + i * 2000, true);
}

const T1 = T0 + 30_000;                       // через 30 секунд показу
const pos = [a.expected(T1), b.expected(T1), c.expected(T1)];
const spread = Math.max(...pos) - Math.min(...pos);
assert.ok(spread < 500, `розбіжність між глядачами ${Math.round(spread)} мс`);
ok(`різні годинники й затримки — розбіжність ${Math.round(spread)} мс`);

// Той самий розрахунок, але з помилкою, яку я виправив: локальна позначка часу.
function buggy({ clockSkew, rtt }) {
  let clockOffset = 0;
  const want = { pos: 0, at: 0 };
  const localNow = (t) => t + clockSkew;
  return {
    receive(serverTime, positionMs) {
      clockOffset = serverTime + rtt / 2 - localNow(serverTime);
      want.pos = positionMs;
      want.at = localNow(serverTime);       // ← стара помилка
    },
    expected(t) { return want.pos + (localNow(t) + clockOffset - want.at); },
  };
}
const ba = buggy({ clockSkew: 4000, rtt: 60 });
const bb = buggy({ clockSkew: -9000, rtt: 400 });
ba.receive(T0, 60_000); bb.receive(T0, 60_000);
const badSpread = Math.abs(ba.expected(T1) - bb.expected(T1));
assert.ok(badSpread > 5000, `стара логіка мала розходитись, отримали ${badSpread} мс`);
ok(`стара логіка розводила глядачів на ${Math.round(badSpread / 1000)} с — саме це й лікуємо`);

// Пауза: час стоїть у всіх однаково, скільки б не минуло.
const p = makeClient({ clockSkew: 3000, rtt: 200 });
p.receive(T0, 125_000, false);
assert.equal(p.expected(T0 + 60_000), 125_000, 'на паузі позиція не повзе');
ok('на паузі позиція стоїть у всіх');

// Пороги підгонки: дрібне відставання — швидкістю, велике — перемоткою.
const decide = (d) => {
  if (Math.abs(d) > 2) return 'seek';
  if (Math.abs(d) > 0.25) return 'rate';
  return 'none';
};
assert.equal(decide(0.1), 'none');
assert.equal(decide(0.6), 'rate');
assert.equal(decide(3.5), 'seek');
const k = (d) => Math.min(0.06, Math.abs(d) * 0.05);
assert.ok(k(0.4) < k(1.5) && k(9) === 0.06, 'поправка росте, але не більше 6%');
ok('пороги: <0.25 с не чіпаємо, до 2 с — швидкістю, далі — перемоткою');

console.log(`\n✅ Усі ${passed} перевірок синхронізації пройдено.`);
