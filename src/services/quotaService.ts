import { createMMKV } from 'react-native-mmkv';
import i18next from 'i18next';
import { QuotaPeriodService } from './quotaPeriodService';
import { QuotaConfigService } from './quotaConfigService';

const storage = createMMKV({ id: 'quota-storage' });

const KEYS = {
  PLAY_COUNT: 'play_count',
  IS_PRO: 'is_pro',
};

export class QuotaService {
  static get HOURLY_LIMIT(): number {
    return QuotaConfigService.getConfig().track_limit;
  }

  static isProUser(): boolean {
    return storage.getBoolean(KEYS.IS_PRO) ?? false;
  }

  static setProStatus(isPro: boolean): void {
    storage.set(KEYS.IS_PRO, isPro);
    if (isPro) QuotaPeriodService.reset();
  }

  private static _getCount(): number {
    const periodStart = QuotaPeriodService.getActivePeriodStart();
    if (periodStart === null) return 0; // no usage yet this period
    const storedPeriod = storage.getNumber('play_count_period') ?? 0;
    if (periodStart !== storedPeriod) {
      storage.set('play_count_period', periodStart);
      storage.set(KEYS.PLAY_COUNT, 0);
      return 0;
    }
    return storage.getNumber(KEYS.PLAY_COUNT) ?? 0;
  }

  static canPlayNextSong(): boolean {
    if (this.isProUser()) return true;
    return this._getCount() < this.HOURLY_LIMIT;
  }

  static recordSongPlay(): void {
    if (this.isProUser()) return;
    const periodStart = QuotaPeriodService.startIfNeeded();
    const currentCount = this._getCount(); // read before syncing period to detect resets
    storage.set('play_count_period', periodStart);
    storage.set(KEYS.PLAY_COUNT, currentCount + 1);
  }

  static getTimeUntilNextSlot(): number {
    if (this.canPlayNextSong()) return 0;
    return QuotaPeriodService.getRemainingMs();
  }

  static getRemainingTimeFormatted(): string {
    const ms = this.getTimeUntilNextSlot();
    if (ms <= 0) return i18next.t('common.availableNow');
    return QuotaPeriodService.getRemainingFormatted();
  }

  static getUsageInfo(): { used: number; total: number } {
    if (this.isProUser()) return { used: 0, total: this.HOURLY_LIMIT };
    return { used: this._getCount(), total: this.HOURLY_LIMIT };
  }
}
