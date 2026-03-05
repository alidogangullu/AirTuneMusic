# Theme and colors

App-wide colors and layout tokens (border radius, spacing) are defined in the theme so we can keep the look consistent and aligned with Apple Music / Apple HIG.

## Where theme lives

| File | Purpose |
|------|--------|
| `src/theme/colors.ts` | Color palette (`colors`), type `AppColors`. |
| `src/theme/layout.ts` | Border radius, spacing scale, button min height. |
| `src/theme/ThemeContext.tsx` | `ThemeProvider`, `useTheme()`. |
| `src/theme/index.ts` | Re-exports colors, layout, and theme context. |

## Usage

- **Import**: `import { useTheme, radius, spacing, buttonMinHeight } from '../theme';` (or from `../theme/colors` / `../theme/layout`).
- **In components**: Call `const { colors } = useTheme()` and use `colors.*` in styles. Build styles from `colors` (e.g. `useMemo(() => makeStyles(colors), [colors])`).
- **In styles**: Use `radius.sm` / `radius.lg`, `spacing.lg` etc.; get colors from `useTheme().colors`.
- **New colors**: Add to `colors` in `src/theme/colors.ts` with a short comment. Prefer semantic names (e.g. `accent`, `textPrimary`) over raw descriptions.

## Layout tokens (radius, spacing)

Use `radius` and `spacing` from `theme` or `theme/layout` instead of magic numbers:

- **radius**: `radius.sm` (8), `radius.md` (12), `radius.lg` (16), `radius.xl` (20), `radius.xxl` (24) — Apple-style rounded corners.
- **spacing**: `spacing.xs` (4) through `spacing.xxxl` (48) — use for padding and margin.
- **buttonMinHeight**: 52 — TV-friendly focus target for buttons.

## Conventions

- Do **not** hardcode hex or `rgba(...)` in screens or components; use `colors.*`.
- Do **not** hardcode border radius or spacing numbers; use `radius.*` and `spacing.*`.
- Group related colors in `colors.ts` (e.g. code screen, messages, buttons).
- For one-off alpha variants, add a named entry (e.g. `glassBg`, `messageSuccessBg`) rather than computing in the component.

## Apple Music brand colors

The app uses official Apple Music brand colors for logo and primary UI:

| Name  | Hex      | Use in app                          |
|-------|----------|-------------------------------------|
| Pink  | `#FF4E6B` | Logo, accent, URL, Get New Code btn |
| Red   | `#FF0436` | Primary buttons (e.g. sign in)      |
| White | `#FFFFFF` | Text on dark, icons on brand        |

In code: `appleMusicPink`, `appleMusicRed`, `appleMusicWhite`. Semantic keys `accent` and `buttonPrimary` are mapped to Pink and Red.

## Color groups (current)

- **Apple Music brand**: `appleMusicPink`, `appleMusicRed`, `appleMusicWhite`
- **Screen**: `screenBackground`, `textOnDark`, `textMuted`, `textSubtle`, `textMono`
- **Buttons**: `buttonPrimary` (Red), `buttonSecondaryBg`, `borderMuted`
- **Messages**: `messageSuccessBg`, `messageSuccessBorder`, `messageErrorBg`, `messageErrorBorder`
- **Code/pairing screen**: `codeScreenBackground`, `accent` (Pink), `textPrimary`, `textSecondary`, `textFooter`
- **Glass surfaces**: `glassBg`, `glassBorder`, `glassCodeBg`, `glassButtonBg`, `glassButtonBorder`

See `src/theme/colors.ts` for the full list and comments.

## Theme

- **Palette**: Single palette in `theme/colors.ts`. Wrap the app with `<ThemeProvider>` (see `App.tsx`).
- **Usage**: In any component under `ThemeProvider`, call `const { colors } = useTheme()` and use `colors` for all UI colors.
