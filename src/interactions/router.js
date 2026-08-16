import { NS, ACCESS } from '../config/constants.js';
import { parseCid } from '../ui/components.js';
import { createLogger } from '../core/logger.js';
import { accessService } from '../services/accessService.js';

import * as panels from '../ui/panels.js';
import * as admin from '../ui/adminPanel.js';
import * as modals from '../ui/modals.js';

import { configService } from '../services/configService.js';
import { CONFIG_SCHEMA } from '../config/defaults.js';
import { verificationService } from '../services/verificationService.js';
import { reputationService } from '../services/reputationService.js';
import { usersRepo, reputationRepo } from '../database/repositories.js';
import { caches } from '../core/cache.js';
import { bgQueue } from '../core/queue.js';
import { publishFrom } from '../services/galleryWatcher.js';
import * as mod from '../ui/modPanel.js';
import { punishmentService } from '../services/punishmentService.js';
import { modRepo } from '../database/repositories.js';

const log = createLogger('router');

/** Антиспам перевірок: userId → час останнього запуску. */
const verifyCooldown = new Map();

/** Ефемерна відповідь. Приймає рядок, обʼєкт або Promise. */
async function ephemeral(interaction, payload) {
  const resolved = await payload;
  const data = typeof resolved === 'string' ? { content: resolved } : resolved;
  if (interaction.replied || interaction.deferred) return interaction.editReply(data);
  return interaction.reply({ ...data, ephemeral: true });
}

/** Головна точка входу для всіх interactionCreate. */
export async function routeInteraction(interaction) {
  try {
    if (interaction.isButton() || interaction.isStringSelectMenu()
      || interaction.isChannelSelectMenu() || interaction.isRoleSelectMenu()) {
      return await handleComponent(interaction);
    }
    if (interaction.isModalSubmit()) {
      return await handleModal(interaction);
    }
    if (interaction.isUserContextMenuCommand()) {
      return await handleContextMenu(interaction);
    }
  } catch (err) {
    log.error('Помилка обробки взаємодії', err);
    try {
      await ephemeral(interaction, '⚠️ Сталася помилка.');
    } catch { /* ignore */ }
  }
}

// ─────────────────────────────────────────────
//  Компоненти
// ─────────────────────────────────────────────
async function handleComponent(interaction) {
  const { ns, action, args } = parseCid(interaction.customId);
  const guild = interaction.guild;

  switch (ns) {
    // Профіль/репутація/перевірка — публічні: видно всім, кнопки під кожним
    // повідомленням, щоб бот не «загубився» в історії каналу.
    case NS.PROFILE: {
      await interaction.deferReply().catch(() => {});
      return interaction.editReply(await panels.profileView(guild, interaction.user.id, interaction.user));
    }
    case NS.REP: {
      await interaction.deferReply().catch(() => {});
      return interaction.editReply(await panels.reputationView(guild, interaction.user.id));
    }
    case NS.VERIFY:
      return runVerification(interaction);
    case NS.GAL:
      return galleryHandlers(interaction, action, args);
    case NS.MOD:
      return modHandlers(interaction, action, args);
    case NS.ADMIN:
      return adminHandlers(interaction, action, args);
    case NS.DEV:
      return devHandlers(interaction, action, args);
    default:
      return interaction.deferUpdate().catch(() => {});
  }
}

/** Перевірка з кулдауном і актуалізацією репутації. */
async function runVerification(interaction) {
  const guild = interaction.guild;
  const userId = interaction.user.id;

  const cooldownMin = Number(configService.get(guild.id, 'verification.cooldownMinutes') ?? 10);
  const last = verifyCooldown.get(userId) ?? 0;
  const waitMs = cooldownMin * 60_000 - (Date.now() - last);
  if (waitMs > 0) {
    // саме це лишаємо приватним, щоб не смітити в каналі
    return ephemeral(interaction, `⏳ ${Math.ceil(waitMs / 60_000)} хв.`);
  }
  verifyCooldown.set(userId, Date.now());

  await interaction.deferReply().catch(() => {});
  const member = interaction.member ?? await guild.members.fetch(userId).catch(() => null);
  if (!member) return interaction.editReply('⚠️ Не вдалося отримати профіль учасника.');

  await usersRepo.ensure(guild.id, userId, interaction.user.username, member.joinedTimestamp);
  await reputationService.recompute(guild.id, userId);
  caches.profile.delete(`${guild.id}:${userId}`);

  return interaction.editReply(await panels.verificationView(guild, member, interaction.user));
}

