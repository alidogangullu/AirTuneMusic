/**
 * React Query hook for Apple Music recommendations.
 */

import {useQuery} from '@tanstack/react-query';
import {
  fetchRecommendations,
  fetchUserStorefront,
  fetchCatalogCharts,
  fetchMusicVideoCharts,
} from '../api/apple-music/recommendations';
import {
  fetchRecentlyPlayedVideos,
  fetchLibraryMusicVideos,
} from '../api/apple-music/library';
import { RecommendationContent, PersonalRecommendation } from '../types/recommendations';
import type { MusicVideoDetail } from '../types/catalog';

const RECS_QUERY_KEY = ['apple-music', 'recommendations'] as const;
const STOREFRONT_QUERY_KEY = ['apple-music', 'storefront'] as const;
const CHARTS_QUERY_KEY = ['apple-music', 'charts'] as const;

export function useRecommendations() {
  return useQuery({
    queryKey: RECS_QUERY_KEY,
    queryFn: fetchRecommendations,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useStorefront() {
  return useQuery({
    queryKey: STOREFRONT_QUERY_KEY,
    queryFn: fetchUserStorefront,
    staleTime: Infinity, // Country doesn't change often
  });
}

export function useCharts(types = 'playlists,albums') {
  const { data: storefront } = useStorefront();
  
  return useQuery({
    queryKey: [...CHARTS_QUERY_KEY, storefront, types],
    queryFn: () => fetchCatalogCharts(storefront!, types),
    enabled: !!storefront,
    staleTime: 30 * 60 * 1000, // 30 mins
  });
}

export function useVideoCharts() {
  const { data: storefront } = useStorefront();

  return useQuery({
    queryKey: ['apple-music', 'charts', 'music-videos', storefront],
    queryFn: () => fetchMusicVideoCharts(storefront!),
    enabled: !!storefront,
    staleTime: 30 * 60 * 1000,
    select: (charts) => charts.map(chart => ({
      title: chart.name,
      videos: chart.data as MusicVideoDetail[],
    })),
  });
}

export function useVideoRecommendations() {
  return useQuery({
    queryKey: ['apple-music', 'recommendations', 'music-videos'],
    queryFn: async () => {
      const recs = await fetchRecommendations();
      const sections: { title: string; videos: MusicVideoDetail[] }[] = [];

      for (const rec of recs.data) {
        const videos = (rec.relationships?.contents?.data ?? []).filter(
          c => c.type === 'music-videos',
        ) as MusicVideoDetail[];
        if (videos.length === 0) continue;
        const title = rec.attributes?.title?.stringForDisplay ?? '';
        sections.push({ title, videos });
      }

      return sections;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Determines if a recommendation section represents a general category (like a Genre or Activity)
 * rather than a highly personalized section (like "Recently Played", "Made for You", or "Similar to X").
 * Apple Music API is language-dependent for titles, so we use ID prefixes and attribute structures.
 */
export function isCategoricalRecommendation(rec: PersonalRecommendation): boolean {
  if (rec.attributes?.kind === 'recently-played') return false;

  // If the title is explicitly derived from specific content (e.g., "Inspired by The Weeknd"), it's personal
  if (rec.attributes?.title?.contentIds && rec.attributes.title.contentIds.length > 0) {
    return false;
  }

  const idStr = rec.id || '';
  
  // Known personal recommendation ID prefixes in Apple Music:
  // 6- : "Made For You" (Personal Mixes)
  // 7- : "Recently Played"
  // 9- : "New Releases for You"
  // 20-: "Stations for You"
  if (
    idStr.startsWith('6-') ||
    idStr.startsWith('7-') ||
    idStr.startsWith('9-') ||
    idStr.startsWith('20-')
  ) {
    return false;
  }

  // 15- typically indicates contextual stuff. 
  // If it doesn't have contentIds (handled above), it's usually a generic genre/activity category injected into the feed.
  return true;
}

export type RecommendationSection = {
  title: string;
  kind?: string;
  isCategorical: boolean;
  isRadio: boolean;
  contents: RecommendationContent[];
};

export function useRecentlyPlayedVideos() {
  return useQuery({
    queryKey: ['apple-music', 'recent', 'music-videos'],
    queryFn: () => fetchRecentlyPlayedVideos(),
    staleTime: 5 * 60 * 1000,
    select: (videos: any[]) =>
      videos.filter(v => v.type === 'music-videos' || v.type === 'library-music-videos'),
  });
}

export function useLibraryMusicVideos() {
  return useQuery({
    queryKey: ['apple-music', 'library', 'music-videos'],
    queryFn: () => fetchLibraryMusicVideos(),
    staleTime: 5 * 60 * 1000,
  });
}

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
      kind: rec.attributes?.kind,
      isCategorical: isCategoricalRecommendation(rec),
      isRadio: rec.id?.startsWith('20-') === true,
      contents,
    });
  }

  return sections;
}
