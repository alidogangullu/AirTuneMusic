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
| **services/** | Shared services used across multiple features: `musicPlayer`, `quotaService`, `versionService`, `airPlayReceiver`. |
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
| **airplay** | AirPlay context (`useAirPlay`), provider, and hook. Manages receiver state, track info, and settings persistence. |
| **settings** | Settings screen, IAP service. |
| **videos** | Videos tab screen. |

## AirPlay Native Layer

AirPlay support is implemented using the native C library from [jqssun/android-airplay-server](https://github.com/jqssun/android-airplay-server), which is itself built on top of [UxPlay](https://github.com/FDH2/UxPlay) — an open-source AirPlay server implementing the RAOP (Remote Audio Output Protocol).

### How it works

1. **Native library** (`libairplay_native.so`) is pre-compiled for `arm64-v8a` and `armeabi-v7a` and placed in `android/app/src/main/jniLibs/`. It handles the low-level RAOP protocol: authentication, audio decoding (AAC/ALAC), and streaming.
2. **JNI bridge** (`android/app/src/main/java/com/adg/airtune/airplay/bridge/NativeBridge.kt`) exposes the C functions to Kotlin.
3. **AirPlayService** (`...airplay/service/AirPlayService.kt`) runs as an Android foreground service. It initialises the native server, registers the device on the local network via mDNS (`NsdServiceManager`), and decodes/plays incoming audio through `AudioRenderer`.
4. **AirPlayModule** (`...airplay/AirPlayModule.kt`) is the React Native bridge module. It exposes `startReceiver` / `stopReceiver` methods and emits events (state, track metadata, playback progress) to the JS layer.
5. **`airPlayReceiver` service** (`src/services/airPlayReceiver.ts`) wraps the native module with a typed JS API.
6. **`useAirPlay` hook** (`src/features/airplay/useAirPlay.tsx`) consumes the service via React context and persists the enabled/disabled setting with MMKV.

### Key files

| Path | Purpose |
|------|---------|
| `android/app/src/main/jniLibs/` | Pre-compiled native `.so` libraries |
| `android/app/src/main/cpp/airplay/` | UxPlay C source (not compiled at build time — libraries are pre-built) |
| `android/app/src/main/java/com/adg/airtune/airplay/` | All Kotlin AirPlay code |
| `src/services/airPlayReceiver.ts` | JS wrapper around the native module |
| `src/features/airplay/useAirPlay.tsx` | React context + hook |

## Conventions

- **English**: All code and docs are in English.
- **Localization**: Use the i18n layer for any user-visible strings.
- **TV**: Primary target is Android TV. **D-pad is the main input**.
- **Overlay screens / focus trapping**: Screens that overlay others (detail, modal dialogs) **must** use React Native `Modal`.
- **Auto-focus on screen open**: The first interactive element in a new screen or modal should receive `hasTVPreferredFocus={true}`.
- **Feature locality**: Each feature owns everything specific to it — screens, components, hooks, API calls, utils, and services. Only truly shared code lives outside `features/`.
