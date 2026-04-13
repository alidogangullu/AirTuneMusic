import { useState, useEffect, useMemo } from 'react';
import { usePlayer, usePlaybackProgress } from './usePlayer';
import { fetchLyrics, LyricsResponse } from '../api/lyrics/lrclib';
import { parseLRC, LyricLine } from '../utils/lrcParser';

export interface UseLyricsResult {
  lyrics: LyricLine[];
  currentLineIndex: number;
  isLoading: boolean;
  error: string | null;
}

export function useLyrics(enabled: boolean = true): UseLyricsResult {
  const { state } = usePlayer();
  const { track } = state;
  const { position } = usePlaybackProgress();

  const [lyricsData, setLyricsData] = useState<LyricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    async function loadLyrics() {
      setIsLoading(true);
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
      } catch (err) {
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
  }, [track?.id, track?.title, track?.artistName, enabled]);

  // Parse lyrics
  const parsedLyrics = useMemo(() => {
    if (!lyricsData || !lyricsData.syncedLyrics) return [];
    return parseLRC(lyricsData.syncedLyrics);
  }, [lyricsData]);

  // Determine current line index based on position
  const currentLineIndex = useMemo(() => {
    if (parsedLyrics.length === 0) return -1;

    const SYNC_OFFSET_MS = 400; // Offset to start lyrics slightly earlier
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
  }, [parsedLyrics, position]);

  return {
    lyrics: parsedLyrics,
    currentLineIndex,
    isLoading,
    error,
  };
}
