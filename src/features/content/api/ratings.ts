import { appleMusicApi } from '../../../api/apple-music/client';
import type { RecommendationContentType } from '../../../types/recommendations';

export interface RatingAttributes {
  value: number; // 1 for love, -1 for dislike, 0 for none
}

export interface RatingResource {
  id: string;
  type: 'ratings';
  href: string;
  attributes: RatingAttributes;
}

export interface RatingResponse {
  data: RatingResource[];
}

const CATALOG_RATING_TYPE_MAP: Partial<Record<RecommendationContentType, string>> = {
  songs: 'songs',
  albums: 'albums',
  playlists: 'playlists',
  'music-videos': 'music-videos',
  stations: 'stations',
};

const LIBRARY_RATING_TYPE_MAP: Partial<Record<RecommendationContentType, string>> = {
  songs: 'library-songs',
  albums: 'library-albums',
  playlists: 'library-playlists',
  'music-videos': 'library-music-videos',
};

// Library resource IDs start with 'l.' (albums), 'i.' (songs), or 'p.' (playlists).
function isLibraryId(id: string): boolean {
  return id.startsWith('l.') || id.startsWith('i.') || id.startsWith('p.');
}

function ratingSegment(id: string, contentType: RecommendationContentType): string | undefined {
  if (isLibraryId(id)) {
    return LIBRARY_RATING_TYPE_MAP[contentType];
  }
  return CATALOG_RATING_TYPE_MAP[contentType];
}

export async function getRating(
  id: string,
  contentType: RecommendationContentType = 'songs',
): Promise<number> {
  const segment = ratingSegment(id, contentType);
  if (!segment) { return 0; }
  try {
    const response = await appleMusicApi.get<RatingResponse>(`/me/ratings/${segment}/${id}`);
    return response.data.data[0]?.attributes.value ?? 0;
  } catch {
    return 0;
  }
}

export async function setRating(
  id: string,
  value: number,
  contentType: RecommendationContentType = 'songs',
): Promise<void> {
  const segment = ratingSegment(id, contentType);
  if (!segment) { return; }
  if (value === 0) {
    await appleMusicApi.delete(`/me/ratings/${segment}/${id}`);
  } else {
    await appleMusicApi.put(`/me/ratings/${segment}/${id}`, {
      type: 'rating',
      attributes: { value },
    });
  }
}

// Legacy alias for existing callers
export async function addRating(songId: string, value: number): Promise<void> {
  return setRating(songId, value, 'songs');
}
