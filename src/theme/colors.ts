/**
 * Centralized app color palette.
 * Use theme context (useTheme()) to get colors in components.
 * See docs/THEME_AND_COLORS.md.
 *
 * Apple Music brand:
 * - Pink: #FF4E6B — PMS 184 C
 * - Red:  #FF0436 — PMS 185 C
 * - White: #FFFFFF — PMS 7436 C
 */

export type AppColors = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  appleMusicPink: string;
  appleMusicRed: string;
  accent: string;

  // ── Gradient background ────────────────────────────────────────────────────
  gradientStart: string;
  gradientEnd: string;

  // ── Screen / surface backgrounds ──────────────────────────────────────────
  screenBackground: string;
  codeScreenBackground: string;
  lightGreyBg: string;
  subtleBg: string;

  // ── Text (light surfaces) ─────────────────────────────────────────────────
  textOnDark: string;
  textMuted: string;
  textSubtle: string;
  textMono: string;
  textSecondary: string;
  textFooter: string;
  cardTitleText: string;

  // ── Text (dark surfaces — now playing, overlays) ──────────────────────────
  onDarkTextPrimary: string;
  onDarkTextSecondary: string;
  onDarkTextMuted: string;
  onDarkTextDim: string;

  // ── Buttons ────────────────────────────────────────────────────────────────
  buttonPrimary: string;
  buttonSecondaryBg: string;
  alertRed: string;

  // ── Borders ────────────────────────────────────────────────────────────────
  borderMuted: string;

  // ── Status messages ────────────────────────────────────────────────────────
  messageSuccessBg: string;
  messageSuccessBorder: string;
  messageErrorBg: string;
  messageErrorBorder: string;

  // ── Glass morphism (light) ────────────────────────────────────────────────
  glassBg: string;
  glassBorder: string;
  glassBorderSubtle: string;
  glassCodeBg: string;
  glassButtonBg: string;
  glassButtonBorder: string;
  glassCardBg: string;
  glassCardBgStrong: string;
  /** Very transparent white — nav card bg in transparent/light mode. */
  glassBgDim: string;

  // ── Text (dark surfaces — additional opacity variants) ────────────────────
  /** 0.7 opacity white text. */
  onDarkTextFaint: string;
  /** 0.8 opacity white text. */
  onDarkTextSoft: string;

  // ── Controls (dark surface) ───────────────────────────────────────────────
  onDarkControlBg: string;
  /** Semi-transparent white focus bg on dark surfaces. */
  onDarkBgMid: string;

  // ── Progress bar (on dark bg) ─────────────────────────────────────────────
  progressTrackBg: string;
  progressTrackFocusedBg: string;
  scrubFillBg: string;
  scrubKnobBg: string;

  // ── Dark overlays ─────────────────────────────────────────────────────────
  overlayLight: string;
  overlayMid: string;
  overlayMedium: string;
  overlayStrong: string;
  overlayHeavy: string;

  // ── System UI ─────────────────────────────────────────────────────────────
  notificationBadge: string;

  // ── Now Playing (dynamic palette fallbacks) ───────────────────────────────
  nowPlayingDarkBg: string;
  nowPlayingDarkBgDeep: string;

  // ── Modal (dark-themed) ───────────────────────────────────────────────────
  modalOverlay: string;
  modalBg: string;
  modalBorder: string;
  modalInputBg: string;
  modalInputPlaceholder: string;

  // ── Navigation bar ────────────────────────────────────────────────────────
  /** Top bar card background (main container). */
  navBarCardBg: string;
  /** Grey bar background (tabs + search area). */
  navBarGreyBg: string;
  /** Nav tab pill when focused (white, elevated). */
  navTabFocusedBg: string;
  /** Nav tab text when unfocused. */
  navTabText: string;
  /** Nav tab text when focused. */
  navTabTextFocused: string;
  /** Avatar background (on card). */
  navAvatarBg: string;

  // ── Settings ──────────────────────────────────────────────────────────────
  settingsCardBg: string;
  settingsTextSubdued: string;
  settingsTextHint: string;
  settingsTextDisabled: string;
};

