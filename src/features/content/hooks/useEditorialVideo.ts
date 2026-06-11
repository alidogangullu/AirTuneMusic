import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {
  fetchEditorialVideo,
  getMotionArtworkUrl,
} from '../../../api/apple-music/ampMotionArtwork';
import {useStorefront} from './useStorefront';

type MotionContentType = 'playlists' | 'albums' | 'stations';

/**
 * Lazily fetches the motion artwork (editorialVideo) for a playlist/album and
 * returns the square looping HLS URL. Intended to be enabled only once a card
 * has settled in focus, so we never fetch for items the user just scrolls past.
 */
export function useEditorialVideo(
  type: MotionContentType,
  id: string,
  enabled: boolean,
) {
  const {storefrontId} = useStorefront();
  // Motion artwork is localized; refetch when the UI language changes.
  const {i18n} = useTranslation();

  const query = useQuery({
    queryKey: ['editorial-video', type, id, storefrontId, i18n.language],
    queryFn: () => fetchEditorialVideo(type, id, storefrontId),
    enabled: enabled && !!id,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  return {
    ...query,
    motionUrl: getMotionArtworkUrl(query.data),
  };
}
