# TV Link Page (Companion login for Android TV)

This folder contains a single-page HTML that lets users **link their Apple Music account to the TV app** by entering the code shown on the Android TV. 

## How it works

1. **TV app** starts a native local server and shows a 6-digit code and its local URL (e.g. `http://192.168.1.50:8080/tv`).
2. User opens this URL on a phone or computer connected to the same network.
3. The TV app's local server serves this `index.html` page.
4. User enters the code, clicks “Sign in with Apple Music”, and signs in via Apple MusicKit JS.
5. The page sends the **Music User Token** back to the TV app's local server (via `POST /api/tv-link`).
6. The TV app receives the token and completes the sign-in.

## Structure

- **index.html**: The pairing UI. Uses MusicKit JS to authenticate the user and obtain a Music User Token.
- **scripts/**: (If any) supporting scripts for the pairing page.

## Backend / Integration

In the current implementation, the Android app acts as the server. The `index.html` communicates with endpoints provided by the `TVLinkServer` native module:

- `GET /api/tv-link/developer-token`: Provides the Apple Music developer JWT.
- `POST /api/tv-link`: Receives the code and Music User Token from the browser.

## Security

The developer token is served by the app's local server after being injected at build time (from `APPLE_MUSIC_DEVELOPER_TOKEN` in `.env.local`). In a production web-hosted scenario, you should always serve the token from a secure backend rather than embedding it in the HTML.
