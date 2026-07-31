import { useEffect } from 'react';
import { Linking } from 'react-native';
import { usePlayer } from '../features/player/hooks/usePlayer';

/**
 * Safely parse query parameters from a deep link URI without relying on URLSearchParams DOM types.
 */
function parseDeepLinkParams(url: string): { type: string; id: string | null } {
  let type = 'songs';
  let id: string | null = null;

  const typeMatch = url.match(/[?&]type=([^&]+)/);
  const idMatch = url.match(/[?&]id=([^&]+)/);

  if (typeMatch) {
    type = decodeURIComponent(typeMatch[1]);
  }
  if (idMatch) {
    id = decodeURIComponent(idMatch[1]);
  }

  return { type, id };
}

export function useDeepLinkHandler(onDeepLinkTriggered?: (type: string, id: string) => void) {
  const { playSong, playPlaylist, playAlbum, playStation, playMusicVideo } = usePlayer();

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url || !url.startsWith('airtune://')) return;

      try {
        if (url.includes('play')) {
          const { type, id } = parseDeepLinkParams(url);

          if (!id) return;

          console.log(`[DeepLink] Launching playback - Type: ${type}, ID: ${id}`);

          if (type.includes('playlist')) {
            playPlaylist(id);
          } else if (type.includes('album')) {
            playAlbum(id);
          } else if (type.includes('station')) {
            playStation(id);
          } else if (type.includes('music-video')) {
            playMusicVideo(id);
          } else {
            playSong(id);
          }

          if (onDeepLinkTriggered) {
            onDeepLinkTriggered(type, id);
          }
        }
      } catch (err) {
        console.error('[DeepLink] Error handling URL:', url, err);
      }
    };

    // Handle initial app launch via deep link
    Linking.getInitialURL().then(handleUrl).catch(err => {
      console.error('[DeepLink] Failed to get initial URL:', err);
    });

    // Handle subsequent deep links while app is already open
    const sub = Linking.addEventListener('url', event => {
      handleUrl(event.url);
    });

    return () => {
      sub.remove();
    };
  }, [playSong, playPlaylist, playAlbum, playStation, playMusicVideo, onDeepLinkTriggered]);
}
