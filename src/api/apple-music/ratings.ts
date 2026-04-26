import { appleMusicApi } from './client';
import type { RecommendationContentType } from '../../types/recommendations';

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

// Maps content type to the Apple Music ratings endpoint segment.
// library-playlists are catalog playlists in this context (not user-created),
// so we use the catalog 'playlists' endpoint.
const RATING_TYPE_MAP: Partial<Record<RecommendationContentType, string>> = {
  songs: 'songs',
  albums: 'albums',
  playlists: 'playlists',
  'music-videos': 'music-videos',
  stations: 'stations',
};

export async function getRating(
  id: string,
  contentType: RecommendationContentType = 'songs',
): Promise<number> {
  const ratingType = RATING_TYPE_MAP[contentType];
  if (!ratingType) { return 0; }
  try {
    const response = await appleMusicApi.get<RatingResponse>(`/me/ratings/${ratingType}/${id}`);
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
  const ratingType = RATING_TYPE_MAP[contentType];
  if (!ratingType) { return; }
  if (value === 0) {
    await appleMusicApi.delete(`/me/ratings/${ratingType}/${id}`);
  } else {
    await appleMusicApi.put(`/me/ratings/${ratingType}/${id}`, {
      type: 'rating',
      attributes: { value },
    });
  }
}

// Legacy alias for existing callers
export async function addRating(songId: string, value: number): Promise<void> {
  return setRating(songId, value, 'songs');
}
