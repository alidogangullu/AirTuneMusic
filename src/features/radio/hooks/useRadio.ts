import { useQuery } from '@tanstack/react-query';
import {
  fetchLiveRadioStations,
  fetchPersonalRadioStation,
  fetchRecentlyPlayedStations,
} from '../api/radio';
import { useStorefront } from '../../../hooks/useStorefront';

export function useRadioStations() {
  const { storefrontId: storefront } = useStorefront();

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
    isLoading: !storefront || liveRadioQuery.isLoading || personalRadioQuery.isLoading || recentRadioQuery.isLoading,
    error: liveRadioQuery.error || personalRadioQuery.error || recentRadioQuery.error,
    refetch: () =>
      Promise.all([
        liveRadioQuery.refetch(),
        personalRadioQuery.refetch(),
        recentRadioQuery.refetch(),
      ]),
  };
}
