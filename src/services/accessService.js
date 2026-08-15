import { OWNER_ID, ACCESS } from '../config/constants.js';
import { configService } from './configService.js';

/** Визначення рівня доступу користувача. Власник (OWNER_ID) — завжди максимум. */
export const accessService = {
  /**
   * @param {import('discord.js').GuildMember|null} member
   * @returns {number} рівень з ACCESS
   */
  level(member) {
    if (!member) return ACCESS.MEMBER;
    if (member.id === OWNER_ID) return ACCESS.OWNER;

    const cfg = configService.all(member.guild.id);
    const adminRoles = cfg['access.adminRoleIds'] ?? [];
    const modRoles = cfg['access.moderatorRoleIds'] ?? [];

    if (member.permissions?.has('Administrator')) return ACCESS.ADMIN;
    if (adminRoles.some((r) => member.roles.cache.has(r))) return ACCESS.ADMIN;
    if (modRoles.some((r) => member.roles.cache.has(r))) return ACCESS.MODERATOR;
    if (member.permissions?.has('ModerateMembers') || member.permissions?.has('KickMembers')) return ACCESS.MODERATOR;
    return ACCESS.MEMBER;
  },

  isOwner(userId) {
    return userId === OWNER_ID;
  },
  isModerator(member) {
    return this.level(member) >= ACCESS.MODERATOR;
  },
  isAdmin(member) {
    return this.level(member) >= ACCESS.ADMIN;
  },

  /** Перевірка з людяним повідомленням-помилкою. */
  require(member, minLevel) {
    const lvl = this.level(member);
    if (lvl >= minLevel) return { ok: true, level: lvl };
    const names = { 1: 'модератора', 2: 'адміністратора', 3: 'власника бота' };
    return { ok: false, level: lvl, message: `⛔ Потрібні права ${names[minLevel] ?? 'вищого рівня'}.` };
  },
};
