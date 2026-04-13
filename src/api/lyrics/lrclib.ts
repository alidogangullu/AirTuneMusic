export interface LyricsResponse {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string;
  syncedLyrics: string;
}

/**
 * Fetches lyrics from LRCLib using track metadata.
 * LRCLib is a free, community-driven lyrics database that provides synced lyrics in LRC format.
 */
export async function fetchLyrics(
  trackName: string,
  artistName: string,
  albumName: string,
  duration: number
): Promise<LyricsResponse | null> {
  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
      album_name: albumName,
      duration: Math.round(duration / 1000).toString(),
    });

    const response = await fetch(`https://lrclib.net/api/get?${params.toString()}`);

    if (response.status === 404) {
      // Lyrics not found
      return null;
    }

    if (!response.ok) {
      throw new Error(`LRCLib error: ${response.status}`);
    }

    const data: LyricsResponse = await response.json();
    return data;
  } catch (error) {
    console.warn('[LRCLib] Failed to fetch lyrics:', error);
    return null;
  }
}
