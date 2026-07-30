/**
 * Motion artwork (editorialVideo) fetch via amp-api.music.apple.com.
 *
 * The public api.music.apple.com + local .p8 developer token does NOT return
 * editorialVideo. It is only served by the Apple web-player ("amp") host to the
 * privileged web-player token (see RemoteTokenService) together with the user's
 * Media-User-Token. The returned video is an unprotected HLS .m3u8 that plays
 * without any auth — the token is needed only to obtain the URL.
 *
 * If the amp token is unavailable, this returns undefined and the UI keeps the
 * static cover.
 */

import axios from 'axios';
import { getAmpToken } from '../../features/bootstrap/remoteTokenService';
import { getMusicUserToken } from './musicUserToken';
import type { EditorialVideo } from '../../types/catalog';
import i18n from '../../locales';

const AMP_BASE = 'https://amp-api.music.apple.com/v1';

// Motion artwork is carried by playlists, albums and stations.
// (Many featured albums have animated covers; singles/obscure ones don't.)
type AmpCatalogType = 'playlists' | 'albums' | 'stations';

type AmpResponse = {
  data?: Array<{ attributes?: { editorialVideo?: EditorialVideo } }>;
};

// Motion artwork (titles rendered in the video) is localized by the `l` param.
// Mirror client.ts so it follows the app UI language, not the storefront default.
const LOCALE_MAP: Record<string, string> = {
  en: 'en-US',
  tr: 'tr',
  de: 'de',
  es: 'es',
  fr: 'fr',
};

function currentLocale(): string {
  return LOCALE_MAP[i18n.language] ?? 'en-US';
}

/**
 * Fetches the editorialVideo (motion artwork) for a playlist/station/artist.
 * Returns null (never undefined — React Query forbids undefined) when there is
 * no amp token, no user token, or no motion artwork for this resource.
 */
export async function fetchEditorialVideo(
  type: AmpCatalogType,
  id: string,
  storefront: string,
): Promise<EditorialVideo | null> {
  const lang = currentLocale();
  const ampToken = getAmpToken();
  const userToken = getMusicUserToken();
  if (!ampToken || !userToken || !id) return null;

  try {
    const { data } = await axios.get<AmpResponse>(
      `${AMP_BASE}/catalog/${storefront}/${type}/${id}`,
      {
        params: { extend: 'editorialVideo', l: lang },
        headers: {
          Authorization: `Bearer ${ampToken}`,
          'Media-User-Token': userToken,
          Origin: 'https://music.apple.com',
        },
        timeout: 8000,
      },
    );
    return data.data?.[0]?.attributes?.editorialVideo ?? null;
  } catch (error) {
    if (__DEV__) {
      console.warn('[MotionArtwork] amp fetch failed:', error);
    }
    return null;
  }
}

/**
 * Picks the square looping video URL (HLS .m3u8) from an editorialVideo object.
 * Cards are square, so only the square variants are used.
 */
export function getMotionArtworkUrl(
  ev: EditorialVideo | null | undefined,
): string | undefined {
  if (!ev) return undefined;
  return ev.motionSquareVideo1x1?.video ?? ev.motionDetailSquare?.video;
}
