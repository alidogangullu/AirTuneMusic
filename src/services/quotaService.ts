import { createMMKV } from 'react-native-mmkv';
import i18next from 'i18next';
import { QuotaPeriodService } from './quotaPeriodService';
import { QuotaConfigService } from './quotaConfigService';

const storage = createMMKV({ id: 'quota-storage' });

const KEYS = {
  PLAY_COUNT: 'play_count',
  IS_PRO: 'is_pro',
  BONUS_PLAYS: 'bonus_plays',
};

const DEFAULT_BONUS_PLAYS = 3;

export class QuotaService {
  static get HOURLY_LIMIT(): number {
    return QuotaConfigService.getConfig().track_limit;
  }

  static readonly BONUS_PLAYS_PER_AD = DEFAULT_BONUS_PLAYS;

  static isProUser(): boolean {
    return storage.getBoolean(KEYS.IS_PRO) ?? false;
  }

  static setProStatus(isPro: boolean): void {
    storage.set(KEYS.IS_PRO, isPro);
    if (isPro) QuotaPeriodService.reset();
  }

  static getBonusPlaysRemaining(): number {
    return storage.getNumber(KEYS.BONUS_PLAYS) ?? 0;
  }

  static addBonusPlays(count: number = this.BONUS_PLAYS_PER_AD): void {
    if (this.isProUser() || count <= 0) return;

    const current = this.getBonusPlaysRemaining();
    storage.set(KEYS.BONUS_PLAYS, current + count);
  }

  private static consumeBonusPlay(): boolean {
    const current = this.getBonusPlaysRemaining();
    if (current <= 0) return false;

    storage.set(KEYS.BONUS_PLAYS, current - 1);
    return true;
  }

  private static _getCount(): number {
    const periodStart = QuotaPeriodService.getActivePeriodStart();
    if (periodStart === null) return 0;
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

    const count = this._getCount();
    const canPlay = count < this.HOURLY_LIMIT || this.getBonusPlaysRemaining() > 0;
    console.log(
      `[QuotaService] canPlayNextSong: ${count}/${this.HOURLY_LIMIT} +bonus:${this.getBonusPlaysRemaining()} -> ${canPlay}`,
    );
    return canPlay;
  }

  static recordSongPlay(): void {
    if (this.isProUser()) return;

    const periodStart = QuotaPeriodService.startIfNeeded();
    const currentCount = this._getCount();

    if (currentCount >= this.HOURLY_LIMIT) {
      this.consumeBonusPlay();
      return;
    }

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
