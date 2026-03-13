import {useQuery} from '@tanstack/react-query';
import {fetchArtistDetail} from '../api/apple-music';
import {useStorefront} from './useStorefront';

export function useArtistDetail(id: string | null) {
  const {storefrontId} = useStorefront();

  return useQuery({
    queryKey: ['artist-detail', id, storefrontId],
    queryFn: () => fetchArtistDetail(id ?? '', storefrontId),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}