export const lightColors: AppColors = {
  // ── Brand ──────────────────────────────────────────────────────────────────
  appleMusicPink: '#FF4E6B',
  appleMusicRed: '#FF0436',
  accent: '#FF4E6B',

  // ── Gradient background ────────────────────────────────────────────────────
  gradientStart: '#c1d5f3',
  gradientEnd: '#bfc0c6',

  // ── Screen / surface backgrounds ──────────────────────────────────────────
  screenBackground: '#FFFFFF',
  codeScreenBackground: '#fff0f3',
  lightGreyBg: '#f0f0f0',
  subtleBg: 'rgba(0, 0, 0, 0.05)',

  // ── Text (light surfaces) ─────────────────────────────────────────────────
  textOnDark: '#111111',
  textMuted: '#666666',
  textSubtle: '#555555',
  textMono: '#444444',
  textSecondary: '#6b7280',
  textFooter: 'rgba(107, 114, 128, 0.8)',
  cardTitleText: '#404040',

  // ── Text (dark surfaces — now playing, overlays) ──────────────────────────
  onDarkTextPrimary: '#ffffff',
  onDarkTextSecondary: 'rgba(255, 255, 255, 0.65)',
  onDarkTextMuted: 'rgba(255, 255, 255, 0.5)',
  onDarkTextDim: 'rgba(255, 255, 255, 0.4)',

  // ── Buttons ────────────────────────────────────────────────────────────────
  buttonPrimary: '#FF0436',
  buttonSecondaryBg: '#e0e0e0',
  alertRed: '#f0535b',

  // ── Borders ────────────────────────────────────────────────────────────────
  borderMuted: '#cccccc',

  // ── Status messages ────────────────────────────────────────────────────────
  messageSuccessBg: 'rgba(0, 200, 100, 0.2)',
  messageSuccessBorder: '#00cc88',
  messageErrorBg: 'rgba(255, 80, 80, 0.2)',
  messageErrorBorder: '#ff5555',

  // ── Glass morphism (light) ────────────────────────────────────────────────
  glassBg: 'rgba(255, 255, 255, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.85)',
  glassBorderSubtle: 'rgba(255, 255, 255, 0.2)',
  glassCodeBg: 'rgba(255, 255, 255, 0.6)',
  glassButtonBg: 'rgba(255, 255, 255, 0.75)',
  glassButtonBorder: 'rgba(255, 78, 107, 0.35)',
  glassCardBg: 'rgba(255, 255, 255, 0.85)',
  glassCardBgStrong: 'rgba(255, 255, 255, 0.90)',
  glassBgDim: 'rgba(255, 255, 255, 0.12)',

  // ── Text (dark surfaces — additional opacity variants) ────────────────────
  onDarkTextFaint: 'rgba(255, 255, 255, 0.7)',
  onDarkTextSoft: 'rgba(255, 255, 255, 0.8)',

  // ── Controls (dark surface) ───────────────────────────────────────────────
  onDarkControlBg: 'rgba(255, 255, 255, 0.15)',
  onDarkBgMid: 'rgba(255, 255, 255, 0.3)',

  // ── Progress bar (on dark bg) ─────────────────────────────────────────────
  progressTrackBg: 'rgba(255, 255, 255, 0.2)',
  progressTrackFocusedBg: 'rgba(255, 255, 255, 0.3)',
  scrubFillBg: 'rgba(255, 255, 255, 0.55)',
  scrubKnobBg: '#ffffff',

  // ── Dark overlays ─────────────────────────────────────────────────────────
  overlayLight: 'rgba(0, 0, 0, 0.15)',
  overlayMid: 'rgba(0, 0, 0, 0.3)',
  overlayMedium: 'rgba(0, 0, 0, 0.35)',
  overlayStrong: 'rgba(0, 0, 0, 0.5)',
  overlayHeavy: 'rgba(0, 0, 0, 0.8)',

  // ── System UI ─────────────────────────────────────────────────────────────
  notificationBadge: '#FF3B30',

  // ── Now Playing (dynamic palette fallbacks) ───────────────────────────────
  nowPlayingDarkBg: '#1a1a2e',
  nowPlayingDarkBgDeep: '#16213e',

  // ── Modal ───────────────────────────────────────────────────
  modalOverlay: 'rgba(0, 0, 0, 0.9)',
  modalBg: '#2a2a2a',
  modalBorder: '#444444',
  modalInputBg: '#1a1a1a',
  modalInputPlaceholder: 'rgba(255, 255, 255, 0.4)',

  // ── Navigation bar ────────────────────────────────────────────────────────
  navBarCardBg: '#e8e8e8',
  navBarGreyBg: 'rgba(0, 0, 0, 0.06)',
  navTabFocusedBg: '#FFFFFF',
  navTabText: '#6b7280',
  navTabTextFocused: '#111111',
  navAvatarBg: 'rgba(0, 0, 0, 0.06)',

  // ── Settings ──────────────────────────────────────────────────────────────
  settingsCardBg: 'rgba(255, 255, 255, 0.95)',
  settingsTextSubdued: 'rgba(0, 0, 0, 0.7)',
  settingsTextHint: 'rgba(0, 0, 0, 0.35)',
  settingsTextDisabled: 'rgba(0, 0, 0, 0.25)',
};

