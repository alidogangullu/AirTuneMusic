# AirTune Music

**Apple Music Android TV client** built with TypeScript, React Native, and the [Apple Music API](https://developer.apple.com/documentation/applemusicapi/).

## Technical overview

| Area | Technology |
|------|------------|
| Framework | React Native |
| TV runtime | `react-native-tvos` |
| Language | TypeScript |
| Backend / catalog | Apple Music API |
| Target platform | Android TV only |

- **UI**: Draft (non-final) designs are in **Google Stitch**; design data can be fetched via MCP when needed.
- **Input**: Development must account for **Android TV remote** (D-pad, focus, key events).
- **Language**: All documentation, rules, and code are in **English**. The app uses **localization** for user-facing strings.

## Backend (your server)

A **backend** is used for:

1. **Developer token** — The app (and the TV link page) must get the Apple Music API developer token (JWT) from your server, not from the client bundle. Today the app uses an injected token at build time (see [Developer token](#requirements)); in production the app and the TV link page should call your backend (e.g. `GET /api/apple-music/developer-token`) to obtain the token.
2. **Apple Music user auth (TV link)** — For sign-in on Android TV, the user enters a code on a web page (phone/PC). Your backend stores the mapping **code ↔ Music User Token** and serves the TV link page and its API:
   - **GET** developer token (for the TV link page to configure MusicKit JS).
   - **POST** code + Music User Token (when the user signs in on the page).
   - **GET** token by code (so the TV app can poll and receive the token).

For **local development** you can use the in-repo TV link server (`npm run tv-link:serve` which simply runs `node tv-link-page/server.mjs`), or call the script directly without npm. It reads the developer token from `.env.local` and provides the necessary endpoints. For **production**, host the [tv-link-page](tv-link-page/) (or equivalent) and implement the same API on your backend. See [tv-link-page/README.md](tv-link-page/README.md) for the exact contract.

## Project structure

The codebase follows a structure suited for React Native + TypeScript + Apple Music API:

```
├── App.tsx
├── src/
│   ├── api/                 # API layer
│   │   ├── apple-music/     # Apple Music API client, types, endpoints
│   │   └── mock/            # Mock data for development
│   ├── assets/              # Images, fonts, static assets
│   │   └── stitch/          # Stitch design assets
│   ├── components/          # Reusable UI components (TV-friendly, focus-aware)
│   ├── constants/           # App constants
│   ├── hooks/               # Custom React hooks
│   ├── i18n/                # Localization (translations, locale config)
│   ├── navigation/          # Navigation / routing
│   ├── screens/             # Screen components
│   ├── theme/               # Theming (colors, typography)
│   ├── types/               # Shared TypeScript types
│   └── utils/               # Utilities
├── android/                 # Android TV native project
├── tv-link-page/            # TV link page (HTML + local server); production: host on your backend
├── scripts/                 # Build/run helpers (e.g. Java 17 for Android)
└── docs/                    # Project documentation
```

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for details.

## Requirements

- Node.js (see `.node-version`)
- Apple Music API: developer token (JWT). See [docs/DEVELOPER_TOKEN_SETUP.md](docs/DEVELOPER_TOKEN_SETUP.md) for setup and `npm run token:apple-music` to generate a token. For **local dev**: set `EXPO_PUBLIC_APPLE_MUSIC_TOKEN` in `.env.local`; the app and TV link server use it. For **production**: the app and TV link page should fetch the token from your [backend](#backend-your-server).
- Android: `ANDROID_HOME` or `ANDROID_SDK_ROOT`, **Java 17**, TV AVD (e.g. `Android_TV_API36`). For **user sign-in** (library, playlists): add the MusicKit for Android AAR to `android/app/libs/` — see [docs/APPLE_MUSIC_USER_AUTH.md](docs/APPLE_MUSIC_USER_AUTH.md) and `android/app/libs/README.md`.

## Running the app

| Platform | Command |
|----------|---------|
| Android TV (choose device) | `npx react-native run-android` |
| TV link server (for sign-in from browser) | `npm run tv-link:serve` |

Detailed Android TV run/debug: [docs/ANDROID_TV_RUN_DEBUG.md](docs/ANDROID_TV_RUN_DEBUG.md).

