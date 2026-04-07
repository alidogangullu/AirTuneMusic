import { useQuery } from '@tanstack/react-query';
import {
  fetchLiveRadioStations,
  fetchPersonalRadioStation,
  fetchRecentlyPlayedStations,
} from '../api/apple-music/radio';
import { useStorefront } from './useRecommendations';

export function useRadioStations() {
  const { data: storefront } = useStorefront();

  const liveRadioQuery = useQuery({
    queryKey: ['apple-music', 'radio', 'live', storefront],
    queryFn: () => fetchLiveRadioStations(storefront!),
    enabled: !!storefront,
    staleTime: 5 * 60 * 1000,
  });

  const personalRadioQuery = useQuery({
    queryKey: ['apple-music', 'radio', 'personal', storefront],
    queryFn: () => fetchPersonalRadioStation(storefront!),
    enabled: !!storefront,
    staleTime: 5 * 60 * 1000,
  });

  const recentRadioQuery = useQuery({
    queryKey: ['apple-music', 'radio', 'recent'],
    queryFn: fetchRecentlyPlayedStations,
    staleTime: 5 * 60 * 1000,
  });

  return {
    liveRadio: liveRadioQuery,
    personalRadio: personalRadioQuery,
    recentRadio: recentRadioQuery,
    isLoading: liveRadioQuery.isLoading || personalRadioQuery.isLoading || recentRadioQuery.isLoading,
    error: liveRadioQuery.error || personalRadioQuery.error || recentRadioQuery.error,
    refetch: () => {
      liveRadioQuery.refetch();
      personalRadioQuery.refetch();
      recentRadioQuery.refetch();
    },
  };
}
