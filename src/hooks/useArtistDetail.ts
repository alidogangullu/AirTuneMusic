import {useQuery} from '@tanstack/react-query';
import {fetchArtistDetail} from '../api/apple-music';

export function useArtistDetail(id: string | null, storefront = 'tr') {
  return useQuery({
    queryKey: ['artist-detail', id, storefront],
    queryFn: () => fetchArtistDetail(id ?? '', storefront),
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}
