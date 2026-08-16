import { staffRepo, modRepo, usersRepo } from '../database/repositories.js';
import { configService } from './configService.js';
import { punishmentService, KIND_LABEL } from './punishmentService.js';
import { OWNER_ID } from '../config/constants.js';
import { createLogger } from '../core/logger.js';

const log = createLogger('staff');

/**
 * Нагляд за тими, у кого є нативні права Discord.
 *
 * Ролі з правами «Відключати учасників», «Заглушувати», «Виганяти» тощо
 * працюють повз бота — людина тисне кнопку в самому Discord. Але слід
 * лишається в журналі аудиту, і саме звідти ми беремо події.
 *
 * Логіка проста: кожна дія має вагу, ваги складаються у ковзному вікні.
 * Перевалило поріг — модератор сам отримує автоматичне попередження
 * (те саме, зі строком життя 72 години; три поспіль → повний мут).
 *
 * Окремо ловимо «довбання по одній людині»: коли когось за кілька хвилин
 * по колу відключають чи мутять — це вже не модерація, а цькування.
 */

/** Вага дії. Що серйозніша й незворотніша — то більша. */
export const ACTION_WEIGHT = {
  'voice.disconnect': 3,     // викинув із голосового
  'voice.move': 1.5,         // перетягнув в інший канал
  'voice.mute': 2.5,         // серверний мут (вимкнув мікрофон)
  'voice.deafen': 2.5,       // серверне оглушення
  timeout: 3,
  kick: 5,
  ban: 6,
  'message.bulkDelete': 3,
  'punish.lift': 4,          // зняття покарання повз систему
};

export const ACTION_LABEL = {
  'voice.disconnect': 'відключення з голосового',
  'voice.move': 'перетягування між каналами',
  'voice.mute': 'вимкнення мікрофона',
  'voice.deafen': 'вимкнення звуку',
  timeout: 'тайм-аут',
  kick: 'виганяння',
  ban: 'бан',
  'message.bulkDelete': 'масове видалення повідомлень',
  'punish.lift': 'зняття покарання повз систему',
};

/** Щоб не сипати попередженнями чергою — одне на модератора за вікно. */
const cooldown = new Map();   // `${guildId}:${moderatorId}` → час останнього авто-попередження

