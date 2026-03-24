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

export type RecommendationSection = {
  title: string;
  contents: RecommendationContent[];
};

/**
 * Group recommendations into sections for display.
 */
export function groupRecommendations(
  recommendations: PersonalRecommendation[],
): RecommendationSection[] {
  const sections: RecommendationSection[] = [];

  for (const rec of recommendations) {
    const contents = (rec.relationships?.contents?.data ?? []).filter(
      c => c.type !== 'music-videos',
    );
    if (contents.length === 0) continue;

    const title =
      rec.attributes?.title?.stringForDisplay ?? rec.attributes?.kind ?? '';

    sections.push({
      title,
      contents,
    });
  }

  return sections;
}
