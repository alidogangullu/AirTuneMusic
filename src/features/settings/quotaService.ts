import { createMMKV } from 'react-native-mmkv';
import i18next from 'i18next';
import { QuotaPeriodService } from './quotaPeriodService';
import { QuotaConfigService } from '../bootstrap/quotaConfigService';

const storage = createMMKV({ id: 'quota-storage' });

const KEYS = {
  PLAY_COUNT: 'play_count',
  IS_PRO: 'is_pro',
  BONUS_PLAYS: 'bonus_plays',
  HIDE_QUOTA_INDICATOR: 'hide_quota_indicator',
  NEEDS_CANCEL_SUBSCRIPTION: 'needs_cancel_subscription',
  HAS_LIFETIME: 'has_lifetime',
  ACTIVE_SUB_TOKEN: 'active_sub_token',
  ACTIVE_SUB_SKU: 'active_sub_sku',
  ACTIVE_SUB_AUTO_RENEWING: 'active_sub_auto_renewing',
};

const DEFAULT_BONUS_PLAYS = 2;

export class QuotaService {
  static get HOURLY_LIMIT(): number {
    return QuotaConfigService.getConfig().track_limit;
  }

  static readonly BONUS_PLAYS_PER_AD = DEFAULT_BONUS_PLAYS;

  static isProUser(): boolean {
    return false; // Forced false for testing (will only be restored when requested)
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

  static revokeBonusPlays(count: number = this.BONUS_PLAYS_PER_AD): void {
    if (this.isProUser() || count <= 0) return;

    const current = this.getBonusPlaysRemaining();
    storage.set(KEYS.BONUS_PLAYS, Math.max(0, current - count));
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

  static getPeriodRemainingFormatted(): string {
    const ms = QuotaPeriodService.getRemainingMs();
    if (ms <= 0) return i18next.t('common.availableNow');
    return QuotaPeriodService.getRemainingFormatted();
  }

  static getUsageInfo(): { used: number; total: number } {
    if (this.isProUser()) return { used: 0, total: this.HOURLY_LIMIT };
    return { used: this._getCount(), total: this.HOURLY_LIMIT };
  }

  static isQuotaIndicatorHidden(): boolean {
    return storage.getBoolean(KEYS.HIDE_QUOTA_INDICATOR) ?? false;
  }

  static setQuotaIndicatorHidden(hidden: boolean): void {
    storage.set(KEYS.HIDE_QUOTA_INDICATOR, hidden);
  }

  static needsCancelSubscription(): boolean {
    return storage.getBoolean(KEYS.NEEDS_CANCEL_SUBSCRIPTION) ?? false;
  }

  static setNeedsCancelSubscription(val: boolean): void {
    storage.set(KEYS.NEEDS_CANCEL_SUBSCRIPTION, val);
  }

  static hasLifetimePurchase(): boolean {
    return storage.getBoolean(KEYS.HAS_LIFETIME) ?? false;
  }

  static setHasLifetime(val: boolean): void {
    storage.set(KEYS.HAS_LIFETIME, val);
  }

  static getActiveSubToken(): string | undefined {
    const val = storage.getString(KEYS.ACTIVE_SUB_TOKEN);
    return val || undefined;
  }

  static setActiveSubToken(token: string | undefined): void {
    storage.set(KEYS.ACTIVE_SUB_TOKEN, token ?? '');
  }

  static getActiveSubSku(): string | undefined {
    const val = storage.getString(KEYS.ACTIVE_SUB_SKU);
    return val || undefined;
  }

  static setActiveSubSku(sku: string | undefined): void {
    storage.set(KEYS.ACTIVE_SUB_SKU, sku ?? '');
  }

  static getActiveSubAutoRenewing(): boolean {
    return storage.getBoolean(KEYS.ACTIVE_SUB_AUTO_RENEWING) ?? true;
  }

  static setActiveSubAutoRenewing(val: boolean): void {
    storage.set(KEYS.ACTIVE_SUB_AUTO_RENEWING, val);
  }

}
