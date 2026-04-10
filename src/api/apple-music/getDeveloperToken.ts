/**
 * Apple Music API developer token provider.
 *
 * Token is injected at build time from .env.local (APPLE_MUSIC_DEVELOPER_TOKEN)
 * via scripts/inject-apple-music-token.mjs. Run before bundling (e.g. npm run android).
 * Later: replace implementation to fetch token from your backend (e.g. GET /api/apple-music/token).
 */

import {APPLE_MUSIC_DEVELOPER_TOKEN} from '../../config/appleMusicToken.generated';

/**
 * Returns the Apple Music API developer token (JWT).
 * For now uses the token from the injected config; later switch to fetching from your backend.
 */
export async function getDeveloperToken(): Promise<string> {
  const token = APPLE_MUSIC_DEVELOPER_TOKEN;
  if (!token) {
    throw new Error(
      'Apple Music developer token is missing. Set APPLE_MUSIC_DEVELOPER_TOKEN in .env or fetch from backend.',
    );
  }
  return token;

  // Later: fetch from backend, e.g.:
  // const res = await fetch('https://your-api.com/api/apple-music/token');
  // const { token } = await res.json();
  // return token;
}
