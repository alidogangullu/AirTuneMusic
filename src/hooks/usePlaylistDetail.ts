import {useQuery} from '@tanstack/react-query';
import {fetchPlaylistDetail} from '../api/apple-music/recommendations';
import {useStorefront} from './useStorefront';

export function usePlaylistDetail(id: string | null) {
  const {storefrontId} = useStorefront();

  return useQuery({
    queryKey: ['playlist-detail', id, storefrontId],
    queryFn: () => fetchPlaylistDetail(id ?? '', storefrontId),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}
