import {useQuery} from '@tanstack/react-query';
import {
  fetchAlbumDetail,
  fetchMusicVideoDetail,
  fetchPlaylistDetail,
  fetchSongDetail,
  fetchStationDetail,
} from '../../recommendations/api/recommendations';
import {
  fetchLibraryAlbumDetail,
  fetchLibraryPlaylistDetail,
} from '../../library/api/library';
import type {ContentDetailResponse} from '../../../types/catalog';
import type {RecommendationContentType} from '../../../types/recommendations';
import {useStorefront} from '../../../hooks/useStorefront';

/** Library IDs start with p. (playlists) or l. (albums/songs). */
function isLibraryId(id: string): boolean {
  return id.startsWith('p.') || id.startsWith('l.') || id.startsWith('i.');
}

export function useContentDetail(
  id: string | null,
  type: RecommendationContentType | null,
) {
  const {storefrontId} = useStorefront();

  return useQuery({
    queryKey: ['content-detail', type, id, storefrontId],
    queryFn: async (): Promise<ContentDetailResponse> => {
      if (!id || !type) {
        throw new Error('id and type are required');
      }

      const library = isLibraryId(id);

      switch (type) {
        case 'playlists': {
          const r = library
            ? await fetchLibraryPlaylistDetail(id)
            : await fetchPlaylistDetail(id, storefrontId);
          return {data: r.data};
        }
        case 'albums': {
          const r = library
            ? await fetchLibraryAlbumDetail(id)
            : await fetchAlbumDetail(id, storefrontId);
          return {data: r.data};
        }
        case 'stations': {
          const r = await fetchStationDetail(id, storefrontId);
          return {data: r.data};
        }
        case 'songs': {
          const r = await fetchSongDetail(id, storefrontId);
          return {data: r.data};
        }
        case 'music-videos': {
          const r = await fetchMusicVideoDetail(id, storefrontId);
          return {data: r.data};
        }
        default:
          throw new Error(`Unsupported content type: ${String(type)}`);
      }
    },
    enabled: id !== null && type !== null,
    staleTime: 5 * 60 * 1000,
  });
}