// ─────────────────────────────────────────────
//  Адмін
// ─────────────────────────────────────────────
/**
 * Кнопки під медіа в каналі галереї. Натиснути може лише автор публікації —
 * інакше будь-хто вирішував би за нього.
 */
async function galleryHandlers(interaction, action, args) {
  const messageId = args[0];
  const source = await interaction.channel?.messages?.fetch(messageId).catch(() => null);

  if (!source) {
    return interaction.update({ content: 'Повідомлення вже недоступне.', components: [] }).catch(() => {});
  }
  if (interaction.user.id !== source.author.id) {
    return ephemeral(interaction, 'Це вирішує лише автор публікації.');
  }

  if (action === 'skip') {
    await interaction.update({ content: 'Гаразд, лишається тільки тут.', components: [] }).catch(() => {});
    setTimeout(() => { interaction.deleteReply().catch(() => {}); }, 15_000);
    return undefined;
  }

  const n = await publishFrom(source, interaction.user).catch((err) => {
    log.warn('Публікація в галерею впала', err.message);
    return 0;
  });

  const site = (process.env.WEB_PUBLIC_URL || 'https://moments.zadrypanka.xyz').replace(/\/$/, '');
  await interaction.update({
    content: n
      ? `Опубліковано в галереї: ${site}/gallery`
      : 'Не вдалося опублікувати — спробуй ще раз.',
    components: [],
  }).catch(() => {});

  // Службове повідомлення прибираємо за пів хвилини, щоб канал лишався
  // галереєю, а не стрічкою відповідей бота.
  setTimeout(() => {
    interaction.deleteReply().catch(() => {});
  }, 30_000);
  return undefined;
}

/**
 * Панель модерації. Доступ — від модератора; терміни обмежені рівнем доступу,
 * і перевірка стоїть саме тут, на сервері, а не лише в списку варіантів.
 */
async function modHandlers(interaction, action, args) {
  const check = accessService.require(interaction.member, ACCESS.MODERATOR);
  if (!check.ok) return ephemeral(interaction, check.message);

  const guild = interaction.guild;
  const level = accessService.level(interaction.member);

  switch (action) {
    case 'home':
      return safeUpdate(interaction, mod.modHome(guild, interaction.member));

    case 'pick':
    case 'pickAgain': {
      const targetId = action === 'pick' ? interaction.values?.[0] : args[0];
      if (!targetId) return ephemeral(interaction, 'Не обрано учасника.');
      return safeUpdate(interaction, await mod.modTarget(guild, targetId, interaction.member));
    }

    case 'active':
      return safeUpdate(interaction, await mod.modActive(guild));

    case 'ask': {
      const [targetId, kind] = args;
      const guard = await canModerate(interaction, targetId);
      if (guard) return ephemeral(interaction, guard);
      return safeUpdate(interaction, mod.modDuration(guild, targetId, kind, interaction.member));
    }

    // Термін обрано — питаємо причину окремим вікном.
    case 'dur': {
      const [targetId, kind] = args;
      const minutes = Number(interaction.values?.[0] ?? 0);
      if (!punishmentService.withinLimit(guild.id, level, minutes)) {
        return ephemeral(interaction, 'Цей термін перевищує ваш ліміт.');
      }
      return interaction.showModal(modals.reasonModal(targetId, kind, minutes));
    }

    case 'lift': {
      const [targetId, kind] = args;
      const guard = await canModerate(interaction, targetId);
      if (guard) return ephemeral(interaction, guard);

      await punishmentService.lift(guild, targetId, kind ?? 'all', interaction.user.id);
      const target = await guild.members.fetch(targetId).catch(() => null);
      if (target) {
        await punishmentService.notify(guild, {
          target: target.user, moderator: interaction.user.id, kind: kind === 'all' ? 'full' : kind, lifted: true,
        });
      }
      return safeUpdate(interaction, await mod.modTarget(guild, targetId, interaction.member));
    }

    case 'warn': {
      const guard = await canModerate(interaction, args[0]);
      if (guard) return ephemeral(interaction, guard);
      return interaction.showModal(modals.reasonModal(args[0], 'warn', 0));
    }

    case 'kick': {
      const guard = await canModerate(interaction, args[0]);
      if (guard) return ephemeral(interaction, guard);
      if (level < ACCESS.ADMIN && !configService.get(guild.id, 'moderation.allowKickModerator')) {
        return ephemeral(interaction, 'Кік доступний лише адміністраторам.');
      }
      return interaction.showModal(modals.reasonModal(args[0], 'kick', 0));
    }

    default:
      return interaction.deferUpdate().catch(() => {});
  }
}

