import { CURRENT_VERSION } from '../../../constants/versionInfo';

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
    .replaceAll(/\(feat\..*?\)/gi, '')
    .replaceAll(/\[feat\..*?\]/gi, '')
    .replaceAll(/\(with.*?\)/gi, '')
    .replaceAll(/\[with.*?\]/gi, '')
    .replaceAll(/\(remastered.*?\)/gi, '')
    .replaceAll(/\[remastered.*?\]/gi, '')
    .replaceAll(/\(deluxe.*?\)/gi, '')
    .replaceAll(/\[deluxe.*?\]/gi, '')
    .replaceAll(/\(explicit.*?\)/gi, '')
    .replaceAll(/\[explicit.*?\]/gi, '')
    .replaceAll(/\(live.*?\)/gi, '')
    .replaceAll(/\[live.*?\]/gi, '')
    .replaceAll(/- Single/gi, '')
    .replaceAll(/- Remastered/gi, '')
    .replaceAll(/- \d{4} Remaster/gi, '')
    .replaceAll(/- EP/gi, '')
    .replaceAll(/\s\s+/g, ' ')
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
  const durationSec = Math.round((duration || 0) / 1000);
  console.log(`[LRCLib] Fetching lyrics for: "${trackName}" by "${artistName}" (duration: ${durationSec}s)`);

  // Strategy 1: Strict /api/get (Exact Metadata)
  const strictParams = new URLSearchParams({
    track_name: trackName,
    artist_name: artistName,
    album_name: albumName,
    ...(durationSec > 0 ? { duration: durationSec.toString() } : {}),
  });
  
  const fetchHeaders = {
    'User-Agent': `AirTune/${CURRENT_VERSION} (https://github.com/alidogangullu/AirTuneMusic)`,
    'Lrclib-Client': `AirTune/${CURRENT_VERSION}`,
  };

  try {
    const res = await fetch(`https://lrclib.net/api/get?${strictParams.toString()}`, { headers: fetchHeaders });
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        console.log('[LRCLib] Strategy 1 success: Synced');
        return data;
      }
    } else {
      console.log('[LRCLib] Strategy 1 response status:', res.status);
    }
  } catch (e) {
    console.warn('[LRCLib] Strategy 1 fetch error:', e);
  }

  // Strategy 2: Cleaned /api/get (Metadata Clutter Removal)
  const cleanedTrack = cleanText(trackName);
  const cleanedArtist = cleanText(artistName);
  console.log(`[LRCLib] Trying Strategy 2 with cleaned names: "${cleanedTrack}" by "${cleanedArtist}"`);
  
  const cleanedParams = new URLSearchParams({
    track_name: cleanedTrack,
    artist_name: cleanedArtist,
  });
  
  try {
    const res = await fetch(`https://lrclib.net/api/get?${cleanedParams.toString()}`, { headers: fetchHeaders });
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        console.log('[LRCLib] Strategy 2 success: Synced');
        return data;
      }
    } else {
      console.log('[LRCLib] Strategy 2 response status:', res.status);
    }
  } catch (e) {
    console.warn('[LRCLib] Strategy 2 fetch error:', e);
  }

  // Strategy 3: Fuzzy Search Fallback
  try {
    const query = encodeURIComponent(`${cleanedArtist} ${cleanedTrack}`);
    console.log(`[LRCLib] Trying Strategy 3 fuzzy search query: "${cleanedArtist} ${cleanedTrack}"`);
    const searchRes = await fetch(`https://lrclib.net/api/search?q=${query}`, { headers: fetchHeaders });
    
    if (searchRes.ok) {
      const results: LyricsResponse[] = await searchRes.json();
      console.log(`[LRCLib] Strategy 3 search returned ${results.length} candidate(s)`);
      
      // Find best synced lyrics match within 15 seconds
      const bestSynced = results.find(result => {
        const hasSynced = !!result.syncedLyrics;
        const durationDiff = durationSec > 0 ? Math.abs(result.duration - durationSec) : 0;
        return hasSynced && (durationSec === 0 || durationDiff <= 15);
      });
      
      if (bestSynced) {
        console.log('[LRCLib] Strategy 3 matched synced lyrics:', bestSynced.trackName);
        return bestSynced;
      }
    } else {
      console.log('[LRCLib] Strategy 3 search status:', searchRes.status);
    }
  } catch (error) {
    console.warn('[LRCLib] Search fallback failed:', error);
  }

  console.log('[LRCLib] No synced lyrics found for track.');
  return null;
}
