# Apple Music — User login (Music User Token)

When you need **user login** and what you need to implement for **Android TV**.

**References:**  
- [User Authentication for MusicKit](https://developer.apple.com/documentation/AppleMusicAPI/user-authentication-for-musickit)  
- [MusicKit for Android](https://developer.apple.com/musickit/android/) (authentication)

---

## When is user login required?

| Use case | Developer token only | Music User Token (user login) |
|----------|----------------------|-------------------------------|
| **Catalog** — search, browse, get albums/songs/artists | ✅ Yes | ❌ No |
| **Charts**, storefronts, genres | ✅ Yes | ❌ No |
| **User library** — `/me/library/songs`, `/me/library/albums`, etc. | ❌ No | ✅ **Required** |
| **User playlists** — create, add tracks, library playlists | ❌ No | ✅ **Required** |
| **Ratings** — get/set user ratings | ❌ No | ✅ **Required** |
| **History** — recently played | ❌ No | ✅ **Required** |
| **Recommendations** — personalized | ❌ No | ✅ **Required** |

So: **catalog-only** (search, browse, charts) → developer token is enough.  
**User-specific** (library, playlists, ratings, history, recommendations) → **Music User Token** is required (= user must sign in with Apple Music).

---

## How user auth works

- **Header:** `Music-User-Token: [music user token]` together with `Authorization: Bearer [developer token]`.
- **iOS/tvOS/Web:** MusicKit manages the Music User Token for you.
- **Android:** There is **no automatic** management. You must use **MusicKit for Android** and its auth flow to get the token.

---

## What you need for Android (Music User Token)

### 1. MusicKit for Android SDK

- **Docs:** [MusicKit for Android](https://developer.apple.com/musickit/android/)
- **Auth package:** `com.apple.android.sdk.authentication`
- Add the MusicKit Android dependency to your app (see Apple’s Android integration guide).

### 2. Auth flow (high level)

1. **Developer token** — You already have this (JWT from `yarn token:apple-music`).
2. **Start auth UI** — Use MusicKit’s **AuthIntentBuilder** with your developer token to get an **Intent**.
3. **User signs in** — Launch that Intent (e.g. `startActivityForResult`). User signs in with Apple ID / Apple Music in the system/Apple UI.
4. **Get Music User Token** — In `onActivityResult`, pass the result **Intent** to **AuthenticationManager.handleTokenResult(intent)**. You get a **TokenResult** with `getMusicUserToken()` or an error via `getError()`.
5. **Use the token** — Send it in the `Music-User-Token` header for every request to `/v1/me/...`.

### 3. Main components (Android)

| Component | Purpose |
|-----------|---------|
| [AuthenticationFactory](https://developer.apple.com/musickit/android/com/apple/android/sdk/authentication/AuthenticationFactory.html) | `createAuthenticationManager(Context)` → **AuthenticationManager** |
| [AuthenticationManager](https://developer.apple.com/musickit/android/com/apple/android/sdk/authentication/AuthenticationManager.html) | `createIntentBuilder(developerToken)` → **AuthIntentBuilder**; `handleTokenResult(Intent)` → **TokenResult** |
| [AuthIntentBuilder](https://developer.apple.com/musickit/android/com/apple/android/sdk/authentication/AuthIntentBuilder.html) | Builds the Intent for the sign-in flow. Constructor: `(Context, developerToken)`. Optional: `setStartScreenMessage()`, `setContextId()`, `setHideStartScreen()`, `build()` → Intent |
| [TokenResult](https://developer.apple.com/musickit/android/com/apple/android/sdk/authentication/TokenResult.html) | `getMusicUserToken()` → String, or `isError()` / `getError()` |
| [TokenError](https://developer.apple.com/musickit/android/com/apple/android/sdk/authentication/TokenError.html) | Error codes when token fetch fails |
| [TokenProvider](https://developer.apple.com/musickit/android/com/apple/android/sdk/authentication/TokenProvider.html) | Interface: `getDeveloperToken()`, `getUserToken()` — implement if the SDK expects a provider |

### 4. Flow in code (Android)

1. Get **AuthenticationManager**: `AuthenticationFactory.createAuthenticationManager(context)`.
2. Build Intent: `authManager.createIntentBuilder(developerToken).build()` (optionally set message, contextId, etc.).
3. Start activity for result with this Intent.
4. In result callback: `TokenResult result = authManager.handleTokenResult(dataIntent)`; if `!result.isError()`, use `result.getMusicUserToken()`.
5. Store the Music User Token (e.g. secure storage) and send it in the `Music-User-Token` header for all `/me/` API calls.

---

## In this project (React Native)

- **Catalog-only (no login):** Developer token injected at build time; `appleMusicApi` adds `Authorization: Bearer`. No user auth needed.
- **User library / playlists / recommendations:**
  1. **Add the MusicKit AAR** — Download from [Apple Developer Downloads](https://developer.apple.com/download/all/?q=Android%20MusicKit) and place the auth AAR in `android/app/libs/`. See `android/app/libs/README.md`.
  2. **Sign in from JS:** Call `startAppleMusicAuth()` from `src/api/apple-music`. It launches the native sign-in UI and stores the Music User Token.
  3. **API client:** `appleMusicApi` automatically adds `Music-User-Token` to every request whose path contains `/me/` if a token is set (after sign-in).
  4. **Token storage:** In-memory for now (`musicUserToken.ts`). Optionally persist with AsyncStorage or secure storage and restore on launch; call `setMusicUserToken(token)` after restore.

### JS API (from `src/api/apple-music`)

| Export | Purpose |
|--------|---------|
| `startAppleMusicAuth()` | Starts Apple Music sign-in (Android). Returns `Promise<string>` (Music User Token). Also stores the token for the client. |
| `getMusicUserToken()` | Returns the stored token or `null`. |
| `setMusicUserToken(token \| null)` | Set/clear the token (e.g. after restore from storage or logout). |
| `clearMusicUserToken()` | Clears the stored token. |
| `appleMusicApi` | Axios instance: Bearer + optional Music-User-Token for `/me/` requests. |

---

## Checklist — user login (Android)

- [x] Add MusicKit for Android SDK to the project — AAR in `android/app/libs/`; see `android/app/libs/README.md`.
- [x] Implement auth flow: native module `AppleMusicAuthModule` (AuthIntentBuilder → startActivityForResult → handleTokenResult); JS `startAppleMusicAuth()`.
- [ ] Persist Music User Token securely (e.g. AsyncStorage or secure storage) and restore on app launch; call `setMusicUserToken` after restore.
- [x] Pass Music User Token into the API layer — stored in `musicUserToken.ts`; client adds header for `/me/` requests.
- [x] For every request to `https://api.music.apple.com/v1/me/...`, set header `Music-User-Token` — done in `client.ts` interceptor.
- [ ] Handle token expiry / re-auth (e.g. on 403, call `startAppleMusicAuth()` again or prompt user).

---

## Android TV: Why the default flow doesn’t work

The MusicKit for Android auth flow is built for **phones/tablets**:

- It expects the **Apple Music app** to be installed.
- If not installed, it shows a screen like **“To play the full song, connect … to Apple Music”** with an **“Install Apple Music”** button.
- On **Android TV** there is no official Apple Music app; the flow would send the user to the Play Store or a browser, which is a poor experience and often not viable on TV.

So **on Android TV, the native “Install Apple Music” / in-app auth flow is not a good option**.

---

## Android TV: Alternative — companion (pairing) login

Use a **second device** (phone or computer) to log in with Apple Music and send the **Music User Token** to the TV app. Same idea as Spotify’s **spotify.com/pair** or YouTube’s “Link with TV code”.

### Flow (high level)

1. **On the TV app**
   - Show a short message: “Go to **yoursite.com/tv** and enter this code: **XXXXXX**”.
   - Show a 6-digit (or similar) code.
   - Start **polling your backend**: “Is there a token for code XXXXXX?”.

2. **On the user’s phone/PC**
   - User opens **yoursite.com/tv** in a browser.
   - User enters the code shown on the TV.
   - Your page uses **MusicKit JS** to sign in:
     - `MusicKit.configure({ developerToken: '…' });`
     - `const musicUserToken = await music.authorize();`
   - After success, the page sends the token to your backend together with the code (e.g. `POST /api/tv-link` with `{ code, musicUserToken }`).

3. **Your backend**
   - Stores the mapping “code → musicUserToken” (with a short TTL, e.g. 10–15 minutes).
   - Optionally stores the token for that user/device for later use (then you need a simple “user” or “device” concept).

4. **TV app**
   - Polls the backend (e.g. `GET /api/tv-link?code=XXXXXX`).
   - When the backend returns the token, the TV app saves it (e.g. `setMusicUserToken(token)`) and stops polling.
   - Use the token for all `/me/` Apple Music API calls as you already do.

### What you need

| Piece | Role |
|-------|------|
| **Backend** | Endpoint to receive `(code, musicUserToken)` from the web page; endpoint for the TV to poll and get the token for a code; short-lived storage (e.g. in-memory or Redis). |
| **Web page** (e.g. `/tv`) | Form to enter the TV code; load MusicKit JS; call `music.authorize()`; send the returned token + code to your backend. |
| **TV app** | UI to show code + URL; polling logic; on success call `setMusicUserToken(token)` and use existing API client. |

The **Music User Token** you get from MusicKit JS is the same as the one from the Android SDK; you use it in the `Music-User-Token` header for `/me/` requests. So your existing API client and token storage on the TV app can stay as they are; only the **way the TV gets the token** changes (from native “Install Apple Music” to “pair via browser on another device”).

### References

- [MusicKit JS](https://developer.apple.com/documentation/applemusicapi/musickit_js) — use `music.authorize()` to get the Music User Token in the browser.
- [Storing the Apple Music User Token with MusicKit JS](https://medium.com/@gavinkasdorf/apples-musickit-js-allows-you-to-access-an-apple-music-user-s-playlists-and-library-listen-to-32f77ff54d48) — sending the token to a server and using it for API calls.
- Spotify’s [spotify.com/pair](https://www.spotify.com/pair) — same “TV code + second device” pattern.

---

## Summary

- **Developer token** → already done; used for catalog and as input to the auth flow.
- **Music User Token** → needed for anything under `/me/` (library, playlists, ratings, history, recommendations).
- **On Android (phone/tablet)** → use MusicKit for Android auth (AuthIntentBuilder + AuthenticationManager + TokenResult) to get the Music User Token, then send it in the `Music-User-Token` header.
- **On Android TV** → the native flow shows “Install Apple Music” and is not suitable. Use the **companion (pairing) flow** above: TV shows a code; user logs in on a phone/PC via a web page using MusicKit JS; your backend links code ↔ token; TV polls and receives the token.
