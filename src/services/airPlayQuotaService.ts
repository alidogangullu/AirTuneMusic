import { createMMKV } from 'react-native-mmkv';
import { QuotaService } from './quotaService';
import { QuotaPeriodService } from './quotaPeriodService';
import { QuotaConfigService } from './quotaConfigService';

const storage = createMMKV({ id: 'airplay-quota-storage' });

const KEYS = {
  PLAY_SECONDS: 'airplay_play_seconds',
  PLAY_SECONDS_PERIOD: 'airplay_play_seconds_period',
};

export class AirPlayQuotaService {
  static get HOURLY_LIMIT_SECONDS(): number {
    return QuotaConfigService.getConfig().airplay_minutes * 60;
  }

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
    return this._getSeconds() < this.HOURLY_LIMIT_SECONDS;
  }

  static recordPlaybackSecond(): void {
    if (QuotaService.isProUser()) return;
    const periodStart = QuotaPeriodService.startIfNeeded();
    const currentSeconds = this._getSeconds(); // read before syncing period to detect resets
    storage.set(KEYS.PLAY_SECONDS_PERIOD, periodStart);
    storage.set(KEYS.PLAY_SECONDS, currentSeconds + 1);
  }

  static getUsedSeconds(): number {
    if (QuotaService.isProUser()) return 0;
    return this._getSeconds();
  }

  static getRemainingMs(): number {
    return Math.max(0, (this.HOURLY_LIMIT_SECONDS - this.getUsedSeconds()) * 1000);
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
    return { used: this.getUsedSeconds(), total: this.HOURLY_LIMIT_SECONDS };
  }
}
