import { ActivityType } from 'discord.js';
import { cinemaRepo } from '../database/repositories.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('presence');

/**
 * Статус бота показує, що зараз іде в кінотеатрі.
 *
 * Discord обмежує частоту зміни присутності (близько 5 разів на 20 с), тож
 * оновлюємо раз на 15 с і тільки тоді, коли текст справді змінився.
 */
const INTERVAL_MS = 15_000;
const ROOM_LABEL = 'Кінотеатр';
const SITE_URL = () => (process.env.WEB_PUBLIC_URL || 'https://moments.zadrypanka.xyz').replace(/\/$/, '');

let timer = null;
/** undefined — ще нічого не виставляли; null — свідомо порожній статус. */
let lastText;

export function startPresence(client) {
  stopPresence();
  updateProfile(client).catch(() => {});
  tick(client).catch(() => {});
  timer = setInterval(() => tick(client).catch(() => {}), INTERVAL_MS);
  return timer;
}

/**
 * Опис бота («Про мене» в профілі) з посиланням на сайт.
 * Discord не робить його клікабельним, але адресу видно й можна скопіювати.
 * Патчимо лише коли текст справді інший — зайвих запитів до API не треба.
 */
async function updateProfile(client) {
  const about = SITE_URL();
  try {
    const app = client.application;
    if (!app) return;
    if (!app.description) await app.fetch();
    if (app.description === about) return;
    await app.edit({ description: about });
    log.info('Опис бота оновлено — у профілі є посилання на сайт');
  } catch (err) {
    log.warn('Не вдалося оновити опис бота', err.message);
  }
}

export function stopPresence() {
  if (timer) clearInterval(timer);
  timer = null;
  lastText = undefined;
}

/** Гільдія, чий кінотеатр показуємо (та сама, що й на сайті). */
function activeGuildId(client) {
  const cache = client?.guilds?.cache;
  if (!cache) return null;
  const id = process.env.WEB_GUILD_ID;
  if (id && cache.get(id)) return id;
  return [...cache.values()][0]?.id ?? null;
}

async function tick(client) {
  if (!client?.user) return;

  const guildId = activeGuildId(client);
  const state = guildId ? await cinemaRepo.get(guildId).catch(() => null) : null;

  // Нічого не йде — прибираємо активність, лишаємо просто «онлайн».
  if (!state?.source) {
    return apply(client, null, ActivityType.Watching);
  }

  // «| Кінотеатр» у кінці — щоб було зрозуміло, що це сеанс на сайті,
  // а не просто якийсь підпис. Довгу назву ріжемо, бо ліміт Discord — 128.
  const at = fmt(livePosition(state));
  const suffix = ` · ${at} | ${ROOM_LABEL}`;
  const title = trim(state.title ?? 'відео', 128 - suffix.length - 2);
  const text = `${state.playing ? '' : '⏸ '}${title}${suffix}`;

  return apply(client, text, ActivityType.Watching);
}

function trim(s, max) {
  const v = String(s).trim();
  return v.length <= max ? v : `${v.slice(0, Math.max(1, max - 1))}…`;
}

function apply(client, text, type) {
  if (text === lastText) return;
  lastText = text;
  try {
    client.user.setPresence({
      status: 'online',
      activities: text ? [{ name: text, type }] : [],
    });
  } catch (err) {
    log.warn('Не вдалося оновити статус', err.message);
  }
}

/** Позиція «зараз»: у БД лежить час останньої дії, тож додаємо, скільки минуло. */
function livePosition(state) {
  if (!state.playing) return state.positionMs;
  return state.positionMs + (Date.now() - state.updatedAt);
}

function fmt(ms) {
  const s = Math.max(0, Math.round(Number(ms) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const two = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`;
}
