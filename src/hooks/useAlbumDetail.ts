import {useQuery} from '@tanstack/react-query';
import {fetchAlbumDetail} from '../api/apple-music';

export function useAlbumDetail(id: string | null, storefront = 'tr') {
  return useQuery({
    queryKey: ['album-detail', id, storefront],
    queryFn: () => fetchAlbumDetail(id ?? '', storefront),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}
