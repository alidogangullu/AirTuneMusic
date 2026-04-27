import {useQuery} from '@tanstack/react-query';
import {fetchPlaylistDetail} from '../../recommendations/api/recommendations';
import {useStorefront} from '../../../hooks/useStorefront';

export function usePlaylistDetail(id: string | null) {
  const {storefrontId} = useStorefront();

  return useQuery({
    queryKey: ['playlist-detail', id, storefrontId],
    queryFn: () => fetchPlaylistDetail(id ?? '', storefrontId),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}
