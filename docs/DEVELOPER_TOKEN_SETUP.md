# Apple Music API — Developer Token Setup

This guide follows [Generating Developer Tokens](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens) and [Create a media identifier and private key](https://developer.apple.com/help/account/configure-app-capabilities/create-a-media-identifier-and-private-key/). The developer token is a **signed JWT** required in the `Authorization: Bearer` header for every Apple Music API request.

---

## Where to put your credentials (Team ID, Key ID, .p8)

**If you already have Team ID, Key ID, and the `.p8` file:**

1. In the **project root**, create a file named **`.env.local`** (it is in `.gitignore` — do not commit it).
2. Copy the template: **`cp .env.example .env.local`**
3. Open **`.env.local`** and set:
   - **`APPLE_TEAM_ID`** = your 10-character Team ID
   - **`APPLE_KEY_ID`** = your 10-character Key ID
   - **`APPLE_PRIVATE_KEY_PATH`** = path to the `.p8` file, e.g. `./AuthKey_XXXXXXXXXX.p8`  
     Or put the key content in **`APPLE_PRIVATE_KEY`** (paste the whole block including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`).
4. Run **`npm run token:apple-music`** — the script reads `.env.local` and prints the JWT.

Example `.env.local`:

```env
APPLE_TEAM_ID=DEF123GHIJ
APPLE_KEY_ID=ABC123DEFG
APPLE_PRIVATE_KEY_PATH=./keys/AuthKey_ABC123DEFG.p8
```

Put your `.p8` file in the project’s **`keys/`** folder (that folder is in `.gitignore` and is never committed).

### Using the token in the app (Expo)

To pass the developer token into the app, add it to **`.env.local`** (same file as above) as:

```env
EXPO_PUBLIC_APPLE_MUSIC_TOKEN=eyJhbGciOiJFUzI1NiIs...
```

Use the value from `npm run token:apple-music`. The app reads it via `app.config.js` and uses it for all Apple Music API requests (see `src/api/apple-music/`). Later you can switch to fetching the token from your backend by changing `getDeveloperToken` in `src/api/apple-music/getDeveloperToken.ts`.

---

## What you need

| Item | Where to get it |
|------|------------------|
| **Apple Developer account** | [developer.apple.com](https://developer.apple.com) (paid membership). |
| **Team ID** (`iss`) | Account → Membership → Membership Information (10-character string). |
| **Media identifier** | Certificates, Identifiers & Profiles → Identifiers → Media IDs → create one with Apple Music enabled. |
| **Key ID** (`kid`) | Created when you generate the private key for the Media ID (10 characters). |
| **Private key** (`.p8`) | Downloaded once when you create the key; used to sign the JWT with **ES256**. |

---

## Step 1: Create a Media identifier

1. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources).
2. In the sidebar, click **Identifiers**.
3. Click the **+** button, choose **Media IDs**, then **Continue**.
4. Enter a **description** (e.g. “AirTune Music”).
5. Enter a **reverse-domain identifier** (e.g. `media.com.adg.airtune`).
6. Enable **Apple Music** (and any other services you need).
7. Click **Continue** → **Register** → **Done**.

The description is shown to users when the app requests Apple Music access.

---

## Step 2: Create and download the private key

1. In the same **Identifiers** section, open your **Media ID** (or go to **Keys** in the sidebar).
2. Create a new **key** that has **Apple Music** (or Media Services) enabled.  
   Or: [Create a private key to access a service](https://developer.apple.com/help/account/keys/create-a-private-key).
3. **Download the `.p8` file** — you can only download it once. Store it securely and **never commit it to git**.
4. Note the **Key ID** (`kid`) shown for this key (10 characters). You will use it in the JWT header.

---

## Step 3: Get your Team ID

1. Sign in at [developer.apple.com/account](https://developer.apple.com/account).
2. Open **Membership** in the sidebar.
3. Under **Membership Information**, copy your **Team ID** (10 characters). This is the `iss` (issuer) claim in the JWT.

---

## Step 4: JWT format (developer token)

Apple **only** accepts tokens signed with **ES256** (ECDSA P-256 + SHA-256). Unsupported or unsigned tokens result in **401 Unauthorized**.

**Header:**

```json
{
  "alg": "ES256",
  "kid": "YOUR_KEY_ID_10_CHARS"
}
```

**Payload:**

| Claim | Required | Description |
|-------|----------|-------------|
| `iss` | Yes | Your Team ID (10 characters). |
| `iat` | Yes | Issued at — Unix timestamp (seconds), UTC. |
| `exp` | Yes | Expiration — Unix timestamp. Must be ≤ `iat + 15777000` (6 months). |
| `origin` | No | For web only: array of allowed origins to restrict token use. |

**Signing:** Sign the JWT with your **Media Services private key** (the `.p8` file) using **ES256**.

Example decoded token (before signing):

```json
// header
{ "alg": "ES256", "kid": "ABC123DEFG" }
// payload
{ "iss": "DEF123GHIJ", "iat": 1437179036, "exp": 1493298100 }
```

---

## Step 5: Use the token in requests

Every Apple Music API request must send:

```http
Authorization: Bearer <signed-developer-token>
```

Example:

```bash
curl -v -H 'Authorization: Bearer <YOUR_TOKEN>' "https://api.music.apple.com/v1/catalog/us/search?term=test&types=songs&limit=1"
```

For **user library** endpoints (`/me/...`), you also need the **Music User Token** in the `Music-User-Token` header (see [User Authentication for MusicKit](https://developer.apple.com/documentation/AppleMusicAPI/user-authentication-for-musickit)).

---

## Security

- **Never commit** the `.p8` file or raw private key to the repository.
- Prefer **environment variables** or a **secrets manager** for Team ID, Key ID, and private key (or path to `.p8`).
- Add `*.p8` and `.env*.local` to `.gitignore` if you use a local env file for keys.
- Token can be generated **server-side** or in a **local/build script**; the React Native app should receive an already-signed token (e.g. from your backend) rather than holding the private key.

---

## Generating a token in this project

1. **Install dependencies** (includes `jsonwebtoken` for the script):

   ```bash
   npm install
   ```

2. **Create `.env.local`** in the project root (it is gitignored) and add your credentials:

   - Copy the example: `cp .env.example .env.local`
   - Edit `.env.local` and set:
     - `APPLE_TEAM_ID` — your Team ID (10 characters).
     - `APPLE_KEY_ID` — your Key ID (10 characters).
     - Either `APPLE_PRIVATE_KEY_PATH=./path/to/AuthKey_xxxxx.p8` (path to the `.p8` file), or `APPLE_PRIVATE_KEY` with the full key content (e.g. paste between quotes).

3. **Run the script** to print a new token (e.g. for local testing or to give to a backend):

   ```bash
   npm run token:apple-music
   ```
   Or: `node scripts/generate-developer-token.mjs`

   The script uses `iat` = now and `exp` = 6 months from now, and outputs the signed JWT to stdout.

For production, generate the token on a **backend** that has access to the private key and expose an endpoint that returns a fresh token (or use short-lived tokens and refresh).

---

## Rate limiting

If you send too many requests with the same developer token, Apple returns **429 Too Many Requests**. Reduce the request rate and retry after a short backoff.

---

## References

- [Generating Developer Tokens](https://developer.apple.com/documentation/applemusicapi/generating-developer-tokens)
- [Create a media identifier and private key](https://developer.apple.com/help/account/configure-app-capabilities/create-a-media-identifier-and-private-key/)
- [Create a private key to access a service](https://developer.apple.com/help/account/keys/create-a-private-key)
- [JWT (RFC 7519)](https://tools.ietf.org/html/rfc7519)
- Project API reference: [docs/APPLE_MUSIC_API_REFERENCE.md](APPLE_MUSIC_API_REFERENCE.md)
