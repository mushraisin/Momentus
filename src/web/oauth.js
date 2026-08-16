import crypto from 'node:crypto';
import { sessionsRepo } from '../database/repositories.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('oauth');

const API = 'https://discord.com/api/v10';
const SESSION_TTL = 7 * 24 * 3600_000; // 7 днів

/** Короткоживучі state-и для захисту від CSRF. */
const states = new Map();

export const oauth = {
  get configured() {
    return !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
  },

  /** Посилання на авторизацію Discord. */
  authorizeUrl(redirectUri) {
    const state = crypto.randomBytes(16).toString('hex');
    states.set(state, Date.now() + 10 * 60_000);
    cleanupStates();

    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify',
      state,
      prompt: 'none',
    });
    return `https://discord.com/oauth2/authorize?${params}`;
  },

  validState(state) {
    const exp = states.get(state);
    if (!exp || exp < Date.now()) return false;
    states.delete(state);
    return true;
  },

  /** Обмін коду на токен і створення сесії. @returns {Promise<string|null>} token */
  async completeLogin(code, redirectUri, guildId) {
    try {
      const body = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      });

      const tokenRes = await fetch(`${API}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (!tokenRes.ok) throw new Error(`token ${tokenRes.status}`);
      const tokenJson = await tokenRes.json();

      const meRes = await fetch(`${API}/users/@me`, {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` },
      });
      if (!meRes.ok) throw new Error(`me ${meRes.status}`);
      const me = await meRes.json();

      const token = crypto.randomBytes(32).toString('hex');
      await sessionsRepo.create({
        token,
        guildId,
        userId: me.id,
        username: me.global_name || me.username,
        avatar: me.avatar,
        ttlMs: SESSION_TTL,
      });
      return token;
    } catch (err) {
      log.warn('OAuth-логін не вдався', err.message);
      return null;
    }
  },

  session(token) {
    return token ? sessionsRepo.get(token) : null;
  },

  logout(token) {
    return token ? sessionsRepo.remove(token) : null;
  },
};

function cleanupStates() {
  const now = Date.now();
  for (const [k, v] of states) if (v < now) states.delete(k);
}

/** URL аватара користувача Discord. */
export function avatarUrl(userId, avatarHash, size = 128) {
  if (!avatarHash) {
    // у журналі трапляються службові «айді» на кшталт system — це не snowflake
    const idx = /^\d+$/.test(String(userId)) ? (BigInt(userId) >> 22n) % 6n : 0n;
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
  }
  const ext = avatarHash.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=${size}`;
}
