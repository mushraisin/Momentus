import crypto from 'node:crypto';
import { createLogger } from '../core/logger.js';

const log = createLogger('storage');

/**
 * Об'єктне сховище, сумісне з S3 (Cloudflare R2, Backblaze B2, MinIO…).
 * Підписуємо запити AWS SigV4 вручну — без важкого SDK.
 *
 * Налаштування (.env):
 *   S3_ENDPOINT   https://<account_id>.r2.cloudflarestorage.com
 *   S3_BUCKET     назва бакета
 *   S3_ACCESS_KEY / S3_SECRET_KEY
 *   S3_PUBLIC_URL публічна адреса (r2.dev або свій домен) — звідки віддається медіа
 *   S3_REGION     для R2 — auto
 *
 * Якщо не налаштовано — галерея прозоро зберігає файли в БД (як раніше).
 */
const cfg = {
  endpoint: (process.env.S3_ENDPOINT || '').replace(/\/$/, ''),
  bucket: process.env.S3_BUCKET || '',
  key: process.env.S3_ACCESS_KEY || '',
  secret: process.env.S3_SECRET_KEY || '',
  region: process.env.S3_REGION || 'auto',
  publicUrl: (process.env.S3_PUBLIC_URL || '').replace(/\/$/, ''),
};

export const storage = {
  get configured() {
    return !!(cfg.endpoint && cfg.bucket && cfg.key && cfg.secret);
  },

  get info() {
    return this.configured
      ? `S3/R2 (${cfg.bucket})`
      : 'база даних';
  },

  /** Публічне посилання на об'єкт. */
  publicUrl(objectKey) {
    if (cfg.publicUrl) return `${cfg.publicUrl}/${objectKey}`;
    return `${cfg.endpoint}/${cfg.bucket}/${objectKey}`;
  },

  /**
   * Завантажити файл. @returns {Promise<{key:string,url:string}>}
   */
  async put(objectKey, body, contentType) {
    if (!this.configured) throw new Error('S3 не налаштовано');
    const url = `${cfg.endpoint}/${cfg.bucket}/${encodeKey(objectKey)}`;
    const res = await signedFetch('PUT', url, body, {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`S3 PUT ${res.status}: ${text.slice(0, 160)}`);
    }
    return { key: objectKey, url: this.publicUrl(objectKey) };
  },

  /** Видалити об'єкт (помилки не критичні — лише лог). */
  async remove(objectKey) {
    if (!this.configured || !objectKey) return false;
    try {
      const url = `${cfg.endpoint}/${cfg.bucket}/${encodeKey(objectKey)}`;
      const res = await signedFetch('DELETE', url, null, {});
      return res.ok || res.status === 404;
    } catch (err) {
      log.warn('S3 DELETE впав', err.message);
      return false;
    }
  },

  /** Перевірка доступу — корисно на старті. */
  async check() {
    if (!this.configured) return { ok: false, reason: 'не налаштовано' };
    try {
      const probe = `_healthcheck/${Date.now()}.txt`;
      await this.put(probe, Buffer.from('ok'), 'text/plain');
      await this.remove(probe);
      return { ok: true };
    } catch (err) {
      return { ok: false, reason: err.message };
    }
  },
};

// ─────────────────────────────────────────────
//  AWS Signature V4
// ─────────────────────────────────────────────
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();
const sha256hex = (data) => crypto.createHash('sha256').update(data ?? '').digest('hex');

/** Кодуємо кожен сегмент ключа окремо, зберігаючи «/». */
function encodeKey(key) {
  return String(key).split('/').map(encodeURIComponent).join('/');
}

function signedFetch(method, urlStr, body, extraHeaders) {
  const u = new URL(urlStr);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256hex(body ?? '');

  const headers = {
    host: u.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  for (const [k, v] of Object.entries(extraHeaders ?? {})) {
    if (v) headers[k.toLowerCase()] = v;
  }

  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((k) => `${k}:${String(headers[k]).trim()}\n`).join('');
  const signedHeaders = names.join(';');

  const canonicalRequest = [
    method,
    u.pathname,
    u.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256hex(canonicalRequest),
  ].join('\n');

  let signingKey = hmac(`AWS4${cfg.secret}`, dateStamp);
  signingKey = hmac(signingKey, cfg.region);
  signingKey = hmac(signingKey, 's3');
  signingKey = hmac(signingKey, 'aws4_request');
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.key}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return fetch(urlStr, { method, headers, body: body ?? undefined });
}

/** Розширення за MIME — для гарних ключів у бакеті. */
export function extFor(mime) {
  return {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
  }[mime] ?? 'bin';
}
