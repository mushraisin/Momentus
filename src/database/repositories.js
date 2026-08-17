import { run, get, all } from './db.js';
import { MESSAGE_TRAITS } from '../config/constants.js';

/** Поточний день YYYY-MM-DD (UTC). */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

const num = (v) => (typeof v === 'bigint' ? Number(v) : v);

// ─────────────────────────────────────────────
//  USERS
// ─────────────────────────────────────────────
export const usersRepo = {
  async ensure(guildId, userId, username, joinedAt) {
    const now = Date.now();
    await run(`
      INSERT INTO users (guild_id, user_id, username, joined_at, first_seen_at, last_seen_at)
      VALUES (@guild_id, @user_id, @username, @joined_at, @now, @now)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        username = COALESCE(excluded.username, users.username),
        last_seen_at = excluded.last_seen_at,
        joined_at = COALESCE(users.joined_at, excluded.joined_at)
    `, { guild_id: guildId, user_id: userId, username: username ?? null, joined_at: joinedAt ?? null, now });
    await traitsRepo.ensure(guildId, userId);
    await reputationRepo.ensure(guildId, userId);
  },

  get(guildId, userId) {
    return get('SELECT * FROM users WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  },

  async bump(guildId, userId, field, delta = 1) {
    const allowed = new Set([
      'total_messages', 'total_chars', 'voice_minutes', 'reactions_given',
      'reactions_received', 'help_count', 'night_messages', 'deleted_messages',
      'distinct_peers', 'events_attended', 'projects_joined',
    ]);
    if (!allowed.has(field)) throw new Error(`Неприпустиме поле users.${field}`);
    await run(`UPDATE users SET ${field} = ${field} + ? WHERE guild_id = ? AND user_id = ?`, [delta, guildId, userId]);
  },

  async count(guildId) {
    const row = await get('SELECT COUNT(*) AS n FROM users WHERE guild_id = ?', [guildId]);
    return num(row?.n ?? 0);
  },
};

// ─────────────────────────────────────────────
//  TRAITS
// ─────────────────────────────────────────────
export const traitsRepo = {
  ensure(guildId, userId) {
    return run('INSERT OR IGNORE INTO traits (guild_id, user_id) VALUES (?, ?)', [guildId, userId]);
  },

  get(guildId, userId) {
    return get('SELECT * FROM traits WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  },

  async applySample(guildId, userId, sample, alpha = 0.2) {
    await this.ensure(guildId, userId);
    const row = await this.get(guildId, userId);
    const next = {};
    for (const t of MESSAGE_TRAITS) {
      const prev = row[t] ?? 0;
      const val = clamp(sample[t] ?? prev, 0, 100);
      next[t] = round2(prev + alpha * (val - prev));
    }
    const sets = MESSAGE_TRAITS.map((t) => `${t} = @${t}`).join(', ');
    await run(`
      UPDATE traits SET ${sets}, samples = samples + 1, updated_at = @now
      WHERE guild_id = @guild_id AND user_id = @user_id
    `, { ...next, guild_id: guildId, user_id: userId, now: Date.now() });
    return next;
  },
};

// ─────────────────────────────────────────────
//  REPUTATION
// ─────────────────────────────────────────────
export const reputationRepo = {
  ensure(guildId, userId) {
    return run('INSERT OR IGNORE INTO reputation (guild_id, user_id) VALUES (?, ?)', [guildId, userId]);
  },

  get(guildId, userId) {
    return get('SELECT * FROM reputation WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  },

  async save(guildId, userId, rep) {
    await this.ensure(guildId, userId);
    await run(`
      UPDATE reputation SET
        trust=@trust, activity=@activity, communication=@communication, helpfulness=@helpfulness,
        usefulness=@usefulness, stability=@stability, behavior=@behavior, conflict=@conflict,
        toxicity=@toxicity, violations=@violations, peer=@peer, ai_score=@ai_score, updated_at=@now
      WHERE guild_id=@guild_id AND user_id=@user_id
    `, { ...rep, ai_score: Math.round(rep.ai_score), guild_id: guildId, user_id: userId, now: Date.now() });
  },

  /**
   * Рейтинг разом зі статистикою: сторінка показує на картці ще й
   * повідомлення, голосові хвилини та скільки людина на сервері. Беремо це
   * тим самим запитом — окремий похід по кожного учасника перетворив би
   * одну сторінку на десятки звернень до бази.
   */
  leaderboard(guildId, limit = 100) {
    return all(`
      SELECT r.user_id, r.ai_score, u.username,
             u.total_messages, u.voice_minutes, u.joined_at, u.first_seen_at
      FROM reputation r JOIN users u ON u.guild_id = r.guild_id AND u.user_id = r.user_id
      WHERE r.guild_id = ?
      ORDER BY r.ai_score DESC
      LIMIT ?
    `, [guildId, limit]);
  },

  async rank(guildId, userId) {
    const row = await get(`
      SELECT COUNT(*) + 1 AS rank FROM reputation
      WHERE guild_id = ? AND ai_score > (SELECT ai_score FROM reputation WHERE guild_id = ? AND user_id = ?)
    `, [guildId, guildId, userId]);
    return num(row?.rank ?? null);
  },
};

// ─────────────────────────────────────────────
//  ACTIVITY
// ─────────────────────────────────────────────
export const activityRepo = {
  bump(guildId, userId, field, delta = 1, day = today()) {
    const allowed = new Set(['messages', 'chars', 'voice_minutes', 'reactions_in', 'reactions_out', 'new_peers']);
    if (!allowed.has(field)) throw new Error(`Неприпустиме поле activity.${field}`);
    return run(`
      INSERT INTO activity_daily (guild_id, user_id, day, ${field})
      VALUES (?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, day) DO UPDATE SET ${field} = ${field} + excluded.${field}
    `, [guildId, userId, day, delta]);
  },

  range(guildId, userId, days) {
    const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    return all(`
      SELECT * FROM activity_daily
      WHERE guild_id = ? AND user_id = ? AND day >= ?
      ORDER BY day ASC
    `, [guildId, userId, from]);
  },

  async activeDays(guildId, userId) {
    const row = await get('SELECT COUNT(*) AS n FROM activity_daily WHERE guild_id = ? AND user_id = ? AND messages > 0', [guildId, userId]);
    return num(row?.n ?? 0);
  },

  async sumSince(guildId, userId, days, field = 'messages') {
    const allowed = new Set(['messages', 'chars', 'voice_minutes', 'reactions_in', 'reactions_out', 'new_peers']);
    if (!allowed.has(field)) throw new Error('bad field');
    const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    const row = await get(`
      SELECT COALESCE(SUM(${field}), 0) AS n FROM activity_daily
      WHERE guild_id = ? AND user_id = ? AND day >= ?
    `, [guildId, userId, from]);
    return num(row?.n ?? 0);
  },
};

// ─────────────────────────────────────────────
//  SNAPSHOTS
// ─────────────────────────────────────────────
export const snapshotRepo = {
  take(guildId, userId, rep, day = today()) {
    return run(`
      INSERT INTO reputation_snapshots (guild_id, user_id, day, ai_score, payload)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, day) DO UPDATE SET ai_score = excluded.ai_score, payload = excluded.payload
    `, [guildId, userId, day, Math.round(rep.ai_score), JSON.stringify(rep)]);
  },

  nearest(guildId, userId, daysAgo) {
    const target = new Date(Date.now() - daysAgo * 86400_000).toISOString().slice(0, 10);
    return get(`
      SELECT * FROM reputation_snapshots
      WHERE guild_id = ? AND user_id = ? AND day <= ?
      ORDER BY day DESC LIMIT 1
    `, [guildId, userId, target]);
  },

  history(guildId, userId, days = 90) {
    const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
    return all(`
      SELECT day, ai_score FROM reputation_snapshots
      WHERE guild_id = ? AND user_id = ? AND day >= ?
      ORDER BY day ASC
    `, [guildId, userId, from]);
  },
};

// ─────────────────────────────────────────────
//  MODERATION
// ─────────────────────────────────────────────
export const modRepo = {
  async add(entry) {
    const cnt = await get(`
      SELECT COUNT(*) + 1 AS n FROM moderation_log
      WHERE guild_id = ? AND user_id = ? AND action = ?
    `, [entry.guildId, entry.userId, entry.action]);
    const repeatIndex = num(cnt.n);

    const res = await run(`
      INSERT INTO moderation_log
        (guild_id, user_id, moderator_id, action, reason, note, duration_ms, ai_context, repeat_index, result, created_at)
      VALUES (@guildId, @userId, @moderatorId, @action, @reason, @note, @durationMs, @aiContext, @repeatIndex, @result, @createdAt)
    `, {
      guildId: entry.guildId,
      userId: entry.userId,
      moderatorId: entry.moderatorId,
      action: entry.action,
      reason: entry.reason ?? null,
      note: entry.note ?? null,
      durationMs: entry.durationMs ?? null,
      aiContext: entry.aiContext ? JSON.stringify(entry.aiContext) : null,
      repeatIndex,
      result: entry.result ?? 'applied',
      createdAt: Date.now(),
    });
    return { id: num(res.lastInsertRowid), repeatIndex };
  },

  history(guildId, userId, limit = 25) {
    return all('SELECT * FROM moderation_log WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?', [guildId, userId, limit]);
  },

  /** Останні дії по всій гільдії — для журналу аудиту. */
  recent(guildId, limit = 50) {
    return all('SELECT * FROM moderation_log WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?', [guildId, limit]);
  },

  stats(guildId, userId) {
    return get(`
      SELECT
        SUM(CASE WHEN action = 'warn' THEN 1 ELSE 0 END)    AS warns,
        SUM(CASE WHEN action = 'mute' THEN 1 ELSE 0 END)    AS mutes,
        SUM(CASE WHEN action = 'timeout' THEN 1 ELSE 0 END) AS timeouts,
        SUM(CASE WHEN action = 'kick' THEN 1 ELSE 0 END)    AS kicks,
        SUM(CASE WHEN action = 'ban' THEN 1 ELSE 0 END)     AS bans,
        COUNT(*)                                            AS total,
        MAX(created_at)                                     AS last_at
      FROM moderation_log
      WHERE guild_id = ? AND user_id = ? AND action NOT IN ('note','praise','reward','unpunish')
    `, [guildId, userId]);
  },

  markReverted(id) {
    return run('UPDATE moderation_log SET reverted_at = ? WHERE id = ?', [Date.now(), id]);
  },
};

// ─────────────────────────────────────────────
//  ACHIEVEMENTS
// ─────────────────────────────────────────────
export const achievementsRepo = {
  unlocked(guildId, userId) {
    return all('SELECT key, unlocked_at FROM achievements WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  },

  async has(guildId, userId, key) {
    const row = await get('SELECT 1 AS x FROM achievements WHERE guild_id = ? AND user_id = ? AND key = ?', [guildId, userId, key]);
    return !!row;
  },

  async unlock(guildId, userId, key) {
    const res = await run('INSERT OR IGNORE INTO achievements (guild_id, user_id, key, unlocked_at) VALUES (?, ?, ?, ?)', [guildId, userId, key, Date.now()]);
    return num(res.rowsAffected) > 0;
  },
};

// ─────────────────────────────────────────────
//  ROLE GRANTS
// ─────────────────────────────────────────────
export const roleRepo = {
  set(guildId, userId, roleKey, status, { roleId = null, reason = null } = {}) {
    return run(`
      INSERT INTO role_grants (guild_id, user_id, role_key, role_id, status, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, role_key) DO UPDATE SET
        status = excluded.status, role_id = excluded.role_id, reason = excluded.reason, created_at = excluded.created_at
    `, [guildId, userId, roleKey, roleId, status, reason, Date.now()]);
  },

  forUser(guildId, userId) {
    return all('SELECT * FROM role_grants WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  },

  pendingApprovals(guildId) {
    return all("SELECT * FROM role_grants WHERE guild_id = ? AND status = 'suggested' ORDER BY created_at DESC", [guildId]);
  },
};

// ─────────────────────────────────────────────
//  AI INSIGHTS
// ─────────────────────────────────────────────
export const insightsRepo = {
  save(guildId, userId, kind, payload) {
    return run(`
      INSERT INTO ai_insights (guild_id, user_id, kind, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, kind) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at
    `, [guildId, userId, kind, JSON.stringify(payload), Date.now()]);
  },

  async get(guildId, userId, kind) {
    const row = await get('SELECT payload, created_at FROM ai_insights WHERE guild_id = ? AND user_id = ? AND kind = ?', [guildId, userId, kind]);
    if (!row) return null;
    return { ...JSON.parse(row.payload), _createdAt: num(row.created_at) };
  },
};

// ─────────────────────────────────────────────
//  AI USAGE
// ─────────────────────────────────────────────
export const aiUsageRepo = {
  record({ inTokens = 0, outTokens = 0, error = false } = {}, day = today()) {
    return run(`
      INSERT INTO ai_usage (day, calls, in_tokens, out_tokens, errors)
      VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(day) DO UPDATE SET
        calls = calls + 1, in_tokens = in_tokens + excluded.in_tokens,
        out_tokens = out_tokens + excluded.out_tokens, errors = errors + excluded.errors
    `, [day, inTokens, outTokens, error ? 1 : 0]);
  },

  async todayStats(day = today()) {
    const row = await get('SELECT * FROM ai_usage WHERE day = ?', [day]);
    return row ?? { day, calls: 0, in_tokens: 0, out_tokens: 0, errors: 0 };
  },
};

// ─────────────────────────────────────────────
//  CONFIG
// ─────────────────────────────────────────────
export const configRepo = {
  async getAll(guildId) {
    const rows = await all('SELECT key, value FROM config WHERE guild_id = ?', [guildId]);
    const out = {};
    for (const r of rows) out[r.key] = JSON.parse(r.value);
    return out;
  },

  set(guildId, key, value) {
    return run(`
      INSERT INTO config (guild_id, key, value) VALUES (?, ?, ?)
      ON CONFLICT(guild_id, key) DO UPDATE SET value = excluded.value
    `, [guildId, key, JSON.stringify(value)]);
  },
};

// ─────────────────────────────────────────────
//  MESSAGE SAMPLES
// ─────────────────────────────────────────────
export const samplesRepo = {
  add(guildId, userId, channelId, content) {
    return run(`
      INSERT INTO message_samples (guild_id, user_id, channel_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [guildId, userId, channelId, content.slice(0, 1000), Date.now()]);
  },

  async purgeOlderThan(days) {
    const cutoff = Date.now() - days * 86400_000;
    const res = await run('DELETE FROM message_samples WHERE created_at < ?', [cutoff]);
    return num(res.rowsAffected);
  },
};

// ─────────────────────────────────────────────
//  САЙТ: сторінки, «файли», сесії
// ─────────────────────────────────────────────
export const sitePagesRepo = {
  list(guildId, onlyPublished = true) {
    return all(
      `SELECT * FROM site_pages WHERE guild_id = ?${onlyPublished ? ' AND published = 1' : ''} ORDER BY position, slug`,
      [guildId],
    );
  },

  get(guildId, slug) {
    return get('SELECT * FROM site_pages WHERE guild_id = ? AND slug = ?', [guildId, slug]);
  },

  save(guildId, { slug, title, body, published = 1, position = 0 }) {
    return run(`
      INSERT INTO site_pages (guild_id, slug, title, body, published, position, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, slug) DO UPDATE SET
        title = excluded.title, body = excluded.body,
        published = excluded.published, position = excluded.position,
        updated_at = excluded.updated_at
    `, [guildId, slug, title, body, published ? 1 : 0, position, Date.now()]);
  },

  remove(guildId, slug) {
    return run('DELETE FROM site_pages WHERE guild_id = ? AND slug = ?', [guildId, slug]);
  },
};

export const siteAssetsRepo = {
  get(guildId, path) {
    return get('SELECT * FROM site_assets WHERE guild_id = ? AND path = ?', [guildId, path]);
  },

  list(guildId) {
    return all('SELECT path, mime, encoding, updated_at FROM site_assets WHERE guild_id = ?', [guildId]);
  },

  save(guildId, { path, mime, content, encoding = 'utf8' }) {
    return run(`
      INSERT INTO site_assets (guild_id, path, mime, content, encoding, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, path) DO UPDATE SET
        mime = excluded.mime, content = excluded.content,
        encoding = excluded.encoding, updated_at = excluded.updated_at
    `, [guildId, path, mime, content, encoding, Date.now()]);
  },

  remove(guildId, path) {
    return run('DELETE FROM site_assets WHERE guild_id = ? AND path = ?', [guildId, path]);
  },
};

// ─────────────────────────────────────────────
//  ГАЛЕРЕЯ
// ─────────────────────────────────────────────
export const galleryRepo = {
  /** Поля без важкого `content` — щоб не тягнути мегабайти в стрічку. */
  FIELDS: 'id, guild_id, user_id, username, avatar, title, kind, mime, size_bytes, likes, created_at, '
    + 'storage, object_key, url, url_expires, edited_at',

  list(guildId, { limit = 60, offset = 0, userId = null, sort = 'new' } = {}) {
    const where = userId ? 'AND user_id = ?' : '';
    const order = sort === 'top' ? 'likes DESC, created_at DESC' : 'created_at DESC';
    const args = userId ? [guildId, userId, limit, offset] : [guildId, limit, offset];
    return all(`
      SELECT ${this.FIELDS} FROM gallery_items
      WHERE guild_id = ? ${where}
      ORDER BY ${order}
      LIMIT ? OFFSET ?
    `, args);
  },

  /** Найкращі кліпи за проміжок часу — «кліп дня», «кліп місяця». */
  top(guildId, sinceMs, limit = 1) {
    return all(`
      SELECT ${this.FIELDS} FROM gallery_items
      WHERE guild_id = ? AND created_at > ? AND likes > 0
      ORDER BY likes DESC, created_at DESC
      LIMIT ?
    `, [guildId, Date.now() - sinceMs, limit]);
  },

  async count(guildId) {
    const row = await get('SELECT COUNT(*) AS n FROM gallery_items WHERE guild_id = ?', [guildId]);
    return num(row?.n ?? 0);
  },

  /** Повний запис із вмістом — лише для віддачі самого файлу. */
  getFull(id) {
    return get('SELECT * FROM gallery_items WHERE id = ?', [id]);
  },

  meta(id) {
    return get(`SELECT ${this.FIELDS} FROM gallery_items WHERE id = ?`, [id]);
  },

  /**
   * @param {object} item storage: 's3' → content порожній, є object_key/url;
   *                      storage: 'db' → content у base64.
   */
  async add({
    guildId, userId, username, avatar = null, title, kind, mime, sizeBytes,
    content = '', storage = 'db', objectKey = null, url = null, urlExpires = null,
  }) {
    const res = await run(`
      INSERT INTO gallery_items
        (guild_id, user_id, username, avatar, title, kind, mime, size_bytes, content,
         storage, object_key, url, url_expires, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [guildId, userId, username ?? null, avatar, title ?? null, kind, mime, sizeBytes, content,
      storage, objectKey, url, urlExpires, Date.now()]);
    return num(res.lastInsertRowid);
  },

  /** Редагування підпису (адміністратором або автором). */
  updateTitle(id, title) {
    return run('UPDATE gallery_items SET title = ?, edited_at = ? WHERE id = ?', [title || null, Date.now(), id]);
  },

  /** Освіження підписаного посилання Discord-CDN. */
  refreshUrl(id, url, expires) {
    return run('UPDATE gallery_items SET url = ?, url_expires = ? WHERE id = ?', [url, expires, id]);
  },

  /** Хто скільки опублікував — для лічильників на сторінці. */
  async stats(guildId) {
    const row = await get(`
      SELECT COUNT(*) AS items, COUNT(DISTINCT user_id) AS authors,
             COALESCE(SUM(likes),0) AS likes, COALESCE(SUM(size_bytes),0) AS bytes
      FROM gallery_items WHERE guild_id = ?
    `, [guildId]);
    return {
      items: num(row?.items ?? 0),
      authors: num(row?.authors ?? 0),
      likes: num(row?.likes ?? 0),
      bytes: num(row?.bytes ?? 0),
    };
  },

  remove(id) {
    return Promise.all([
      run('DELETE FROM gallery_items WHERE id = ?', [id]),
      run('DELETE FROM gallery_likes WHERE item_id = ?', [id]),
    ]);
  },

  /** Перемикач вподобайки. @returns {Promise<{liked:boolean, likes:number}>} */
  async toggleLike(itemId, userId) {
    const existing = await get('SELECT 1 AS x FROM gallery_likes WHERE item_id = ? AND user_id = ?', [itemId, userId]);
    if (existing) {
      await run('DELETE FROM gallery_likes WHERE item_id = ? AND user_id = ?', [itemId, userId]);
      await run('UPDATE gallery_items SET likes = MAX(0, likes - 1) WHERE id = ?', [itemId]);
    } else {
      await run('INSERT INTO gallery_likes (item_id, user_id, created_at) VALUES (?, ?, ?)', [itemId, userId, Date.now()]);
      await run('UPDATE gallery_items SET likes = likes + 1 WHERE id = ?', [itemId]);
    }
    const row = await get('SELECT likes FROM gallery_items WHERE id = ?', [itemId]);
    return { liked: !existing, likes: num(row?.likes ?? 0) };
  },

  /** Які з перелічених елементів користувач уже вподобав. */
  async likedBy(userId, ids) {
    if (!userId || !ids.length) return new Set();
    const marks = ids.map(() => '?').join(',');
    const rows = await all(`SELECT item_id FROM gallery_likes WHERE user_id = ? AND item_id IN (${marks})`, [userId, ...ids]);
    return new Set(rows.map((r) => num(r.item_id)));
  },

  /** Скільки місця займає галерея гільдії (для контролю квоти). */
  async usage(guildId) {
    const row = await get('SELECT COALESCE(SUM(size_bytes),0) AS bytes, COUNT(*) AS n FROM gallery_items WHERE guild_id = ?', [guildId]);
    return { bytes: num(row?.bytes ?? 0), count: num(row?.n ?? 0) };
  },

  /** Скільки завантажень зробив користувач за останню добу — антиспам. */
  async recentByUser(guildId, userId, sinceMs = 86400_000) {
    const row = await get(
      'SELECT COUNT(*) AS n FROM gallery_items WHERE guild_id = ? AND user_id = ? AND created_at > ?',
      [guildId, userId, Date.now() - sinceMs],
    );
    return num(row?.n ?? 0);
  },
};

// ─────────────────────────────────────────────
//  КІНОТЕАТР (спільний перегляд)
// ─────────────────────────────────────────────
export const cinemaRepo = {
  async get(guildId) {
    const row = await get('SELECT * FROM cinema_state WHERE guild_id = ?', [guildId]);
    if (!row) return null;
    return {
      source: row.source ?? null,
      title: row.title ?? null,
      provider: row.provider ?? 'file',
      syncMode: row.sync_mode ?? 'full',
      pageUrl: row.page_url ?? null,
      qualities: safeJson(row.qualities) ?? [],
      variants: safeJson(row.variants) ?? [],
      hardPause: row.hard_pause == null ? true : !!num(row.hard_pause),
      playing: !!num(row.playing),
      positionMs: num(row.position_ms),
      updatedAt: num(row.updated_at),
      updatedBy: row.updated_by ?? null,
    };
  },

  save(guildId, {
    source, title, provider = 'file', syncMode = 'full', pageUrl = null,
    qualities = [], variants = [], hardPause = true, playing, positionMs, updatedBy,
  }) {
    return run(`
      INSERT INTO cinema_state
        (guild_id, source, title, provider, sync_mode, page_url, qualities, variants,
         hard_pause, playing, position_ms, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id) DO UPDATE SET
        source = excluded.source, title = excluded.title, provider = excluded.provider,
        sync_mode = excluded.sync_mode, page_url = excluded.page_url,
        qualities = excluded.qualities, variants = excluded.variants,
        hard_pause = excluded.hard_pause, playing = excluded.playing,
        position_ms = excluded.position_ms, updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `, [guildId, source ?? null, title ?? null, provider, syncMode, pageUrl,
      qualities?.length ? JSON.stringify(qualities) : null,
      variants?.length ? JSON.stringify(variants) : null,
      hardPause ? 1 : 0,
      playing ? 1 : 0, Math.max(0, Math.round(positionMs || 0)), Date.now(), updatedBy ?? null]);
  },

  clear(guildId) {
    return run('DELETE FROM cinema_state WHERE guild_id = ?', [guildId]);
  },
};

/** Черга «що дивимось далі». */
export const cinemaQueueRepo = {
  /** Порядок: за position, а для старих записів — за часом додавання. */
  ORDER: 'ORDER BY COALESCE(position, created_at) ASC, id ASC',

  async list(guildId, limit = 40) {
    const rows = await all(
      `SELECT * FROM cinema_queue WHERE guild_id = ? ${this.ORDER} LIMIT ?`,
      [guildId, limit],
    );
    return rows.map(shapeQueue);
  },

  async first(guildId) {
    const row = await get(`SELECT * FROM cinema_queue WHERE guild_id = ? ${this.ORDER} LIMIT 1`, [guildId]);
    return row ? shapeQueue(row) : null;
  },

  async add(guildId, item) {
    const now = Date.now();
    const res = await run(`
      INSERT INTO cinema_queue
        (guild_id, source, page_url, provider, sync_mode, qualities, title, added_by, added_name, created_at, position)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [guildId, item.source, item.pageUrl ?? null, item.provider ?? 'file', item.syncMode ?? 'full',
      item.qualities?.length ? JSON.stringify(item.qualities) : null,
      item.title ?? null, item.addedBy, item.addedName ?? null, now, now]);
    return num(res.lastInsertRowid);
  },

  /**
   * Пересунути запис на крок вгору або вниз — міняємо позиції з сусідом.
   * @param {number} dir -1 вгору, +1 вниз
   */
  async move(guildId, id, dir) {
    const items = await this.list(guildId, 100);
    const i = items.findIndex((x) => x.id === id);
    const j = i + (dir < 0 ? -1 : 1);
    if (i < 0 || j < 0 || j >= items.length) return false;

    // позиції могли бути порожні (старі записи) — розставляємо їх наново
    const order = items.map((x, k) => ({ id: x.id, pos: x.position ?? (x.createdAt + k) }));
    const tmp = order[i].pos;
    order[i].pos = order[j].pos;
    order[j].pos = tmp;

    for (const o of [order[i], order[j]]) {
      await run('UPDATE cinema_queue SET position = ? WHERE guild_id = ? AND id = ?', [o.pos, guildId, o.id]);
    }
    return true;
  },

  remove(guildId, id) {
    return run('DELETE FROM cinema_queue WHERE guild_id = ? AND id = ?', [guildId, id]);
  },

  clear(guildId) {
    return run('DELETE FROM cinema_queue WHERE guild_id = ?', [guildId]);
  },

  async count(guildId) {
    const row = await get('SELECT COUNT(*) AS n FROM cinema_queue WHERE guild_id = ?', [guildId]);
    return num(row?.n ?? 0);
  },
};

function shapeQueue(row) {
  return {
    id: num(row.id),
    position: row.position == null ? null : num(row.position),
    source: row.source,
    pageUrl: row.page_url ?? null,
    provider: row.provider ?? 'file',
    syncMode: row.sync_mode ?? 'full',
    qualities: safeJson(row.qualities) ?? [],
    title: row.title ?? null,
    addedBy: row.added_by,
    addedName: row.added_name ?? null,
    createdAt: num(row.created_at),
  };
}

/** Журнал дій у залі — щоб адміністратор бачив, хто що робив. */
export const cinemaLogRepo = {
  add(guildId, { userId, username, action, detail }) {
    return run(
      'INSERT INTO cinema_log (guild_id, user_id, username, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [guildId, userId ?? null, username ?? null, action, detail ?? null, Date.now()],
    );
  },

  async list(guildId, limit = 40) {
    const rows = await all(
      'SELECT * FROM cinema_log WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?',
      [guildId, limit],
    );
    return rows.map((r) => ({
      id: num(r.id),
      userId: r.user_id,
      username: r.username,
      action: r.action,
      detail: r.detail,
      at: num(r.created_at),
    }));
  },

  /** Прибирання старих записів — журнал не має рости вічно. */
  prune(guildId, keepDays = 30) {
    return run('DELETE FROM cinema_log WHERE guild_id = ? AND created_at < ?',
      [guildId, Date.now() - keepDays * 86400_000]);
  },
};

// ─────────────────────────────────────────────
//  ЧИННІ ПОКАРАННЯ
// ─────────────────────────────────────────────
export const punishRepo = {
  /** Поставити або продовжити покарання. */
  set({ guildId, userId, kind, until, reason, moderatorId }) {
    return run(`
      INSERT INTO punishments (guild_id, user_id, kind, until, reason, moderator_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, kind) DO UPDATE SET
        until = excluded.until, reason = excluded.reason,
        moderator_id = excluded.moderator_id, created_at = excluded.created_at
    `, [guildId, userId, kind, until ?? null, reason ?? null, moderatorId, Date.now()]);
  },

  remove(guildId, userId, kind) {
    return run('DELETE FROM punishments WHERE guild_id = ? AND user_id = ? AND kind = ?', [guildId, userId, kind]);
  },

  removeAll(guildId, userId) {
    return run('DELETE FROM punishments WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  },

  async forUser(guildId, userId) {
    const rows = await all('SELECT * FROM punishments WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    return rows.map(shapePunish);
  },

  async active(guildId, limit = 50) {
    const rows = await all(
      'SELECT * FROM punishments WHERE guild_id = ? ORDER BY created_at DESC LIMIT ?',
      [guildId, limit],
    );
    return rows.map(shapePunish);
  },

  /** Ті, чий час вийшов — їх треба зняти. */
  async expired(now = Date.now()) {
    const rows = await all('SELECT * FROM punishments WHERE until IS NOT NULL AND until <= ?', [now]);
    return rows.map(shapePunish);
  },
};

function shapePunish(row) {
  return {
    guildId: row.guild_id,
    userId: row.user_id,
    kind: row.kind,
    until: row.until == null ? null : num(row.until),
    reason: row.reason ?? null,
    moderatorId: row.moderator_id,
    createdAt: num(row.created_at),
  };
}

// ─────────────────────────────────────────────
//  ПОПЕРЕДЖЕННЯ
// ─────────────────────────────────────────────
export const warnRepo = {
  /** Термін життя одного попередження. */
  TTL_MS: 72 * 3600_000,

  async add(guildId, userId, { reason, moderatorId }) {
    const now = Date.now();
    const res = await run(`
      INSERT INTO warnings (guild_id, user_id, reason, moderator_id, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [guildId, userId, reason ?? null, moderatorId, now, now + this.TTL_MS]);
    return num(res.lastInsertRowid);
  },

  /** Чинні попередження — прострочені не рахуються. */
  async active(guildId, userId, now = Date.now()) {
    const rows = await all(
      'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? AND expires_at > ? ORDER BY created_at ASC',
      [guildId, userId, now],
    );
    return rows.map(shapeWarn);
  },

  /** Скільки в кого чинних — для списку в панелі. */
  async counts(guildId, now = Date.now()) {
    const rows = await all(`
      SELECT user_id, COUNT(*) AS n, MIN(expires_at) AS soonest
      FROM warnings WHERE guild_id = ? AND expires_at > ?
      GROUP BY user_id ORDER BY n DESC, soonest ASC
    `, [guildId, now]);
    return rows.map((r) => ({ userId: r.user_id, count: num(r.n), soonest: num(r.soonest) }));
  },

  /** Зняти одне (найстаріше або вказане). */
  async removeOne(guildId, userId, id = null) {
    if (id) return run('DELETE FROM warnings WHERE guild_id = ? AND user_id = ? AND id = ?', [guildId, userId, id]);
    const row = await get(
      'SELECT id FROM warnings WHERE guild_id = ? AND user_id = ? AND expires_at > ? ORDER BY created_at ASC LIMIT 1',
      [guildId, userId, Date.now()],
    );
    if (!row) return null;
    return run('DELETE FROM warnings WHERE id = ?', [num(row.id)]);
  },

  clear(guildId, userId) {
    return run('DELETE FROM warnings WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
  },

  /** Прибирання згаслих — щоб таблиця не росла вічно. */
  purge(now = Date.now()) {
    return run('DELETE FROM warnings WHERE expires_at <= ?', [now]);
  },
};

// ─────────────────────────────────────────────
//  КОСМЕТИКА: ГАМАНЕЦЬ, ПОКУПКИ, ВИГЛЯД ПРОФІЛЮ
// ─────────────────────────────────────────────
export const walletRepo = {
  async get(guildId, userId) {
    const row = await get('SELECT * FROM wallets WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    if (!row) return { balance: 0, earned: 0, lastGrant: null, level: 1, spentLevels: 0 };
    return {
      balance: num(row.balance),
      earned: num(row.earned),
      lastGrant: row.last_grant ?? null,
      // рівень у всіх стартує з першого, навіть у старих рядків
      level: Math.max(1, num(row.level ?? 1)),
      spentLevels: num(row.spent_levels ?? 0),
    };
  },

  /** Підняти рівень на один. Гроші вже мають бути списані. */
  async levelUp(guildId, userId, cost) {
    await run(`
      UPDATE wallets SET level = MAX(1, level) + 1, spent_levels = spent_levels + ?
      WHERE guild_id = ? AND user_id = ?
    `, [Math.max(0, cost), guildId, userId]);
    return this.get(guildId, userId);
  },

  /** Найвищі рівні гільдії — для сторінки рейтингу. */
  levels(guildId) {
    return all('SELECT user_id, level FROM wallets WHERE guild_id = ?', [guildId]);
  },

  /** Нарахувати. day — щоб не видати двічі за той самий день. */
  async add(guildId, userId, amount, day = null) {
    await run(`
      INSERT INTO wallets (guild_id, user_id, balance, earned, last_grant)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        balance = balance + excluded.balance,
        earned = earned + excluded.earned,
        last_grant = COALESCE(excluded.last_grant, wallets.last_grant)
    `, [guildId, userId, amount, Math.max(0, amount), day]);
    return this.get(guildId, userId);
  },

  /** Списати. Повертає false, якщо не вистачає — без від'ємних балансів. */
  async spend(guildId, userId, amount) {
    const w = await this.get(guildId, userId);
    if (w.balance < amount) return false;
    await run(
      'UPDATE wallets SET balance = balance - ? WHERE guild_id = ? AND user_id = ? AND balance >= ?',
      [amount, guildId, userId, amount],
    );
    return true;
  },

  top(guildId, limit = 20) {
    return all(
      'SELECT user_id, balance FROM wallets WHERE guild_id = ? ORDER BY balance DESC LIMIT ?',
      [guildId, limit],
    );
  },
};

/**
 * Скільки часу людина провела в іграх.
 *
 * Discord не зберігає й не віддає «наіграні години» — такого в його API просто
 * немає. Видно лише те, у що людина грає ПРЯМО ЗАРАЗ. Тому години рахує сам
 * бот: бачить початок гри, бачить кінець, додає різницю. Отже, статистика
 * починається з дня, коли стеження увімкнули, — минулого не відновити.
 */
export const gamesRepo = {
  /** Долічити хвилини до гри. */
  add(guildId, userId, game, minutes) {
    const m = Math.max(0, Math.round(minutes));
    if (!m) return null;
    return run(`
      INSERT INTO user_games (guild_id, user_id, game, minutes, last_seen)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, game) DO UPDATE SET
        minutes = minutes + excluded.minutes,
        last_seen = excluded.last_seen
    `, [guildId, userId, String(game).slice(0, 80), m, Date.now()]);
  },

  /** Ігри однієї людини — найдовші згори. */
  list(guildId, userId, limit = 8) {
    return all(`
      SELECT game, minutes, last_seen FROM user_games
      WHERE guild_id = ? AND user_id = ? AND minutes > 0
      ORDER BY minutes DESC LIMIT ?
    `, [guildId, userId, limit]);
  },

  async total(guildId, userId) {
    const row = await get(
      'SELECT SUM(minutes) AS n FROM user_games WHERE guild_id = ? AND user_id = ?',
      [guildId, userId],
    );
    return num(row?.n ?? 0);
  },
};

export const itemsRepo = {
  async owned(guildId, userId) {
    const rows = await all('SELECT item_id FROM user_items WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    return rows.map((r) => r.item_id);
  },

  async has(guildId, userId, itemId) {
    const row = await get(
      'SELECT 1 AS x FROM user_items WHERE guild_id = ? AND user_id = ? AND item_id = ?',
      [guildId, userId, itemId],
    );
    return !!row;
  },

  give(guildId, userId, itemId, price = 0) {
    return run(`
      INSERT INTO user_items (guild_id, user_id, item_id, price, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(guild_id, user_id, item_id) DO NOTHING
    `, [guildId, userId, itemId, price, Date.now()]);
  },

  /**
   * Хто має цю річ і скільки за неї заплатив. Потрібно, коли роботу
   * видаляють: покупцям треба щось повернути.
   */
  owners(guildId, itemId) {
    return all('SELECT user_id, price FROM user_items WHERE guild_id = ? AND item_id = ?',
      [guildId, itemId]);
  },

  /** Прибрати річ у всіх — разом із самою роботою. */
  removeAll(guildId, itemId) {
    return run('DELETE FROM user_items WHERE guild_id = ? AND item_id = ?', [guildId, itemId]);
  },
};

/** Особисті картинки оформлення. Файли — у приватному каналі Discord. */
export const assetsRepo = {
  async add(guildId, userId, { kind, mime, sizeBytes, objectKey, url, urlExpires }) {
    const res = await run(`
      INSERT INTO user_assets (guild_id, user_id, kind, mime, size_bytes, object_key, url, url_expires, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [guildId, userId, kind, mime ?? null, sizeBytes ?? 0, objectKey ?? null, url ?? null,
      urlExpires ?? null, Date.now()]);
    return num(res.lastInsertRowid);
  },

  meta(id) {
    return get('SELECT * FROM user_assets WHERE id = ?', [id]);
  },

  list(guildId, userId, kind = null, limit = 24) {
    const where = kind ? 'AND kind = ?' : '';
    const args = kind ? [guildId, userId, kind, limit] : [guildId, userId, limit];
    return all(`
      SELECT * FROM user_assets WHERE guild_id = ? AND user_id = ? ${where}
      ORDER BY created_at DESC LIMIT ?
    `, args);
  },

  /** Вітрина: усе, що учасники виставили на продаж. */
  market(guildId, limit = 60) {
    return all(`
      SELECT * FROM user_assets WHERE guild_id = ? AND listed = 1
      ORDER BY sales DESC, created_at DESC LIMIT ?
    `, [guildId, limit]);
  },

  /** Виставити або зняти з вітрини. */
  setListing(guildId, userId, id, { listed, price, title, booster = null }) {
    return run(`
      UPDATE user_assets SET listed = ?, price = ?, title = COALESCE(?, title),
        booster = COALESCE(?, booster)
      WHERE guild_id = ? AND user_id = ? AND id = ?
    `, [listed ? 1 : 0, Math.max(0, Math.round(price ?? 0)), title ?? null,
      booster === null ? null : (booster ? 1 : 0), guildId, userId, id]);
  },

  /**
   * Правка від адміністратора: без прив'язки до автора. Передані лише ті поля,
   * які справді міняють, — решта лишається як була.
   */
  edit(guildId, id, { title = null, price = null, booster = null, listed = null }) {
    return run(`
      UPDATE user_assets SET
        title   = COALESCE(?, title),
        price   = COALESCE(?, price),
        booster = COALESCE(?, booster),
        listed  = COALESCE(?, listed)
      WHERE guild_id = ? AND id = ?
    `, [title, price === null ? null : Math.max(0, Math.round(price)),
      booster === null ? null : (booster ? 1 : 0),
      listed === null ? null : (listed ? 1 : 0), guildId, id]);
  },

  /** Видалення без прив'язки до автора — для адміністратора. */
  removeById(guildId, id) {
    return run('DELETE FROM user_assets WHERE guild_id = ? AND id = ?', [guildId, id]);
  },

  addSale(id) {
    return run('UPDATE user_assets SET sales = sales + 1 WHERE id = ?', [id]);
  },

  refreshUrl(id, url, expires) {
    return run('UPDATE user_assets SET url = ?, url_expires = ? WHERE id = ?', [url, expires, id]);
  },

  remove(guildId, userId, id) {
    return run('DELETE FROM user_assets WHERE guild_id = ? AND user_id = ? AND id = ?', [guildId, userId, id]);
  },

  async count(guildId, userId) {
    const row = await get('SELECT COUNT(*) AS n FROM user_assets WHERE guild_id = ? AND user_id = ?',
      [guildId, userId]);
    return num(row?.n ?? 0);
  },
};

export const prefsRepo = {
  async get(guildId, userId) {
    const row = await get('SELECT * FROM profile_prefs WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    if (!row) return { about: '', banner: null, accent: null, background: null, layout: null };
    return {
      about: row.about ?? '',
      banner: row.banner ?? null,
      accent: row.accent ?? null,
      background: row.background ?? null,
      layout: safeJson(row.layout) ?? null,
    };
  },

  /**
   * Налаштування кількох людей одним запитом. Потрібно сторінці рейтингу:
   * вона показує картку кожного в його ж оформленні, а ходити в базу
   * по одному — це п'ятдесят мережевих запитів на одну сторінку.
   */
  async many(guildId, userIds = []) {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length) return new Map();
    const holes = ids.map(() => '?').join(',');
    const rows = await all(
      `SELECT * FROM profile_prefs WHERE guild_id = ? AND user_id IN (${holes})`,
      [guildId, ...ids],
    );
    const out = new Map();
    for (const row of rows) {
      out.set(row.user_id, {
        about: row.about ?? '',
        banner: row.banner ?? null,
        accent: row.accent ?? null,
        background: row.background ?? null,
        layout: safeJson(row.layout) ?? null,
      });
    }
    return out;
  },

  /** Пишемо лише передані поля — решта лишається як була. */
  async save(guildId, userId, patch) {
    const cur = await this.get(guildId, userId);
    const next = {
      about: patch.about ?? cur.about,
      banner: patch.banner === undefined ? cur.banner : patch.banner,
      accent: patch.accent === undefined ? cur.accent : patch.accent,
      background: patch.background === undefined ? cur.background : patch.background,
      layout: patch.layout === undefined ? cur.layout : patch.layout,
    };
    await run(`
      INSERT INTO profile_prefs (guild_id, user_id, about, banner, accent, background, layout, updated_at)
      VALUES (@g, @u, @about, @banner, @accent, @background, @layout, @now)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET
        about=excluded.about, banner=excluded.banner, accent=excluded.accent,
        background=excluded.background, layout=excluded.layout, updated_at=excluded.updated_at
    `, {
      g: guildId, u: userId, about: next.about ?? '', banner: next.banner,
      accent: next.accent, background: next.background,
      layout: next.layout ? JSON.stringify(next.layout) : null, now: Date.now(),
    });
    return next;
  },
};

// ─────────────────────────────────────────────
//  ДІЇ ПЕРСОНАЛУ (нагляд)
// ─────────────────────────────────────────────
export const staffRepo = {
  /** Скільки тримаємо записи — довше вікна нагляду тримати немає сенсу. */
  TTL_MS: 6 * 3600_000,

  async add(guildId, { moderatorId, targetId, action, weight = 1 }) {
    const res = await run(`
      INSERT INTO staff_actions (guild_id, moderator_id, target_id, action, weight, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [guildId, moderatorId, targetId ?? null, action, weight, Date.now()]);
    return num(res.lastInsertRowid);
  },

  /** Дії одного модератора за останні windowMs. */
  async recent(guildId, moderatorId, windowMs, now = Date.now()) {
    const rows = await all(`
      SELECT * FROM staff_actions
      WHERE guild_id = ? AND moderator_id = ? AND created_at > ?
      ORDER BY created_at ASC
    `, [guildId, moderatorId, now - windowMs]);
    return rows.map(shapeStaff);
  },

  purge(now = Date.now()) {
    return run('DELETE FROM staff_actions WHERE created_at <= ?', [now - staffRepo.TTL_MS]);
  },
};

function shapeStaff(row) {
  return {
    id: num(row.id),
    moderatorId: row.moderator_id,
    targetId: row.target_id ?? null,
    action: row.action,
    weight: Number(row.weight ?? 1),
    createdAt: num(row.created_at),
  };
}

function shapeWarn(row) {
  return {
    id: num(row.id),
    userId: row.user_id,
    reason: row.reason ?? null,
    moderatorId: row.moderator_id,
    createdAt: num(row.created_at),
    expiresAt: num(row.expires_at),
  };
}

export const sessionsRepo = {
  create({ token, guildId, userId, username, avatar, ttlMs }) {
    const now = Date.now();
    return run(`
      INSERT INTO web_sessions (token, guild_id, user_id, username, avatar, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [token, guildId ?? null, userId, username ?? null, avatar ?? null, now, now + ttlMs]);
  },

  async get(token) {
    const row = await get('SELECT * FROM web_sessions WHERE token = ?', [token]);
    if (!row) return null;
    if (num(row.expires_at) < Date.now()) {
      await this.remove(token);
      return null;
    }
    return row;
  },

  remove(token) {
    return run('DELETE FROM web_sessions WHERE token = ?', [token]);
  },

  purgeExpired() {
    return run('DELETE FROM web_sessions WHERE expires_at < ?', [Date.now()]);
  },
};

// ── helpers ──────────────────────────────────
/** JSON із БД, який не має права зронити запит. */
function safeJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function round2(v) {
  return Math.round(v * 100) / 100;
}
