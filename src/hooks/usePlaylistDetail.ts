import {useQuery} from '@tanstack/react-query';
import {fetchPlaylistDetail} from '../api/apple-music/recommendations';

export function usePlaylistDetail(id: string | null, storefront = 'tr') {
  return useQuery({
    queryKey: ['playlist-detail', id, storefront],
    queryFn: () => fetchPlaylistDetail(id ?? '', storefront),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}