export const staffWatch = {
  ACTION_WEIGHT,
  ACTION_LABEL,

  /** Налаштування нагляду для гільдії. */
  settings(guildId) {
    const cfg = configService.all(guildId);
    return {
      on: cfg['moderation.staffWatch'] !== false,
      windowMs: Math.max(1, Number(cfg['moderation.staffWindowMin'] ?? 10)) * 60_000,
      limit: Math.max(1, Number(cfg['moderation.staffLimit'] ?? 10)),
      sameLimit: Math.max(2, Number(cfg['moderation.staffSameTargetLimit'] ?? 4)),
      exempt: cfg['moderation.staffExemptRoles'] ?? [],
    };
  },

  /** Чи цей модератор поза наглядом (власник або роль-виняток). */
  exempt(guildId, member) {
    if (!member) return true;
    if (member.user?.bot) return true;
    if (member.id === OWNER_ID) return true;
    const { exempt } = this.settings(guildId);
    return exempt.some((id) => member.roles?.cache?.has(id));
  },

  /**
   * Зафіксувати дію персоналу й перевірити, чи не забагато їх.
   *
   * @returns {Promise<null|{count:number, score:number, reason:string, auto:object|null}>}
   *          null — усе гаразд; інакше опис виданого попередження.
   */
  async record(guild, { moderatorId, targetId, action, count = 1 }) {
    const s = this.settings(guild.id);
    if (!s.on || !moderatorId || moderatorId === 'unknown') return null;
    if (moderatorId === guild.client?.user?.id) return null;          // власні дії бота

    const weight = (ACTION_WEIGHT[action] ?? 1) * Math.max(1, count);
    await staffRepo.add(guild.id, { moderatorId, targetId, action, weight });

    const mod = guild.members.cache.get(moderatorId)
      ?? await guild.members.fetch(moderatorId).catch(() => null);
    if (this.exempt(guild.id, mod)) return null;

    const last = cooldown.get(`${guild.id}:${moderatorId}`) ?? 0;
    if (Date.now() - last < s.windowMs) return null;                  // вже попереджали в цьому вікні

    const rows = await staffRepo.recent(guild.id, moderatorId, s.windowMs);
    const score = rows.reduce((a, r) => a + r.weight, 0);

    // по одній і тій самій людині — окремий, суворіший рахунок
    const perTarget = new Map();
    for (const r of rows) {
      if (!r.targetId) continue;
      perTarget.set(r.targetId, (perTarget.get(r.targetId) ?? 0) + 1);
    }
    const [hotTarget, hotCount] = [...perTarget.entries()]
      .sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

    let reason = null;
    if (hotCount >= s.sameLimit) {
      reason = `Зловживання правами: ${hotCount} дій проти одного учасника `
        + `за ${Math.round(s.windowMs / 60_000)} хв`;
    } else if (score >= s.limit) {
      reason = `Зловживання правами: ${rows.length} дій (вага ${round(score)}) `
        + `за ${Math.round(s.windowMs / 60_000)} хв`;
    }
    if (!reason) return null;

    cooldown.set(`${guild.id}:${moderatorId}`, Date.now());

    await usersRepo.ensure(guild.id, moderatorId, mod?.user?.username ?? null, null).catch(() => {});
    const { count: warnCount, auto } = await punishmentService.warn(guild, mod, {
      reason, moderatorId: 'system',
    });

    // сповіщення такі самі, як у ручного попередження — лог-канал і ЛС
    await punishmentService.notify(guild, {
      target: mod.user, moderator: 'system', kind: 'warn', reason,
      note: summary(rows, hotTarget, hotCount),
    }).catch(() => {});
    if (auto) {
      await punishmentService.notify(guild, {
        target: mod.user, moderator: 'system', kind: 'full',
        minutes: auto.minutes, reason: `${warnCount}/${warnCount} попереджень`,
      }).catch(() => {});
    }

    await modRepo.add({
      guildId: guild.id, userId: moderatorId, moderatorId: 'system',
      action: 'staff.abuse', reason, result: 'applied',
      note: summary(rows, hotTarget, hotCount),
    }).catch(() => {});

    log.info(`Авто-попередження ${moderatorId}: ${reason}`);
    return { count: warnCount, score: round(score), reason, auto };
  },

  /**
   * Покарання зняли повз бота — просто в Discord.
   *
   * Знімати можна лише через панель чи сайт: там працює ієрархія
   * (знімає той, чия роль вища за роль того, хто видав). Тому таке зняття
   * ми відкочуємо: покарання повертається з тим самим строком, а той,
   * хто його зняв, отримує попередження.
   *
   * Винятки (власник, ролі поза наглядом) не караються — для них це
   * рахується як звичайне зняття, запис просто прибирається.
   *
   * @returns {Promise<null|{restored:boolean, warned:boolean, kind:string}>}
   */
  async unauthorizedLift(guild, { moderatorId, targetId, kind }) {
    if (!moderatorId || !targetId) return null;
    if (moderatorId === guild.client?.user?.id) return null;      // це зняв сам бот
    if (moderatorId === targetId) return null;                    // сам себе не звільнить

    const list = await punishmentService.forUser(guild.id, targetId).catch(() => []);
    const p = list.find((x) => x.kind === kind && (!x.until || x.until > Date.now()));
    if (!p) return null;                                          // ми такого не видавали

    const mod = guild.members.cache.get(moderatorId)
      ?? await guild.members.fetch(moderatorId).catch(() => null);
    const target = guild.members.cache.get(targetId)
      ?? await guild.members.fetch(targetId).catch(() => null);

    // винятки знімають як хочуть — просто закриваємо запис
    if (this.exempt(guild.id, mod)) {
      await punishmentService.lift(guild, targetId, kind, moderatorId).catch(() => {});
      return { restored: false, warned: false, kind };
    }
    if (!target) return null;

    const restored = await punishmentService.restore(guild, target, p).catch(() => false);

    const reason = `Зняв ${KIND_LABEL[kind] ?? kind} повз систему модерації`;
    const note = `кому: <@${targetId}> · видав: ${p.moderatorId === 'system' ? 'Система' : `<@${p.moderatorId}>`}`
      + (restored ? ' · покарання повернуто' : '');

    let warned = false;
    if (mod) {
      const { auto } = await punishmentService.warn(guild, mod, { reason, moderatorId: 'system' });
      warned = true;
      await punishmentService.notify(guild, {
        target: mod.user, moderator: 'system', kind: 'warn', reason, note,
      }).catch(() => {});
      if (auto) {
        await punishmentService.notify(guild, {
          target: mod.user, moderator: 'system', kind: 'full',
          minutes: auto.minutes, reason: 'Три попередження',
        }).catch(() => {});
      }
    }

    await staffRepo.add(guild.id, { moderatorId, targetId, action: 'punish.lift', weight: ACTION_WEIGHT['punish.lift'] });
    await modRepo.add({
      guildId: guild.id, userId: moderatorId, moderatorId: 'system',
      action: 'staff.lift', reason, result: restored ? 'restored' : 'applied', note,
    }).catch(() => {});

    log.info(`${moderatorId} зняв ${kind} з ${targetId} повз систему — повернуто`);
    return { restored, warned, kind };
  },

  /** Скільки «наробив» модератор за вікно — для панелі. */
  async score(guildId, moderatorId) {
    const s = this.settings(guildId);
    const rows = await staffRepo.recent(guildId, moderatorId, s.windowMs);
    return { score: round(rows.reduce((a, r) => a + r.weight, 0)), actions: rows.length, limit: s.limit };
  },
};

/** Короткий розклад «що саме робив» — щоб у сповіщенні була конкретика. */
function summary(rows, hotTarget, hotCount) {
  const byAction = new Map();
  for (const r of rows) byAction.set(r.action, (byAction.get(r.action) ?? 0) + 1);
  const parts = [...byAction.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([a, n]) => `${ACTION_LABEL[a] ?? a} ×${n}`);
  if (hotTarget && hotCount >= 2) parts.push(`найчастіше проти <@${hotTarget}> (${hotCount})`);
  return parts.join(', ');
}

const round = (n) => Math.round(n * 10) / 10;