export const darkColors: AppColors = {
  ...lightColors,

  // ── Gradient ──────────────────────────────────────────────────────────────
  gradientStart: '#1a2035',
  gradientEnd: '#0f1420',

  // ── Screen / surface backgrounds ──────────────────────────────────────────
  screenBackground: '#0f1420',
  lightGreyBg: '#1e2435',
  subtleBg: 'rgba(255, 255, 255, 0.05)',

  // ── Text (light surfaces → repurposed for dark bg) ────────────────────────
  textOnDark: '#ffffff',
  textMuted: 'rgba(255, 255, 255, 0.55)',
  textSubtle: 'rgba(255, 255, 255, 0.45)',
  cardTitleText: '#ffffff',

  // ── Overlays (inverted for dark bg) ──────────────────────────────────────
  overlayLight: 'rgba(255, 255, 255, 0.15)',

  // ── Buttons ────────────────────────────────────────────────────────────────
  buttonSecondaryBg: '#252b3a',

  // ── Borders ────────────────────────────────────────────────────────────────
  borderMuted: 'rgba(255, 255, 255, 0.12)',

  // ── Glass morphism (dark) ─────────────────────────────────────────────────
  glassBg: '#252b3a',
  glassBorder: 'rgba(255, 255, 255, 0.15)',
  glassBorderSubtle: 'rgba(255, 255, 255, 0.08)',
  glassButtonBg: '#252b3a',
  glassCardBg: '#252b3a',
  glassCardBgStrong: '#3a4155',

  // ── Navigation bar ────────────────────────────────────────────────────────
  navBarCardBg: '#252b3a',
  navBarGreyBg: '#1a1f2e',
  navTabFocusedBg: '#ffffff',
  navTabText: 'rgba(255, 255, 255, 0.55)',
  navTabTextFocused: '#0f1420',

  // ── Settings ──────────────────────────────────────────────────────────────
  settingsCardBg: '#3a4155',
  settingsTextSubdued: 'rgba(255, 255, 255, 0.55)',
  settingsTextHint: 'rgba(255, 255, 255, 0.38)',
  settingsTextDisabled: 'rgba(255, 255, 255, 0.22)',
};

/** @deprecated Use lightColors or darkColors directly. */
export const colors: AppColors = lightColors;
