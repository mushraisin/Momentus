/**
 * Мінімальний парсер multipart/form-data — без зовнішніх залежностей.
 * Обробляє текстові поля та ОДИН файл (цього достатньо для завантаження кліпу).
 * Читає потік із жорстким лімітом розміру, щоб не з'їсти пам'ять хостингу.
 */

/**
 * @param {import('node:http').IncomingMessage} req
 * @param {{ maxBytes:number }} opts
 * @returns {Promise<{ fields:Record<string,string>, file:{filename:string,mime:string,data:Buffer}|null }>}
 */
export function parseMultipart(req, { maxBytes = 8 * 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] ?? '';
    const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(ct);
    if (!m) return reject(new Error('Немає boundary у content-type'));

    const boundary = `--${(m[1] ?? m[2]).trim()}`;
    const chunks = [];
    let total = 0;
    let aborted = false;

    req.on('data', (c) => {
      if (aborted) return;
      total += c.length;
      if (total > maxBytes) {
        aborted = true;
        reject(new Error('TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });

    req.on('error', (err) => !aborted && reject(err));

    // Обірваний вивантаж (людина закрила вкладку посеред заливки) не дає
    // події 'end', тож без цього обіцянка лишалася висіти назавжди, а вже
    // прочитані шматки файлу — в пам'яті.
    req.on('aborted', () => {
      if (aborted) return;
      aborted = true;
      chunks.length = 0;
      reject(new Error('ABORTED'));
    });

    req.on('end', () => {
      if (aborted) return;
      try {
        resolve(split(Buffer.concat(chunks), boundary));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function split(buf, boundary) {
  const bBuf = Buffer.from(boundary);
  const fields = {};
  let file = null;

  let pos = buf.indexOf(bBuf);
  while (pos !== -1) {
    const start = pos + bBuf.length;
    // кінець форми: "--boundary--"
    if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break;

    const next = buf.indexOf(bBuf, start);
    if (next === -1) break;

    // частина = заголовки \r\n\r\n тіло \r\n
    const part = buf.subarray(start + 2, next - 2);
    const sep = part.indexOf('\r\n\r\n');
    if (sep === -1) { pos = next; continue; }

    const rawHeaders = part.subarray(0, sep).toString('utf8');
    const body = part.subarray(sep + 4);

    const nameM = /name="([^"]*)"/i.exec(rawHeaders);
    const fileM = /filename="([^"]*)"/i.exec(rawHeaders);
    const typeM = /content-type:\s*([^\r\n;]+)/i.exec(rawHeaders);
    const name = nameM?.[1] ?? '';

    if (fileM && fileM[1]) {
      file = {
        field: name,
        filename: fileM[1],
        mime: (typeM?.[1] ?? 'application/octet-stream').trim().toLowerCase(),
        data: body,
      };
    } else if (name) {
      fields[name] = body.toString('utf8');
    }

    pos = next;
  }

  return { fields, file };
}

/** Дозволені типи медіа для галереї. */
export const MEDIA_TYPES = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/webp': 'image',
  'image/gif': 'gif',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
};

export function kindOf(mime) {
  return MEDIA_TYPES[mime] ?? null;
}