/** Причина покарання з модального вікна — тут дія й застосовується. */
async function modModal(interaction, action, args) {
  const check = accessService.require(interaction.member, ACCESS.MODERATOR);
  if (!check.ok) return ephemeral(interaction, check.message);
  if (action !== 'reason') return;

  const [targetId, kind, minutesRaw] = args;
  const minutes = Number(minutesRaw ?? 0);
  const guild = interaction.guild;
  const level = accessService.level(interaction.member);
  const reason = interaction.fields.getTextInputValue('reason')?.trim() || null;

  if (configService.get(guild.id, 'moderation.requireReason') && !reason) {
    return ephemeral(interaction, 'Причина обовʼязкова.');
  }

  const guard = await canModerate(interaction, targetId);
  if (guard) return ephemeral(interaction, guard);

  const target = await guild.members.fetch(targetId).catch(() => null);
  if (!target) return ephemeral(interaction, 'Учасника вже немає на сервері.');

  try {
    if (kind === 'warn') {
      await usersRepo.ensure(guild.id, targetId, target.displayName);
      await modRepo.add({
        guildId: guild.id, userId: targetId, moderatorId: interaction.user.id,
        action: 'warn', reason, result: 'applied',
      });
      await punishmentService.notify(guild, {
        target: target.user, moderator: interaction.user.id, kind: 'warn', reason,
      });
      return ephemeral(interaction, `⚠️ Попередження видано ${target.displayName}.`);
    }

    if (kind === 'kick') {
      await target.kick(reason ?? 'Без причини');
      await modRepo.add({
        guildId: guild.id, userId: targetId, moderatorId: interaction.user.id,
        action: 'kick', reason, result: 'applied',
      });
      await punishmentService.notify(guild, {
        target: target.user, moderator: interaction.user.id, kind: 'kick', reason,
      });
      return ephemeral(interaction, `👢 ${target.displayName} вигнано.`);
    }

    if (!punishmentService.withinLimit(guild.id, level, minutes)) {
      return ephemeral(interaction, 'Цей термін перевищує ваш ліміт.');
    }

    await punishmentService.apply(guild, target, {
      kind, minutes, reason, moderatorId: interaction.user.id,
    });
    await punishmentService.notify(guild, {
      target: target.user, moderator: interaction.user.id, kind, minutes, reason,
    });
    return ephemeral(interaction, `✅ Застосовано до ${target.displayName}.`);
  } catch (err) {
    log.warn('Покарання не застосувалось', err.message);
    return ephemeral(interaction, `⚠️ Не вдалося: ${err.message}`);
  }
}

/**
 * Кого модерувати не можна: себе, бота, рівних або старших за доступом.
 * @returns {Promise<string|null>} текст помилки або null, якщо все гаразд
 */
async function canModerate(interaction, targetId) {
  if (!targetId) return 'Не обрано учасника.';
  if (targetId === interaction.user.id) return 'Себе модерувати не можна.';
  if (targetId === interaction.client.user.id) return 'Це я.';

  const target = interaction.guild.members.cache.get(targetId)
    ?? await interaction.guild.members.fetch(targetId).catch(() => null);
  if (!target) return 'Учасника не знайдено.';

  const mine = accessService.level(interaction.member);
  const theirs = accessService.level(target);
  if (theirs >= mine) return 'Цей учасник рівний вам або вищий за правами.';
  if (!target.manageable) return 'У бота бракує прав для цього учасника — підніміть його роль вище.';
  return null;
}

