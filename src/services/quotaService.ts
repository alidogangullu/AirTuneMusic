import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'quota-storage' });

const KEYS = {
  PLAY_TIMESTAMPS: 'play_timestamps',
  IS_PRO: 'is_pro',
};

const HOURLY_LIMIT = 100; // reduce to 3 songs
const HOUR_MS = 60 * 60 * 1000;

export class QuotaService {
  /**
   * Check if user has active Pro subscription
   */
  static isProUser(): boolean {
    return storage.getBoolean(KEYS.IS_PRO) ?? false;
  }

  /**
   * Set Pro status (for testing or after purchase).
   */
  static setProStatus(isPro: boolean): void {
    storage.set(KEYS.IS_PRO, isPro);
  }

  /**
   * Returns the list of play timestamps within the last hour.
   */
  private static getRecentPlayTimestamps(): number[] {
    const raw = storage.getString(KEYS.PLAY_TIMESTAMPS);
    if (!raw) return [];

    try {
      const timestamps: number[] = JSON.parse(raw);
      const now = Date.now();
      // Filter out timestamps older than 1 hour
      return timestamps.filter(ts => now - ts < HOUR_MS);
    } catch {
      return [];
    }
  }

  /**
   * Validates if the user can play another song.
   */
  static canPlayNextSong(): boolean {
    if (this.isProUser()) return true;

    const recentPlays = this.getRecentPlayTimestamps();
    return recentPlays.length < HOURLY_LIMIT;
  }

  /**
   * Records a new song play.
   */
  static recordSongPlay(): void {
    if (this.isProUser()) return;

    const recentPlays = this.getRecentPlayTimestamps();
    recentPlays.push(Date.now());

    // We only need to keep up to HOURLY_LIMIT timestamps
    const toSave = recentPlays.slice(-HOURLY_LIMIT);
    storage.set(KEYS.PLAY_TIMESTAMPS, JSON.stringify(toSave));
  }

  /**
   * Calculates remaining time until the next play slot opens.
   * Returns milliseconds.
   */
  static getTimeUntilNextSlot(): number {
    if (this.canPlayNextSong()) return 0;

    const recentPlays = this.getRecentPlayTimestamps();
    if (recentPlays.length === 0) return 0;

    // The first play in the rolling window is the one that needs to "expire"
    const oldestPlay = recentPlays[0];
    const now = Date.now();
    const waitTime = HOUR_MS - (now - oldestPlay);

    return Math.max(0, waitTime);
  }

  /**
   * Returns human readable remaining time (e.g., "45 minutes").
   */
  static getRemainingTimeFormatted(): string {
    const ms = this.getTimeUntilNextSlot();
    if (ms <= 0) return 'Available now';

    const minutes = Math.ceil(ms / (60 * 1000));
    if (minutes === 1) return '1 minute';
    return `${minutes} minutes`;
  }

  /**
   * Returns how many slots are used out of the limit.
   */
  static getUsageInfo(): { used: number; total: number } {
    if (this.isProUser()) return { used: 0, total: HOURLY_LIMIT };
    const recentPlays = this.getRecentPlayTimestamps();
    return { used: recentPlays.length, total: HOURLY_LIMIT };
  }
}
