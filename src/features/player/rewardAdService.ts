import { RewardedAd, RewardedAdLoader } from 'yandex-mobile-ads';
import { initializeYandexAds } from '../bootstrap/yandexAds';

export const YANDEX_ADS_REWARDED_AD_UNIT_ID = 'R-M-19683858-1';

type AdError = {
  description: string;
  code?: string;
  adUnitId?: string;
};

// Load + full video playback + end card can exceed 15s easily — use a generous timeout.
const REQUEST_TIMEOUT_MS = 300000;

// DEV ONLY — set to simulate ad outcomes without a real network ad.
// 'success' | 'LOAD_FAILED' | 'AD_SKIPPED' | null (null = real ad)
export const devAdSimulate = { value: null as 'success' | 'LOAD_FAILED' | 'AD_SKIPPED' | 'NO_ACTIVITY' | 'SHOW_FAILED' | null };

export const RewardAdService = {
  async showRewardedAd(adUnitIdOverride?: string): Promise<boolean> {
    const adUnitId = adUnitIdOverride || YANDEX_ADS_REWARDED_AD_UNIT_ID;

    if (!adUnitId) {
      throw Object.assign(
        new Error('Yandex Ads rewarded ad unit id is missing.'),
        { code: 'AD_CONFIGURATION_MISSING' },
      );
    }

    if (__DEV__ && devAdSimulate.value !== null) {
      const sim = devAdSimulate.value;
      await new Promise<void>(r => setTimeout(r, 800));
      if (sim === 'success') return true;
      throw Object.assign(new Error(`[DEV] Simulated ad result: ${sim}`), { code: sim });
    }

    await initializeYandexAds();

    return new Promise<boolean>(async (resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(Object.assign(new Error('Rewarded ad timed out. Please try again.'), { code: 'AD_TIMEOUT' }));
        }
      }, REQUEST_TIMEOUT_MS);

      try {
        const loader = await RewardedAdLoader.create();
        const ad = await loader.loadAd({ adUnitId });

        let rewardEarned = false;

        ad.onRewarded = () => {
          rewardEarned = true;
        };

        ad.onAdDismissed = () => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            if (rewardEarned) {
              resolve(true);
            } else {
              reject(Object.assign(new Error('Ad was skipped.'), { code: 'AD_SKIPPED' }));
            }
          }
        };

        ad.onAdFailedToShow = (error?: AdError) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            const msg = error?.description || 'Ad failed to show.';
            reject(Object.assign(new Error(msg), { code: 'AD_SHOW_FAILED' }));
          }
        };

        await ad.show();
      } catch (error: any) {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          const msg = error?.description || error?.message || 'Ad failed to load.';
          reject(Object.assign(new Error(msg), { code: 'AD_LOAD_FAILED' }));
        }
      }
    });
  },
};
