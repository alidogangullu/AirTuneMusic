/**
 * Apple Music API developer token provider.
 *
 * Token is injected at build time from .env.local (APPLE_MUSIC_DEVELOPER_TOKEN)
 * via scripts/inject-apple-music-token.mjs. Run before bundling (e.g. npm run android).
 * Later: replace implementation to fetch token from your backend (e.g. GET /api/apple-music/token).
 */

import {APPLE_MUSIC_DEVELOPER_TOKEN} from '../../config/appleMusicToken.generated';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'amp-token-storage' });

/**
 * Returns the Apple Music API developer token (JWT).
 * Tries to fetch the remote token from MMKV (updated via Gist), falls back to local .env token.
 */
export async function getDeveloperToken(): Promise<string> {
  const remoteToken = storage.getString('dev_token');
  if (remoteToken && remoteToken.length > 0) {
    return remoteToken;
  }

  const token = APPLE_MUSIC_DEVELOPER_TOKEN;
  if (!token) {
    throw new Error(
      'Apple Music developer token is missing. Set APPLE_MUSIC_DEVELOPER_TOKEN in .env or fetch from backend.',
    );
  }
  return token;
}
