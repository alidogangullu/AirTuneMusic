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

- **Input**: Development must account for **Android TV remote** (D-pad, focus, key events).
- **Language**: All documentation and code are in **English**. The app uses **localization** for user-facing strings.

## Local Pairing Server (TV Link)

Because Android TV lacks a convenient keyboard, this app uses a **pairing flow** for user authentication:

1. The Android TV app starts a **built-in local web server** when the sign-in screen is opened.
2. The user navigates to the TV's IP address (e.g., `http://192.168.1.50:8080/tv`) on a phone or PC.
3. The user signs in via Apple MusicKit JS on that page.
4. The web page sends the **Music User Token** back to the TV app's local server.
5. The TV app receives the token and completes the sign-in.

For local development, the app's server can be accessed at `http://10.0.2.2:8080/tv` from within the Android emulator.

## Project structure

The codebase follows a structure suited for React Native + TypeScript + Apple Music API:

```
├── App.tsx
├── src/
│   ├── api/                 # Apple Music API client, types, endpoints
│   ├── assets/              # Static assets (images, fonts)
│   ├── components/          # Reusable UI components (TV-friendly, focus-aware)
│   ├── config/              # Build-time generated configuration
│   ├── constants/           # App constants
│   ├── hooks/               # Custom React hooks
│   ├── i18n/                # Localization configuration (i18next)
│   ├── locales/             # Translation strings (JSON)
│   ├── navigation/          # Navigation / routing
│   ├── screens/             # Screen components
│   ├── services/            # Native module wrappers and services (e.g., tvLinkServer)
│   ├── theme/               # Theming (colors, typography)
│   ├── types/               # Shared TypeScript types
│   └── utils/               # Utilities
├── android/                 # Android TV native project
├── tv-link-page/            # Pairing page (HTML/JS) served by the app
├── scripts/                 # Build/run helpers
└── docs/                    # Project documentation
```

See [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) for details.

## Requirements

- Node.js (see `.node-version`) and **Yarn** (recommended).
- Apple Music API: developer token (JWT). See [docs/DEVELOPER_TOKEN_SETUP.md](docs/DEVELOPER_TOKEN_SETUP.md) for setup and `yarn token:apple-music` to generate a token. For **local dev**: set `APPLE_MUSIC_DEVELOPER_TOKEN` in `.env.local`.
- Android: `ANDROID_HOME` or `ANDROID_SDK_ROOT`, **Java 17**, TV AVD (e.g. `Android_TV_API36`). For **user sign-in** (library, playlists): add the MusicKit for Android AAR to `android/app/libs/` — see [docs/APPLE_MUSIC_USER_AUTH.md](docs/APPLE_MUSIC_USER_AUTH.md).

## Running the app

| Platform | Command |
|----------|---------|
| Android TV (choose device) | `npm run android` |

Detailed Android TV run/debug: [docs/ANDROID_TV_RUN_DEBUG.md](docs/ANDROID_TV_RUN_DEBUG.md).
