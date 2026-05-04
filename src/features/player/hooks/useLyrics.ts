import { useState, useEffect, useMemo } from 'react';
import { usePlayer, usePlaybackProgress } from './usePlayer';
import { fetchLyrics, LyricsResponse } from '../api/lrclib';
import { parseLRC, LyricLine } from '../utils/lrcParser';
import { useAirPlay } from '../../airplay/useAirPlay';

export interface UseLyricsResult {
  lyrics: LyricLine[];
  currentLineIndex: number;
  isLoading: boolean;
  error: string | null;
}

export function useLyrics(enabled: boolean = true): UseLyricsResult {
  const { state } = usePlayer();
  const airPlay = useAirPlay();
  
  // Apple Music takes priority only if actively playing or loading.
  // When AirPlay is active and Apple Music is paused, we use AirPlay data.
  const isAirPlayActive = airPlay.active && (state.playbackState !== 'playing' && !state.isLoading);
  
  const track = isAirPlayActive ? airPlay.track : state.track;
  const { position: nativePosition } = usePlaybackProgress();
  const position = isAirPlayActive ? airPlay.positionMs : nativePosition;

  const shouldFetch = enabled && !!track?.title && !!track?.artistName;
  const [lyricsData, setLyricsData] = useState<LyricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(shouldFetch);
  const [error, setError] = useState<string | null>(null);
  const [prevTrackId, setPrevTrackId] = useState(track?.id);
  const [prevEnabled, setPrevEnabled] = useState(enabled);

  // Sync state during render when track or enabled state changes to prevent flicker
  if (track?.id !== prevTrackId || enabled !== prevEnabled) {
    setPrevTrackId(track?.id);
    setPrevEnabled(enabled);
    setLyricsData(null);
    setError(null);
    setIsLoading(enabled && !!track?.title && !!track?.artistName);
  }

  // Fetch lyrics when track changes or when lyrics are enabled
  useEffect(() => {
    if (!enabled || !track || !track.title || !track.artistName) {
      if (!enabled) setLyricsData(null); // Optional: clear data when disabled to save memory
      setError(null);
      setIsLoading(false);
      return;
    }

    let mounted = true;
    setLyricsData(null); // Clear previous lyrics immediately on track change
    setError(null);
    setIsLoading(true);

    async function loadLyrics() {
      setError(null);
      try {
        const data = await fetchLyrics(
          track!.title!,
          track!.artistName!,
          track!.albumTitle ?? '',
          track!.duration,
        );
        if (mounted) {
          setLyricsData(data);
          if (!data || !data.syncedLyrics) {
            setError('Lyrics not found');
          }
        }
      } catch {
        if (mounted) {
          setError('Failed to load lyrics');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadLyrics();

    return () => {
      mounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- track primitives used intentionally to avoid object reference churn
  }, [track?.id, track?.title, track?.artistName, enabled]);

  // Parse lyrics
  const parsedLyrics = useMemo(() => {
    if (!lyricsData || !lyricsData.syncedLyrics) return [];
    return parseLRC(lyricsData.syncedLyrics);
  }, [lyricsData]);

  // Determine current line index based on position
  const currentLineIndex = useMemo(() => {
    if (parsedLyrics.length === 0) return -1;

    // AirPlay has ~1000ms native delay, so increase offset to compensate
    const SYNC_OFFSET_MS = isAirPlayActive ? 2500 : 500; // Offset to start lyrics slightly earlier
    const adjustedPosition = position + SYNC_OFFSET_MS;

    // Find the last line whose time is <= adjusted position
    let index = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
      if (parsedLyrics[i].time <= adjustedPosition) {
        index = i;
      } else {
        break;
      }
    }
    return index;
  }, [parsedLyrics, position, isAirPlayActive]);

  return {
    lyrics: parsedLyrics,
    currentLineIndex,
    isLoading,
    error,
  };
}
