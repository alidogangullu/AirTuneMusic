import axios from 'axios';
import { createMMKV } from 'react-native-mmkv';
import { VERSION_CHECK_URL } from '../../constants/versionInfo';

/**
 * Apple Music web-player ("amp") developer token.
 *
 * Motion artwork (editorialVideo) is only served by amp-api.music.apple.com to
 * the privileged web-player token — our local .p8 developer token cannot fetch it.
 * The token is anonymous and long-lived (~weeks); it is published in the same
 * remote config Gist as the version/quota config and refreshed manually there.
 *
 * If the token is missing or stale, motion artwork requests simply fail and the
 * UI falls back to the static cover — nothing else breaks.
 */

const storage = createMMKV({ id: 'amp-token-storage' });
const TOKEN_KEY = 'amp_token';

export const AmpTokenService = {
  /** Returns the cached amp token (MMKV) synchronously, or null if unavailable. */
  getAmpToken(): string | null {
    const token = storage.getString(TOKEN_KEY);
    return token && token.length > 0 ? token : null;
  },

  /** Fetches the latest tokens from the Gist and persists them to MMKV. */
  async fetchAndUpdate(): Promise<void> {
    try {
      const response = await axios.get<{ ampToken?: string, developerToken?: string }>(
        `${VERSION_CHECK_URL}?t=${Date.now()}`,
        { timeout: 5000 },
      );
      const token = response.data.ampToken;
      if (typeof token === 'string' && token.length > 0) {
        storage.set(TOKEN_KEY, token);
        console.log('[AmpToken] Updated');
      }
      
      const devToken = response.data.developerToken;
      if (typeof devToken === 'string' && devToken.length > 0) {
        storage.set('dev_token', devToken);
        console.log('[DevToken] Updated from Gist');
      }
    } catch (error) {
      console.warn('[AmpToken] Fetch failed, using cached token:', error);
    }
  },
};

/** Convenience accessor used by the motion-artwork API layer. */
export function getAmpToken(): string | null {
  return AmpTokenService.getAmpToken();
}
