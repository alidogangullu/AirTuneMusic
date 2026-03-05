# TV Link Page (Companion login for Android TV)

This folder contains a single-page HTML that lets users **link their Apple Music account to the TV app** by entering the code shown on the Android TV. No “Install Apple Music” on the TV; login happens on phone/PC.

## Local use (no backend)

From the **project root** run:

```bash
npm run tv-link:serve
```

Then open **http://localhost:8080/tv** in your browser. The server reads `EXPO_PUBLIC_APPLE_MUSIC_TOKEN` from `.env.local`, serves the page, and provides the two API endpoints. From the Android TV emulator use **http://10.0.2.2:8080/tv**. Different port: `TV_LINK_PORT=8081 npm run tv-link:serve`.

## Flow

1. **TV app** shows a 6-digit code and the URL of this page (e.g. `https://yoursite.com/tv`).
2. User opens this page on a phone or computer, enters the code, clicks “Sign in with Apple Music”.
3. MusicKit JS runs Apple’s sign-in; the page gets the **Music User Token** and sends it to your backend with the code.
4. **Backend** stores `code → musicUserToken` (e.g. for 10–15 minutes). TV app polls the backend with the code and receives the token.

## Backend API

Your backend must expose two endpoints (paths are examples; you can change them in `index.html`):

### 1. GET developer token

- **Path:** e.g. `GET /api/tv-link/developer-token`
- **Response:** `{ "developerToken": "YOUR_JWT_DEVELOPER_TOKEN" }`
- **Purpose:** So the HTML page can configure MusicKit JS without embedding the secret. Generate the token the same way as for the TV app (see `scripts/generate-developer-token.mjs` or your backend logic).

### 2. POST link (code + token)

- **Path:** e.g. `POST /api/tv-link`
- **Body:** `{ "code": "123456", "musicUserToken": "..." }`
- **Response:** `200 OK` (or any 2xx) on success.
- **Purpose:** Store the mapping `code → musicUserToken` so the TV app can poll and retrieve the token.

The **TV app** should poll something like `GET /api/tv-link?code=123456` and expect a response containing the token (e.g. `{ "musicUserToken": "..." }`) once the user has completed the flow on this page.

## Hosting

- Serve `index.html` at a public URL (e.g. `https://yoursite.com/tv` or `https://yoursite.com/tv-link`).
- Ensure the same origin (or CORS) allows this page to call your backend for `/api/tv-link/developer-token` and `POST /api/tv-link`.
- If the page is on another domain, set `API_BASE` in the script to your backend origin (e.g. `'https://api.yoursite.com'`).

## Hosting in production

Do **not** put your real developer token inside the HTML; always serve it from the backend via the developer-token endpoint.
