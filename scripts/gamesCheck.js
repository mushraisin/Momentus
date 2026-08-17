/**
 * Перевірка стеження за іграми.
 *
 * Discord НЕ віддає «наіграні години» — такого в його API немає. Видно лише
 * те, у що людина грає прямо зараз, і навіть це приходить лише за наявності
 * привілейованого наміру. Тож коли в профілі порожньо, причина майже завжди
 * одна з трьох — цей скрипт каже, яка саме.
 *
 * Запуск:  node scripts/gamesCheck.js
 */
import 'dotenv/config';
import { Client, GatewayIntentBits, ActivityType } from 'discord.js';

const on = String(process.env.TRACK_GAMES).toLowerCase() === 'true';

console.log('\n── Стеження за іграми ──\n');
console.log(`1. TRACK_GAMES .............. ${on ? 'true ✓' : `${process.env.TRACK_GAMES ?? '(не задано)'} ✗`}`);

if (!on) {
  console.log('\n   Постав TRACK_GAMES=true у .env і перезапусти бота.\n');
  process.exit(0);
}

if (!process.env.DISCORD_TOKEN) {
  console.log('2. DISCORD_TOKEN ............ немає ✗\n');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildPresences],
});

const bail = (msg, hint) => {
  console.log(`2. Намір GuildPresences ..... відхилено ✗\n   ${msg}`);
  if (hint) console.log(`\n   ${hint}`);
  console.log('');
  process.exit(1);
};

client.on('error', (e) => bail(e.message));

setTimeout(() => bail('Discord не відповів за 20 с'), 20_000).unref();

client.once('ready', async (c) => {
  console.log('2. Намір GuildPresences ..... дозволено ✓');
  console.log(`3. Бот ...................... ${c.user.tag}`);

  // Присутність приходить лише для тих, кого бот бачить у кеші.
  let guilds = 0;
  let playing = 0;
  const sample = [];

  for (const guild of c.guilds.cache.values()) {
    guilds++;
    try { await guild.members.fetch(); } catch { /* без GuildMembers буде мало */ }
    for (const p of guild.presences.cache.values()) {
      const act = (p.activities ?? []).find((a) => a.type === ActivityType.Playing);
      const name = act?.name?.trim();
      if (!name || name.toLowerCase() === 'custom status') continue;
      playing++;
      if (sample.length < 8) sample.push(`${p.member?.displayName ?? p.userId} → ${name}`);
    }
  }

  console.log(`4. Серверів ................. ${guilds}`);
  console.log(`5. Зараз грають ............. ${playing}`);
  if (sample.length) {
    console.log('\n   Кого видно:');
    for (const s of sample) console.log(`     • ${s}`);
  }

  console.log('\n── Підсумок ──');
  if (playing) {
    console.log('Усе працює. Години рахуються з моменту, коли бот це побачив,');
    console.log('і зʼявляться в профілі одразу — поточна сесія показується наживо.\n');
  } else {
    console.log('Намір працює, але зараз ніхто не грає — або статус прихований.');
    console.log('У Discord: Налаштування → Активність → «Показувати гру в статусі».\n');
  }
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch((err) => {
  if (/disallowed intents/i.test(err.message)) {
    bail('Discord не пускає бота з цим наміром.',
      'Увімкни: Developer Portal → свій застосунок → Bot → Privileged Gateway Intents '
      + '→ PRESENCE INTENT. Без цього стеження не працюватиме взагалі.');
  }
  bail(err.message);
});
