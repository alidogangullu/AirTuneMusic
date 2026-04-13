export interface LyricLine {
  time: number; // Time in milliseconds
  text: string;
}

/**
 * Parses LRC formatted string into an array of LyricLine objects.
 * Supported formats:
 * [mm:ss.xx] Lyrics...
 * [mm:ss:xx] Lyrics...
 * [mm:ss.xxx] Lyrics...
 */
export function parseLRC(lrc: string): LyricLine[] {
  if (!lrc) return [];

  const lines = lrc.split('\n');
  const result: LyricLine[] = [];

  // Regex to match [mm:ss.xx] or [mm:ss:xx], added global flag
  const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g;

  for (const line of lines) {
    const matches = Array.from(line.matchAll(timeRegex));
    
    if (matches.length > 0) {
      // The text is what remains after removing all timestamps
      const text = line.replace(timeRegex, '').trim();
      
      for (const match of matches) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const millisecondsStr = match[3];
        
        // Handle 2-digit (centiseconds) vs 3-digit (milliseconds)
        let milliseconds = parseInt(millisecondsStr, 10);
        if (millisecondsStr.length === 2) {
          milliseconds *= 10;
        }

        const totalMs = minutes * 60 * 1000 + seconds * 1000 + milliseconds;
        
        result.push({
          time: totalMs,
          text,
        });
      }
    }
  }

  // Sort by time in case the LRC is out of order
  return result.sort((a, b) => a.time - b.time);
}
