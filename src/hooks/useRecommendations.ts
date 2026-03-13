/**
 * React Query hook for Apple Music recommendations.
 */

import {useQuery} from '@tanstack/react-query';
import {
  fetchRecommendations,
} from '../api/apple-music/recommendations';
import { RecommendationContent, PersonalRecommendation } from '../types/recommendations';

const QUERY_KEY = ['apple-music', 'recommendations'] as const;

export function useRecommendations() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchRecommendations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export type FlattenedRecommendation = {
  recommendationTitle: string;
  content: RecommendationContent;
};

/**
 * Flatten recommendations into content items for display.
 * Each recommendation can have multiple contents (playlists, albums, stations).
 */
export function flattenRecommendationContents(
  recommendations: PersonalRecommendation[],
): FlattenedRecommendation[] {
  const result: FlattenedRecommendation[] = [];

  for (const rec of recommendations) {
    const contents = rec.relationships?.contents?.data ?? [];
    const title =
      rec.attributes?.title?.stringForDisplay ?? rec.attributes?.kind ?? '';

    for (const content of contents) {
      if (content.type === 'music-videos') continue;
      result.push({recommendationTitle: title, content});
    }
  }

  return result;
}
