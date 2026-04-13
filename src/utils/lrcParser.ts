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

  // Regex to match [mm:ss.xx] or [mm:ss:xx]
  const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const millisecondsStr = match[3];
      
      // Handle 2-digit vs 3-digit milliseconds
      let milliseconds = parseInt(millisecondsStr, 10);
      if (millisecondsStr.length === 2) {
        milliseconds *= 10;
      }

      const totalMs = minutes * 60 * 1000 + seconds * 1000 + milliseconds;
      const text = line.replace(timeRegex, '').trim();

      // We only want lines with actual text (or skip if needed, but usually empty lines are fine for timing)
      result.push({
        time: totalMs,
        text,
      });
    }
  }

  // Sort by time in case the LRC is out of order
  return result.sort((a, b) => a.time - b.time);
}
