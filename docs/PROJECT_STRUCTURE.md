# Project structure

This document describes the folder structure for the AirTune Music app (React Native + TypeScript + Apple Music API).

## Root

| Path | Purpose |
|------|---------|
| `App.tsx` | Root component and app entry. |
| `src/` | All application source code. |
| `android/` | Android TV native project. |
| `ios/` | iOS / tvOS native project. |
| `scripts/` | Build and run helpers (e.g. Java 17 wrapper). |
| `docs/` | Project documentation (English). |

## `src/` layout

| Folder | Purpose |
|--------|---------|
| **api/** | API layer. |
| **api/apple-music/** | Apple Music API client: requests, types, and endpoints. Align with [Apple Music API](https://developer.apple.com/documentation/applemusicapi/). |
| **api/mock/** | Mock data and responses for development and testing. |
| **assets/** | Static assets (images, fonts). |
| **assets/stitch/** | Assets and references from Google Stitch (draft UI). |
| **components/** | Reusable UI components. **TopBar** (nav bar), **ContentSection** (home sections). Must be TV-friendly: focusable, D-pad navigable. |
| **constants/** | App-wide constants (config, keys, limits). |
| **hooks/** | Custom React hooks (data, focus, playback, etc.). Key hooks: **useRecommendations** (home feed), **useContentDetail** (unified detail data for any content type), **useAlbumDetail** / **usePlaylistDetail** (legacy, specific-type detail hooks). |
| **i18n/** | Localization: translation files and locale configuration. User-facing text lives here, not hardcoded. |
| **navigation/** | Navigation and routing setup. Exports **ContentNavigationContext** (`pushContent`) — child screens call `pushContent(content)` to open a detail overlay; `HomeScreen` listens and renders `ContentDetailScreen` inside a `Modal`. |
| **screens/** | Screen-level components. **HomeScreen** (main home with TopBar + TopBar + sections, hosts the detail overlay Modal), **ContentDetailScreen** (unified detail screen for all 5 content types), **AlbumDetailScreen** / **PlaylistDetailScreen** (legacy, superseded by ContentDetailScreen), **AppleMusicAuthTestScreen** (pairing/auth). |
| **theme/** | Theming: **colors** (`theme/colors.ts`), **layout** (`theme/layout.ts`), **ThemeProvider** / **useTheme()** (`ThemeContext.tsx`). No hardcoded hex/rgba or magic numbers. See [Theme and colors](THEME_AND_COLORS.md). |
| **types/** | Shared TypeScript types and interfaces. **recommendations.ts** holds all Apple Music content types: `PlaylistDetail`, `AlbumDetail`, `StationDetail`, `SongDetail`, `MusicVideoDetail`, the union `ContentDetailItem`, and `RecommendationContentType`. |
| **utils/** | Pure utilities and helpers. |

## Conventions

- **English**: All code, docs, and rules are in English.
- **Localization**: Use the i18n layer for any user-visible strings.
- **TV**: Primary target is Android TV. **D-pad is the main input** — mouse/touch are secondary. Components must support focus, D-pad navigation, and select-key press. Press feedback and interactions must work with D-pad (e.g. `onPress` fires for select; `pressed` state may not).
- **Apple Music API**: Use `api/apple-music/` for all catalog and playback-related API usage; refer to the official API docs for models and endpoints.
- **Overlay screens / focus trapping**: Screens that overlay others (detail, modal dialogs) **must** use React Native `Modal` (`<Modal visible={...} onRequestClose={...}>`) rather than absolutely positioned `View`s. On Android TV, `Modal` opens a separate OS Window, which guarantees D-pad key events never reach the underlying screen. `importantForAccessibility` and `TVFocusGuideView` alone are insufficient for D-pad focus isolation.
- **Auto-focus on screen open**: The first interactive element in a new screen or modal should receive `hasTVPreferredFocus={true}` so the D-pad cursor lands in the right place immediately when the screen appears.