async function adminHandlers(interaction, action, args) {
  const check = accessService.require(interaction.member, ACCESS.ADMIN);
  if (!check.ok) return ephemeral(interaction, check.message);
  const guild = interaction.guild;

  switch (action) {
    case 'home':
      return safeUpdate(interaction, admin.adminHome(guild));
    case 'bindChannel':
      return bindHub(interaction, interaction.values?.[0]);
    case 'bindHere':
      return bindHub(interaction, interaction.channelId);
    case 'group':
      return safeUpdate(interaction, admin.adminGroup(guild, interaction.values[0]));
    case 'setChannel': {
      // args[0] — ключ конфігурації, значення приходить із нативного селектора
      const key = args[0];
      await configService.set(guild.id, key, interaction.values?.[0] ?? '');
      const group = CONFIG_SCHEMA[key]?.group;
      return safeUpdate(interaction, admin.adminGroup(guild, group));
    }
    case 'lang':
      await configService.set(guild.id, 'general.locale', interaction.values[0]);
      return safeUpdate(interaction, admin.adminHome(guild));
    case 'tiers':
      return safeUpdate(interaction, admin.tiersPanel(guild));

    // ── Сайт ──
    case 'site':
      return safeUpdate(interaction, admin.sitePanel(guild));
    case 'pagePick':
      return interaction.showModal(await modals.pageModal(guild.id, interaction.values[0]));
    case 'pageAdd':
      return interaction.showModal(await modals.pageModal(guild.id, null));
    case 'cssEdit':
      return interaction.showModal(await modals.cssModal(guild.id));
    case 'tierPick':
      return safeUpdate(interaction, admin.tierDetail(guild, interaction.values[0]));
    case 'tierName': {
      const modal = modals.tierNameModal(guild.id, args[0]);
      return modal ? interaction.showModal(modal) : ephemeral(interaction, 'Рівень не знайдено.');
    }
    case 'tierReq': {
      const modal = modals.tierReqModal(guild.id, args[0], args[1]);
      return modal ? interaction.showModal(modal) : ephemeral(interaction, 'Рівень не знайдено.');
    }
    case 'tierRole': {
      const key = args[0];
      const roleId = interaction.values?.[0];
      const tiers = verificationService.tiers(guild.id).map((t) => ({ ...t }));
      const t = tiers.find((x) => x.key === key);
      if (!t) return ephemeral(interaction, 'Рівень не знайдено.');

      // одна роль не може належати двом рівням
      for (const other of tiers) if (other.key !== key && other.roleId === roleId) other.roleId = '';
      t.roleId = roleId;
      await configService.set(guild.id, 'verification.tiers', tiers);
      return safeUpdate(interaction, admin.tierDetail(guild, key));
    }
    case 'tierAdd':
      return interaction.showModal(modals.tierNameModal(guild.id, null));
    case 'tierDelete': {
      const key = args[0];
      const tiers = verificationService.tiers(guild.id).filter((t) => t.key !== key);
      await configService.set(guild.id, 'verification.tiers', tiers);
      return safeUpdate(interaction, admin.tiersPanel(guild));
    }
    case 'tierUp':
    case 'tierDown': {
      await shiftPriority(guild.id, args[0], action === 'tierUp' ? 1 : -1);
      return safeUpdate(interaction, admin.tierDetail(guild, args[0]));
    }
    case 'edit': {
      const modal = modals.configModal(guild.id, args.join(':'));
      return modal ? interaction.showModal(modal) : ephemeral(interaction, 'Невідоме поле.');
    }
    case 'toggle': {
      const key = args.join(':');
      await configService.set(guild.id, key, !configService.get(guild.id, key));
      return safeUpdate(interaction, admin.adminHome(guild));
    }
    case 'deploy': {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const channelId = configService.get(guild.id, 'general.statsChannelId');
      const channel = channelId ? await guild.channels.fetch(channelId).catch(() => null) : interaction.channel;
      if (!channel?.isTextBased?.()) return interaction.editReply('⚠️ Спершу вкажіть канал.');
      await channel.send(panels.hubPanel(guild));
      return interaction.editReply(`✅ <#${channel.id}>`);
    }
    default:
      return;
  }
}

