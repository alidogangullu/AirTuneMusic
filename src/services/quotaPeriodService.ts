import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'quota-period-storage' });

const KEYS = {
  PERIOD_START: 'quota_period_start',
};

export const PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours

export class QuotaPeriodService {
  /**
   * Returns the active period start timestamp, or null if no period has started yet
   * (i.e. no usage has been recorded). Call startIfNeeded() before recording usage.
   */
  static getActivePeriodStart(): number | null {
    const stored = storage.getNumber(KEYS.PERIOD_START);
    if (!stored) return null;
    if (Date.now() - stored >= PERIOD_MS) return null; // expired
    return stored;
  }

  /** Starts a new period now if none is active. Call before recording any usage. */
  static startIfNeeded(): number {
    const active = this.getActivePeriodStart();
    if (active !== null) return active;
    const now = Date.now();
    storage.set(KEYS.PERIOD_START, now);
    return now;
  }

  /** Milliseconds remaining in the current period, 0 if no active period. */
  static getRemainingMs(): number {
    const start = this.getActivePeriodStart();
    if (start === null) return 0;
    return Math.max(0, PERIOD_MS - (Date.now() - start));
  }

  /** Human-readable time remaining, empty string if no active period. */
  static getRemainingFormatted(): string {
    const ms = this.getRemainingMs();
    if (ms <= 0) return '';
    const totalMinutes = Math.ceil(ms / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
  }

  /** Force-reset the period (e.g. after purchase). */
  static reset(): void {
    storage.set(KEYS.PERIOD_START, 0);
  }
}
