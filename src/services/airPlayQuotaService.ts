import { createMMKV } from 'react-native-mmkv';
import { QuotaService } from './quotaService';
import { QuotaPeriodService } from './quotaPeriodService';

const storage = createMMKV({ id: 'airplay-quota-storage' });

const KEYS = {
  PLAY_SECONDS: 'airplay_play_seconds',
  PLAY_SECONDS_PERIOD: 'airplay_play_seconds_period',
};

const LIMIT_SECONDS = 15 * 60; // 15 minutes

export class AirPlayQuotaService {
  static readonly HOURLY_LIMIT_SECONDS = LIMIT_SECONDS;

  private static _getSeconds(): number {
    const periodStart = QuotaPeriodService.getActivePeriodStart();
    if (periodStart === null) return 0; // no usage yet this period
    const storedPeriod = storage.getNumber(KEYS.PLAY_SECONDS_PERIOD) ?? 0;
    if (periodStart !== storedPeriod) {
      storage.set(KEYS.PLAY_SECONDS_PERIOD, periodStart);
      storage.set(KEYS.PLAY_SECONDS, 0);
      return 0;
    }
    return storage.getNumber(KEYS.PLAY_SECONDS) ?? 0;
  }

  static canPlay(): boolean {
    if (QuotaService.isProUser()) return true;
    return this._getSeconds() < LIMIT_SECONDS;
  }

  static recordPlaybackSecond(): void {
    if (QuotaService.isProUser()) return;
    const periodStart = QuotaPeriodService.startIfNeeded();
    storage.set(KEYS.PLAY_SECONDS_PERIOD, periodStart);
    storage.set(KEYS.PLAY_SECONDS, this._getSeconds() + 1);
  }

  static getUsedSeconds(): number {
    if (QuotaService.isProUser()) return 0;
    return this._getSeconds();
  }

  static getRemainingMs(): number {
    return Math.max(0, (LIMIT_SECONDS - this.getUsedSeconds()) * 1000);
  }

  static getTimeUntilReset(): number {
    if (this.canPlay()) return 0;
    return QuotaPeriodService.getRemainingMs();
  }

  static getRemainingTimeFormatted(): string {
    const ms = this.getTimeUntilReset();
    if (ms <= 0) return '';
    return QuotaPeriodService.getRemainingFormatted();
  }

  static getUsageInfo(): { used: number; total: number } {
    return { used: this.getUsedSeconds(), total: LIMIT_SECONDS };
  }
}