/** Привʼязати канал хабу й одразу опублікувати панель. */
async function bindHub(interaction, channelId) {
  const guild = interaction.guild;
  if (!channelId) return ephemeral(interaction, '⚠️ Канал не визначено.');
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased?.()) return ephemeral(interaction, '⚠️ Це не текстовий канал.');

  const me = guild.members.me;
  if (me && !channel.permissionsFor(me)?.has('SendMessages')) {
    return ephemeral(interaction, `⛔ Немає прав писати у <#${channelId}>.`);
  }

  await configService.set(guild.id, 'general.statsChannelId', channelId);
  try {
    await channel.send(panels.hubPanel(guild));
  } catch (err) {
    return ephemeral(interaction, `⚠️ ${err.message}`);
  }
  return ephemeral(interaction, `✅ <#${channelId}>`);
}

/** Зсув пріоритету рівня. */
async function shiftPriority(guildId, key, delta) {
  const tiers = verificationService.tiers(guildId).map((t) => ({ ...t }));
  const t = tiers.find((x) => x.key === key);
  if (!t) return;
  t.priority = Math.max(0, (t.priority ?? 0) + delta);
  await configService.set(guildId, 'verification.tiers', tiers);
}

// ─────────────────────────────────────────────
//  Dev
// ─────────────────────────────────────────────
async function devHandlers(interaction, action) {
  if (!accessService.isOwner(interaction.user.id)) {
    return ephemeral(interaction, '⛔ Лише власник.');
  }
  const guild = interaction.guild;

  switch (action) {
    case 'open':
      return safeUpdate(interaction, admin.devPanel(guild));
    case 'recalcAll': {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const ids = (await reputationRepo.leaderboard(guild.id, 5000)).map((r) => r.user_id);
      for (const id of ids) bgQueue.push(() => reputationService.recompute(guild.id, id), { label: 'recalc' });
      return interaction.editReply(`♻️ ${ids.length}`);
    }
    case 'snapshotAll': {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const ids = (await reputationRepo.leaderboard(guild.id, 5000)).map((r) => r.user_id);
      for (const id of ids) await reputationService.snapshot(guild.id, id);
      return interaction.editReply(`📸 ${ids.length}`);
    }
    case 'backup': {
      await interaction.deferReply({ ephemeral: true }).catch(() => {});
      const { backupService } = await import('../services/backupService.js');
      const file = await backupService.run();
      return interaction.editReply(file ? `💾 \`${file}\`` : 'ℹ️ Turso — бекап не потрібен.');
    }
    default:
      return;
  }
}

