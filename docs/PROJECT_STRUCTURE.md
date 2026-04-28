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
| **features/** | All feature modules. Each feature owns its screens, components, hooks, API calls, and utilities. |
| **api/apple-music/** | Shared Apple Music HTTP client (`appleMusicApi`), developer token, and Music User Token helpers. Used by all feature APIs. |
| **assets/** | Static assets (images, fonts). |
| **components/** | Shared UI components used across multiple features (e.g. `GradientBackground`, `LoadingIndicator`). |
| **config/** | Build-time generated configuration (e.g. `appleMusicToken.generated.ts`). |
| **constants/** | App-wide constants. |
| **hooks/** | Shared React hooks used across multiple features (e.g. `useStorefront`). |
| **i18n/** | Localization configuration and i18next setup. |
| **locales/** | Translation JSON files (English, Turkish, etc.). |
| **services/** | Shared services used across multiple features: `musicPlayer`, `quotaService`, `versionService`. |
| **theme/** | Theming: colors, layout constants, and ThemeProvider. |
| **types/** | Shared TypeScript types and interfaces. |

## `src/features/` layout

| Feature | Contents |
|---------|---------|
| **auth** | Apple Music sign-in screen, TV link server, auth API (`startAppleMusicAuth`). |
| **bootstrap** | App startup logic (`AppStartupProvider`, `appStartupService`), subscription API, `ForceUpdateScreen`, `SubscriptionRequiredScreen`. |
| **browse** | Browse tab screen. |
| **content** | Album, artist, playlist, and content detail screens; ratings API; track/date utilities. |
| **home** | `HomeScreen`, `MainLayout`, `TopBar`, navigation context (`ContentNavigationContext`). |
| **library** | Library screen, library API, library hooks. |
| **listen-now** | Listen Now tab screen. |
| **now-playing** | Now Playing screen, image colors service and hook. |
| **player** | Player provider (`usePlayer`), playback components, lyrics, LRC parser. |
| **radio** | Radio screen, radio API and hook. |
| **recommendations** | Recommendations screen, API, and shared rail/section components. |
| **search** | Search screen, search API, recent searches hook. |
| **settings** | Settings screen, IAP service. |
| **videos** | Videos tab screen. |

## Conventions

- **English**: All code and docs are in English.
- **Localization**: Use the i18n layer for any user-visible strings.
- **TV**: Primary target is Android TV. **D-pad is the main input**.
- **Overlay screens / focus trapping**: Screens that overlay others (detail, modal dialogs) **must** use React Native `Modal`.
- **Auto-focus on screen open**: The first interactive element in a new screen or modal should receive `hasTVPreferredFocus={true}`.
- **Feature locality**: Each feature owns everything specific to it — screens, components, hooks, API calls, utils, and services. Only truly shared code lives outside `features/`.
