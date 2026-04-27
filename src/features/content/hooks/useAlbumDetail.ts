import {useQuery} from '@tanstack/react-query';
import {fetchAlbumDetail} from '../../recommendations/api/recommendations';
import {useStorefront} from '../../../hooks/useStorefront';

export function useAlbumDetail(id: string | null) {
  const {storefrontId} = useStorefront();

  return useQuery({
    queryKey: ['album-detail', id, storefrontId],
    queryFn: () => fetchAlbumDetail(id ?? '', storefrontId),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}