// ─────────────────────────────────────────────
//  Модальні вікна
// ─────────────────────────────────────────────
async function handleModal(interaction) {
  const { ns, action, args } = parseCid(interaction.customId);

  // Причина покарання приходить окремим вікном — саме тут і застосовуємо.
  if (ns === NS.MOD) return modModal(interaction, action, args);

  if (ns !== NS.ADMIN) return;

  const check = accessService.require(interaction.member, ACCESS.ADMIN);
  if (!check.ok) return ephemeral(interaction, check.message);
  const guildId = interaction.guild.id;

  if (action === 'save') {
    const key = args.join(':');
    try {
      await configService.set(guildId, key, interaction.fields.getTextInputValue('value'));
      return ephemeral(interaction, `✅ \`${key}\``);
    } catch (err) {
      return ephemeral(interaction, `⚠️ ${err.message}`);
    }
  }

  // Назва / пріоритет / колір (також створення нового рівня)
  if (action === 'saveName') {
    const key = args[0] || '';
    const name = interaction.fields.getTextInputValue('name').trim();
    const priority = parseInt(interaction.fields.getTextInputValue('priority'), 10);
    const color = interaction.fields.getTextInputValue('color').trim();

    if (!name) return ephemeral(interaction, '⚠️ Назва не може бути порожньою.');

    const tiers = verificationService.tiers(guildId).map((t) => ({ ...t }));
    let targetKey = key;

    if (key) {
      const t = tiers.find((x) => x.key === key);
      if (!t) return ephemeral(interaction, '⚠️ Рівень не знайдено.');
      t.name = name;
      t.priority = Number.isFinite(priority) ? priority : (t.priority ?? 0);
      if (/^#?[0-9a-f]{6}$/i.test(color)) t.color = color.startsWith('#') ? color : `#${color}`;
    } else {
      targetKey = `tier_${Date.now().toString(36)}`;
      tiers.push({
        key: targetKey,
        name,
        roleId: '',
        priority: Number.isFinite(priority) ? priority : 5,
        color: /^#?[0-9a-f]{6}$/i.test(color) ? (color.startsWith('#') ? color : `#${color}`) : '#5865f2',
        req: {},
      });
    }

    await configService.set(guildId, 'verification.tiers', tiers);
    return safeUpdate(interaction, admin.tierDetail(interaction.guild, targetKey));
  }

  // ── Сайт: сторінка ──
  if (action === 'savePage') {
    const oldSlug = args[0] || '';
    const slug = interaction.fields.getTextInputValue('slug').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    const title = interaction.fields.getTextInputValue('title').trim();
    const body = interaction.fields.getTextInputValue('body');
    const published = ['1', 'true', 'так', 'yes'].includes(
      interaction.fields.getTextInputValue('published').trim().toLowerCase(),
    );

    if (!slug || !title) return ephemeral(interaction, '⚠️ Потрібні адреса й назва.');
    if (['api', 'login', 'logout', 'callback', 'me', 'u'].includes(slug)) {
      return ephemeral(interaction, '⚠️ Ця адреса зарезервована.');
    }

    const { sitePagesRepo } = await import('../database/repositories.js');
    if (oldSlug && oldSlug !== slug) await sitePagesRepo.remove(guildId, oldSlug);
    await sitePagesRepo.save(guildId, { slug, title, body, published });
    return safeUpdate(interaction, admin.sitePanel(interaction.guild));
  }

  // ── Сайт: кастомний CSS ──
  if (action === 'saveCss') {
    const css = interaction.fields.getTextInputValue('css').trim();
    const { siteAssetsRepo } = await import('../database/repositories.js');
    if (!css) await siteAssetsRepo.remove(guildId, '/custom.css');
    else await siteAssetsRepo.save(guildId, { path: '/custom.css', mime: 'text/css; charset=utf-8', content: css });
    return safeUpdate(interaction, admin.sitePanel(interaction.guild));
  }

  // Вимоги (порожнє поле = прибрати вимогу)
  if (action === 'saveReq') {
    const [key, group] = args;
    const fields = modals.REQ_GROUPS[group]?.fields ?? [];
    const tiers = verificationService.tiers(guildId).map((t) => ({ ...t, req: { ...(t.req ?? {}) } }));
    const t = tiers.find((x) => x.key === key);
    if (!t) return ephemeral(interaction, '⚠️ Рівень не знайдено.');

    for (const [field] of fields) {
      const raw = interaction.fields.getTextInputValue(field).trim();
      if (raw === '') delete t.req[field];
      else {
        const n = Number(raw.replace(',', '.'));
        if (!Number.isFinite(n) || n < 0) return ephemeral(interaction, `⚠️ «${field}»: потрібне невідʼємне число.`);
        t.req[field] = n;
      }
    }

    await configService.set(guildId, 'verification.tiers', tiers);
    return safeUpdate(interaction, admin.tierDetail(interaction.guild, key));
  }
}

// ─────────────────────────────────────────────
//  Контекстне меню
// ─────────────────────────────────────────────
async function handleContextMenu(interaction) {
  if (interaction.commandName === 'Панель адміністратора') {
    const check = accessService.require(interaction.member, ACCESS.ADMIN);
    if (!check.ok) return ephemeral(interaction, check.message);
    return ephemeral(interaction, admin.adminHome(interaction.guild));
  }
}

async function safeUpdate(interaction, payload) {
  const resolved = await payload;
  try {
    return await interaction.update(resolved);
  } catch {
    return ephemeral(interaction, resolved);
  }
}
