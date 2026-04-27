import {useQuery} from '@tanstack/react-query';
import {fetchArtistDetail} from '../../recommendations/api/recommendations';
import {useStorefront} from '../../../hooks/useStorefront';

export function useArtistDetail(id: string | null) {
  const {storefrontId} = useStorefront();

  return useQuery({
    queryKey: ['artist-detail', id, storefrontId],
    queryFn: () => fetchArtistDetail(id ?? '', storefrontId),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}
