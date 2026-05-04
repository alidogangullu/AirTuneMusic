import { createMMKV } from 'react-native-mmkv';
import i18next from 'i18next';
import { QuotaPeriodService } from './quotaPeriodService';

const storage = createMMKV({ id: 'quota-storage' });

const KEYS = {
  PLAY_COUNT: 'play_count',
  IS_PRO: 'is_pro',
};

const DEFAULT_LIMIT = 10;

export class QuotaService {
  static readonly HOURLY_LIMIT = DEFAULT_LIMIT;

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
    return this._getCount() < DEFAULT_LIMIT;
  }

  static recordSongPlay(): void {
    if (this.isProUser()) return;
    const periodStart = QuotaPeriodService.startIfNeeded();
    storage.set('play_count_period', periodStart);
    storage.set(KEYS.PLAY_COUNT, this._getCount() + 1);
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
    if (this.isProUser()) return { used: 0, total: DEFAULT_LIMIT };
    return { used: this._getCount(), total: DEFAULT_LIMIT };
  }
}
