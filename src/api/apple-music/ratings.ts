import { appleMusicApi } from './client';

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

export async function getRating(songId: string): Promise<number> {
  try {
    const response = await appleMusicApi.get<RatingResponse>(`/me/ratings/songs/${songId}`);
    return response.data.data[0]?.attributes.value ?? 0;
  } catch (error) {
    // If no rating exists, it might return 404 or empty data
    return 0;
  }
}

export async function addRating(songId: string, value: number): Promise<void> {
  await appleMusicApi.put(`/me/ratings/songs/${songId}`, {
    type: 'ratings',
    attributes: {
      value,
    },
  });
}
