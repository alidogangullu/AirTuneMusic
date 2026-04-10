# Project structure

This document describes the folder structure for the AirTune Music app (React Native + TypeScript + Apple Music API).

## Root

| Path | Purpose |
|------|---------|
| `App.tsx` | Root component and app entry. |
| `src/` | All application source code. |
| `android/` | Android TV native project. |
| `scripts/` | Build and run helpers. |
| `docs/` | Project documentation (English). |

## `src/` layout

| Folder | Purpose |
|--------|---------|
| **api/** | Apple Music API client: requests, types, and endpoints. |
| **assets/** | Static assets (images, fonts). |
| **components/** | Reusable UI components. Must be TV-friendly: focusable, D-pad navigable. |
| **config/** | Build-time generated configuration (e.g. `appleMusicToken.generated.ts`). |
| **constants/** | App-wide constants (config, keys, limits). |
| **hooks/** | Custom React hooks. Key hooks: **useRecommendations** (home feed), **useContentDetail** (unified detail data). |
| **i18n/** | Localization configuration and i18next setup. |
| **locales/** | Translation JSON files (English, Turkish, etc.). |
| **navigation/** | Navigation setup. Exports **ContentNavigationContext**. |
| **screens/** | Screen-level components. **HomeScreen**, **ContentDetailScreen**, **NowPlayingScreen**, **AppleMusicAuthScreen**. |
| **services/** | Services and native module wrappers (e.g. `tvLinkServer`). |
| **theme/** | Theming: colors, layout, and ThemeProvider. |
| **types/** | Shared TypeScript types and interfaces. |
| **utils/** | Pure utilities and helpers. |

## Conventions

- **English**: All code and docs are in English.
- **Localization**: Use the i18n layer for any user-visible strings.
- **TV**: Primary target is Android TV. **D-pad is the main input**.
- **Overlay screens / focus trapping**: Screens that overlay others (detail, modal dialogs) **must** use React Native `Modal`.
- **Auto-focus on screen open**: The first interactive element in a new screen or modal should receive `hasTVPreferredFocus={true}`.
