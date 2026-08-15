/**
 * Реєстрація контекстних меню (right-click → Apps).
 * Це ЄДИНІ application-команди в системі — і це НЕ slash-команди.
 * Весь інший функціонал — кнопки/меню/модалки.
 *
 * Запуск: `npm run deploy`
 */
import 'dotenv/config';
import { REST, Routes, ApplicationCommandType } from 'discord.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID) {
  console.error('Потрібні DISCORD_TOKEN та DISCORD_CLIENT_ID у .env');
  process.exit(1);
}

const commands = [
  { name: 'Профіль репутації', type: ApplicationCommandType.User },
  { name: 'Модерувати', type: ApplicationCommandType.User },
  { name: 'Панель адміністратора', type: ApplicationCommandType.User },
];

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

try {
  const route = DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID)
    : Routes.applicationCommands(DISCORD_CLIENT_ID);

  await rest.put(route, { body: commands });
  console.log(
    `✅ Зареєстровано ${commands.length} контекстних меню ` +
    (DISCORD_GUILD_ID ? `для гільдії ${DISCORD_GUILD_ID}.` : 'глобально (до 1 год на поширення).'),
  );
} catch (err) {
  console.error('❌ Не вдалося зареєструвати:', err);
  process.exit(1);
}
