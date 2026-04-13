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
 * Cleans song titles and artist names by removing common suffixes like "(feat. ...)", "- Single", etc.
 */
function cleanText(text: string): string {
  return text
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/\(with.*?\)/gi, '')
    .replace(/- Single/gi, '')
    .replace(/- Remastered/gi, '')
    .replace(/- [0-9]{4} Remaster/gi, '')
    .replace(/- EP/gi, '')
    .replace(/\s\s+/g, ' ')
    .trim();
}

/**
 * Fetches lyrics from LRCLib using multiple strategies to maximize hit rate.
 */
export async function fetchLyrics(
  trackName: string,
  artistName: string,
  albumName: string,
  duration: number
): Promise<LyricsResponse | null> {
  const durationSec = Math.round(duration / 1000);

  // Strategy 1: Strict /api/get (Exact Metadata)
  const strictParams = new URLSearchParams({
    track_name: trackName,
    artist_name: artistName,
    album_name: albumName,
    duration: durationSec.toString(),
  });
  
  try {
    const res = await fetch(`https://lrclib.net/api/get?${strictParams.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) return data;
    }
  } catch (e) { /* ignore */ }

  // Strategy 2: Cleaned /api/get (Metadata Clutter Removal)
  const cleanedTrack = cleanText(trackName);
  const cleanedArtist = cleanText(artistName);
  
  if (cleanedTrack !== trackName || cleanedArtist !== artistName) {
    const cleanedParams = new URLSearchParams({
      track_name: cleanedTrack,
      artist_name: cleanedArtist,
      duration: durationSec.toString(),
    });
    
    try {
      const res = await fetch(`https://lrclib.net/api/get?${cleanedParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics) return data;
      }
    } catch (e) { /* ignore */ }
  }

  // Strategy 3: Fuzzy Search Fallback
  try {
    const query = encodeURIComponent(`${cleanedArtist} ${cleanedTrack}`);
    const searchRes = await fetch(`https://lrclib.net/api/search?q=${query}`);
    
    if (searchRes.ok) {
      const results: LyricsResponse[] = await searchRes.json();
      
      // Find the best candidate:
      // Must have synced lyrics and duration within 10 seconds of original
      const bestMatch = results.find(result => {
        const hasSynced = !!result.syncedLyrics;
        const durationDiff = Math.abs(result.duration - durationSec);
        return hasSynced && durationDiff <= 10;
      });
      
      if (bestMatch) {
        return bestMatch;
      }
    }
  } catch (error) {
    console.warn('[LRCLib] Search fallback failed:', error);
  }

  return null;
}
