/**
 * Layout and style tokens (border radius, spacing, sizing).
 * Aligned with Apple Music / Apple HIG: rounded corners and consistent spacing scale.
 * Use these instead of magic numbers in components.
 * See docs/THEME_AND_COLORS.md.
 */

export const radius = {
  /** Extra small */
  xs: 4,
  /** Small: chips, tags, small buttons. */
  sm: 8,
  /** Medium: buttons, inputs, small cards. */
  md: 12,
  /** Large: cards, modals, code display. */
  lg: 16,
  /** Extra large: hero cards, sheets. */
  xl: 20,
  /** 2XL: full-screen cards, overlays. */
  xxl: 24,
} as const;

/** Spacing scale (pt). Use for padding and margin. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Minimum touch/focus target size for TV (dp). */
export const minTouchTarget = 44;

/** Button / focusable element min height (TV-friendly). */
export const buttonMinHeight = 52;

export type RadiusKey = keyof typeof radius;
export type SpacingKey = keyof typeof spacing;
