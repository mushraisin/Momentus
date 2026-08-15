/** Кольори для ембедів. Основний вигляд дають картки-зображення (cards.js). */

export const COLORS = {
  primary: 0x5865f2,
  success: 0x3ba55d,
  warning: 0xe8b339,
  danger: 0xed4245,
  neutral: 0x1c2231,
  gold: 0xf1c40f,
};

/** Колір за рейтингом (0..1000). */
export function scoreColor(score) {
  if (score >= 800) return COLORS.gold;
  if (score >= 600) return COLORS.success;
  if (score >= 400) return COLORS.primary;
  if (score >= 250) return COLORS.warning;
  return COLORS.danger;
}
