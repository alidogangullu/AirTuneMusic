/**
 * Apple Music Recommendations API.
 * GET /v1/me/recommendations — returns personal recommendations.
 */

import {appleMusicApi} from './client';

export type RecommendationContentType =
  | 'playlists'
  | 'albums'
  | 'stations'
  | 'music-videos'
  | 'songs';

export type RecommendationContent = {
  id: string;
  type: RecommendationContentType;
  attributes?: {
    name?: string;
    artistName?: string;
    artwork?: {
      url: string;
      width?: number;
      height?: number;
    };
    url?: string;
    releaseDate?: string;
    dateAdded?: string;
    genreNames?: string[];
    editorialNotes?: {short?: string};
  };
};

export type PersonalRecommendation = {
  id: string;
  type: 'personal-recommendation';
  attributes?: {
    title?: {stringForDisplay: string};
    resourceTypes?: string[];
    kind?: string;
  };
  relationships?: {
    contents?: {
      data: RecommendationContent[];
    };
  };
};

export type RecommendationsResponse = {
  data: PersonalRecommendation[];
};

export async function fetchRecommendations(): Promise<RecommendationsResponse> {
  const {data} = await appleMusicApi.get<RecommendationsResponse>(
    '/me/recommendations',
    {
      params: {limit: 20},
    },
  );
  return data;
}

const ARTWORK_PROXY = 'http://10.0.2.2:8080/api/apple-music-proxy/image';

/**
 * Build artwork URL with dimensions.
 * Apple Music URLs use {w}x{h}cc.jpg placeholders.
 * __DEV__: Emulator can't reach mzstatic.com, use proxy.
 */
export function getArtworkUrl(
  url: string | undefined,
  width = 300,
  height = 300,
): string | undefined {
  if (!url) return undefined;
  const resolved = url
    .replace(/\{w\}/g, String(width))
    .replace(/\{h\}/g, String(height))
    .replace(/\{f\}/g, 'jpg');
  if (__DEV__) {
    return `${ARTWORK_PROXY}?url=${encodeURIComponent(resolved)}`;
  }
  return resolved;
}
