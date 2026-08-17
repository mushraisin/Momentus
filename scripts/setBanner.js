/**
 * Ставить згенерований банер у профіль бота.
 * Запускати вручну й зрідка: Discord обмежує частоту зміни профілю.
 *
 *   node scripts/makeBanner.js   # згенерувати
 *   node scripts/setBanner.js    # застосувати
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Client, GatewayIntentBits } from 'discord.js';

const file = path.join(process.cwd(), 'assets', 'banner.gif');
const gif = await fs.readFile(file).catch(() => null);
if (!gif) {
  console.error('Немає assets/banner.gif — спершу: node scripts/makeBanner.js');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async (c) => {
  try {
    await c.user.setBanner(gif);
    console.log(`✅ Банер оновлено (${(gif.length / 1024).toFixed(0)} КБ).`);
    console.log('   Видно в профілі бота: клік по його аватарці в Discord.');
  } catch (err) {
    console.error('Не вдалося:', err.message);
    // Анімований банер профілю Discord відкриває не всім застосункам —
    // тоді лишається поставити його вручну в Developer Portal → Bot.
    if (/banner|feature|premium|asset/i.test(err.message)) {
      console.error('\n   Схоже, анімований банер недоступний цьому застосунку.');
      console.error('   Спробуйте вручну: Developer Portal → Bot → Banner,');
      console.error('   файл: assets/banner.gif');
    }
  } finally {
    await c.destroy();
    process.exit(0);
  }
});

await client.login(process.env.DISCORD_TOKEN);
