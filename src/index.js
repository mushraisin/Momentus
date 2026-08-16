import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Events } from 'discord.js';

import { initDatabase } from './database/db.js';
import { registerEvents, postSetupPanel } from './interactions/events.js';
import { startScheduler } from './services/scheduler.js';
import { startWebServer, stopWebServer } from './web/server.js';
import { startPresence, stopPresence } from './services/presenceService.js';
import { usersRepo } from './database/repositories.js';
import { configService } from './services/configService.js';
import { aiService } from './services/aiService.js';
import { createLogger } from './core/logger.js';
import { OWNER_ID } from './config/constants.js';

const log = createLogger('boot');

function requireEnv(name) {
  if (!process.env[name]) {
    log.error(`Відсутня змінна середовища ${name}. Скопіюйте .env.example → .env та заповніть.`);
    process.exit(1);
  }
}

requireEnv('DISCORD_TOKEN');

await initDatabase();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    // без цього наміру не приходять записи журналу аудиту —
    // а саме з них видно дії персоналу з нативними правами Discord
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel, Partials.GuildMember],
});

client.once(Events.ClientReady, (c) => {
  log.info(`Увійшли як ${c.user.tag}`);
  log.info(`Власник (повний доступ): ${OWNER_ID}`);
  log.info(`AI-ядро: ${aiService.enabled ? '🟢 активне' : '🔴 евристики'}`);

  // Статус показує, що зараз іде в кінотеатрі; коли нічого — просто «онлайн».
  c.user.setPresence({ activities: [], status: 'online' });
  startPresence(c);

  // Сайт спільноти (в тому ж процесі; дані — з тієї самої Turso БД).
  startWebServer(c);

  // Прогрів: підтягуємо конфіг у памʼять, гарантуємо записи для учасників
  // і показуємо первинне налаштування там, де канал хабу ще не привʼязано.
  for (const [, guild] of c.guilds.cache) {
    postSetupPanel(c, guild); // всередині: load конфігу + перевірка, чи вже налаштовано
    guild.members.fetch().then(async (members) => {
      for (const [, m] of members) {
        if (m.user.bot) continue;
        await usersRepo.ensure(guild.id, m.id, m.user.username, m.joinedTimestamp).catch(() => {});
      }
      log.info(`Синхронізовано ${members.size} учасників у «${guild.name}».`);
    }).catch((e) => log.warn(`Не вдалося синхронізувати ${guild.name}`, e.message));
  }
});

registerEvents(client);
startScheduler(client);

client.login(process.env.DISCORD_TOKEN);

// ── Стабільність процесу ──────────────────────
process.on('unhandledRejection', (reason) => log.error('unhandledRejection', reason));
process.on('uncaughtException', (err) => log.error('uncaughtException', err));

async function shutdown(signal) {
  log.info(`Отримано ${signal}, завершуюсь…`);
  try {
    stopPresence();
    stopWebServer();
    client.destroy();
  } finally {
    process.exit(0);
  }
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
