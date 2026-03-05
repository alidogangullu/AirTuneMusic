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
  appleMusicPink: string;
  appleMusicRed: string;
  appleMusicLowPink: string;
  appleMusicWhite: string;
  screenBackground: string;
  textOnDark: string;
  textMuted: string;
  textSubtle: string;
  textMono: string;
  buttonPrimary: string;
  buttonSecondaryBg: string;
  borderMuted: string;
  messageSuccessBg: string;
  messageSuccessBorder: string;
  messageErrorBg: string;
  messageErrorBorder: string;
  codeScreenBackground: string;
  accent: string;
  cardTitleText: string;
  textSecondary: string;
  textFooter: string;
  glassBg: string;
  glassBorder: string;
  glassCodeBg: string;
  glassButtonBg: string;
  glassButtonBorder: string;
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
};

export const colors: AppColors = {
  appleMusicPink: '#FF4E6B',
  appleMusicRed: '#FF0436',
  appleMusicLowPink: '#ffbfcaff',
  appleMusicWhite: '#FFFFFF',
  screenBackground: '#FFFFFF',
  textOnDark: '#111111',
  textMuted: '#666666',
  textSubtle: '#555555',
  textMono: '#444444',
  buttonPrimary: '#FF0436',
  buttonSecondaryBg: '#e0e0e0',
  borderMuted: '#cccccc',
  messageSuccessBg: 'rgba(0, 200, 100, 0.2)',
  messageSuccessBorder: '#00cc88',
  messageErrorBg: 'rgba(255, 80, 80, 0.2)',
  messageErrorBorder: '#ff5555',
  codeScreenBackground: '#fff0f3',
  accent: '#FF4E6B',
  cardTitleText: '#404040',
  textSecondary: '#6b7280',
  textFooter: 'rgba(107, 114, 128, 0.8)',
  glassBg: 'rgba(255, 255, 255, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.85)',
  glassCodeBg: 'rgba(255, 255, 255, 0.6)',
  glassButtonBg: 'rgba(255, 255, 255, 0.75)',
  glassButtonBorder: 'rgba(255, 78, 107, 0.35)',
  navBarCardBg: '#e8e8e8',
  navBarGreyBg: 'rgba(0, 0, 0, 0.06)',
  navTabFocusedBg: '#FFFFFF',
  navTabText: '#6b7280',
  navTabTextFocused: '#111111',
  navAvatarBg: 'rgba(0, 0, 0, 0.06)',
};
