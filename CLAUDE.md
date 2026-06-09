# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

AirTune Music is an **Apple Music client for Android TV**, built with React Native (`react-native-tvos`). The primary input method is a **D-pad remote** — all UI must support focus-based navigation with no hover interactions.

Package ID: `com.adg.airtunemusic` | Play Store: `com.adg.airtunemusic`

## Commands

```bash
yarn install              # install dependencies
yarn emulator:tv          # start Android TV emulator (AVD: Android_TV_API36)
yarn android              # build & deploy to connected device/emulator
yarn start                # start Metro bundler
yarn lint                 # ESLint
yarn test                 # Jest
```

**Android builds require Java 17.** Use `scripts/with-java17.mjs` wrapper if needed.

**Developer token setup:** Run `scripts/generate-developer-token.mjs` then `scripts/inject-apple-music-token.mjs` to generate `src/config/appleMusicToken.generated.ts`.

For full emulator/debug setup, see `docs/ANDROID_TV_RUN_DEBUG.md`.

## Architecture

### Provider Hierarchy (App.tsx)

```
QueryClientProvider → ThemeProvider → AppStartupProvider
  → PlayerProvider → AirPlayProvider → AppContent
```

`AppContent` gates rendering: splash → `ForceUpdateScreen` → `AppleMusicAuthScreen` → `SubscriptionRequiredScreen` → `HomeScreen`.

### Startup Flow

`AppStartupProvider` runs `AppStartupService.init()` which in parallel checks app version, loads the Music User Token, fetches announcements, and refreshes quota config. Then checks Apple Music subscription. Then initializes IAP and configures the music player.

### Feature Modules (`src/features/`)

Each feature owns its screens, components, hooks, API calls, and services. Only truly shared code lives outside `features/`. Key features:

- **auth** — TV Link pairing flow: TV starts a local web server; user signs in via MusicKit JS on phone browser; token is sent back to TV.
- **bootstrap** — Startup logic, force update, subscription gating, quota, announcements.
- **home** — `HomeScreen` + `MainLayout` + `TopBar` (tab nav). Hosts `ContentNavigationContext` — child screens push detail views onto a stack rendered as `Modal`s.
- **player** — `usePlayer` context, playback controls, lyrics (LRC parser).
- **airplay** — AirPlay receiver (not sender). Receives audio from iPhone's Apple Music.
- **settings** — Settings screen + IAP service (`react-native-iap`).
- **content** — Album/artist/playlist detail screens.

### Native Modules (Kotlin)

Located in `android/app/src/main/java/com/adg/airtune/`:

| Module | Purpose |
|--------|---------|
| `airplay/` | Audio-only AirPlay (RAOP) receiver. `AirPlayModule.kt` (RN name `AirPlayReceiver`) bridges to JS; backed by the UxPlay engine built from source. Includes DACP play/pause/next/prev controls. No video/mirroring. |
| `musicplayer/` | Native music playback. |
| `imagecolors/` | Dynamic background color extraction from artwork. |
| `unityads/` | Unity Ads SDK integration. |

The AirPlay engine is **compiled from source** (UxPlay direct, ported from the sibling AirPipe project) via CMake — `android/app/src/main/cpp/` (UxPlay + ALAC + libplist + prebuilt OpenSSL `.a`) plus the `src/main/jni/` entry point, producing `libairtune_jni.so` for `arm64-v8a` + `armeabi-v7a`. The module is serviceless (engine runs in the RN module; no foreground service). Stable playback timing uses RTP-timestamp anchoring + system-clock interpolation with silence gap detection.

### State & Data

- **React Query** (`@tanstack/react-query`) — all server state / API caching.
- **MMKV** (`react-native-mmkv`) — persistent local storage (tokens, preferences).
- **Apple Music API** — REST API with developer token + music user token auth. For all request/response shapes and TypeScript types, see `docs/APPLE_MUSIC_API_REFERENCE.md`.

### Theme

Use `src/theme/colors.ts` for all colors and `src/theme/layout.ts` for spacing, border radius, and button min heights. No hardcoded hex/rgba values or magic numbers. See `docs/THEME_AND_COLORS.md`.

## Key Conventions

- **D-pad first**: Every interactive element must be focusable. Use `hasTVPreferredFocus={true}` on the first element of any new screen or modal.
- **Modals for overlays**: Screens that overlay others (detail views, dialogs) must use React Native `Modal` — this is required for correct focus trapping on TV.
- **Localization**: All user-visible strings go through i18next (`src/locales/`). Never hardcode UI copy. Supported locales: `en`, `tr`, `de`, `es`, `fr`.
- **English**: All code, comments, and docs are in English.
- **Storefront**: The Apple Music storefront (region) is fetched once and shared via `useStorefront` hook.
