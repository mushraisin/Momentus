/**
 * Ставить згенеровану емблему аватаром бота.
 * Запускати вручну й зрідка: Discord дозволяє міняти аватар лише двічі на годину.
 *
 *   node scripts/makeEmblem.js   # згенерувати
 *   node scripts/setAvatar.js    # застосувати
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Client, GatewayIntentBits } from 'discord.js';

const file = path.join(process.cwd(), 'assets', 'emblem.gif');
const gif = await fs.readFile(file).catch(() => null);
if (!gif) {
  console.error('Немає assets/emblem.gif — спершу: node scripts/makeEmblem.js');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async (c) => {
  try {
    await c.user.setAvatar(gif);
    console.log(`✅ Аватар оновлено (${(gif.length / 1024).toFixed(0)} КБ).`);
  } catch (err) {
    // найчастіша причина — ліміт Discord на зміну аватара
    console.error('Не вдалося:', err.message);
  } finally {
    await c.destroy();
    process.exit(0);
  }
});

await client.login(process.env.DISCORD_TOKEN);
