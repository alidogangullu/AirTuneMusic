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

const noop = () => {};

interface AdStateContext {
  settled: boolean;
  timeout: any;
  resolve: (value: boolean) => void;
  reject: (reason: any) => void;
  adUnitIdOverride?: string;
}

function handleAdShow(ad: RewardedAd, ctx: AdStateContext) {
  if (ctx.settled) return;

  let rewardEarned = false;

  ad.onRewarded = () => {
    rewardEarned = true;
  };

  ad.onAdDismissed = () => {
    if (!ctx.settled) {
      ctx.settled = true;
      if (ctx.timeout) {
        clearTimeout(ctx.timeout);
      }
      // Trigger next preload silently
      RewardAdService.preloadRewardedAd(ctx.adUnitIdOverride).catch(noop);

      if (rewardEarned) {
        ctx.resolve(true);
      } else {
        ctx.reject(Object.assign(new Error('Ad was skipped.'), { code: 'AD_SKIPPED' }));
      }
    }
  };

  ad.onAdFailedToShow = (error?: AdError) => {
    if (!ctx.settled) {
      ctx.settled = true;
      if (ctx.timeout) {
        clearTimeout(ctx.timeout);
      }
      const msg = error?.description || 'Ad failed to show.';
      ctx.reject(Object.assign(new Error(msg), { code: 'AD_SHOW_FAILED' }));
    }
  };

  ad.show().catch((error: any) => {
    if (!ctx.settled) {
      ctx.settled = true;
      if (ctx.timeout) {
        clearTimeout(ctx.timeout);
      }
      const msg = error?.description || error?.message || 'Ad failed to show.';
      ctx.reject(Object.assign(new Error(msg), { code: 'AD_SHOW_FAILED' }));
    }
  });
}

export const RewardAdService = {
  cachedAd: null as RewardedAd | null,
  preloadPromise: null as Promise<void> | null,

  preloadRewardedAd(adUnitIdOverride?: string): Promise<void> {
    const adUnitId = adUnitIdOverride || YANDEX_ADS_REWARDED_AD_UNIT_ID;

    if (!adUnitId || (__DEV__ && devAdSimulate.value !== null)) {
      return Promise.resolve();
    }

    if (this.cachedAd !== null) {
      return Promise.resolve();
    }

    if (this.preloadPromise !== null) {
      return this.preloadPromise;
    }

    this.preloadPromise = (async () => {
      try {
        await initializeYandexAds();
        const loader = await RewardedAdLoader.create();
        const ad = await loader.loadAd({ adUnitId });
        this.cachedAd = ad;
      } catch (error) {
        console.error('[RewardAdService] Preload failed:', error);
      } finally {
        this.preloadPromise = null;
      }
    })();

    return this.preloadPromise;
  },

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

    return new Promise<boolean>((resolve, reject) => {
      const ctx: AdStateContext = {
        settled: false,
        timeout: null,
        resolve,
        reject,
        adUnitIdOverride,
      };

      ctx.timeout = setTimeout(() => {
        if (!ctx.settled) {
          ctx.settled = true;
          this.cachedAd = null;
          reject(Object.assign(new Error('Rewarded ad timed out. Please try again.'), { code: 'AD_TIMEOUT' }));
        }
      }, REQUEST_TIMEOUT_MS);

      const run = async () => {
        try {
          await initializeYandexAds();
          if (this.preloadPromise) {
            await this.preloadPromise;
          }
          if (ctx.settled) return;

          let ad = this.cachedAd;
          if (ad) {
            this.cachedAd = null;
          } else {
            // Fallback if cache is empty
            const loader = await RewardedAdLoader.create();
            ad = await loader.loadAd({ adUnitId });
          }
          handleAdShow(ad, ctx);
        } catch (error: any) {
          if (!ctx.settled) {
            ctx.settled = true;
            if (ctx.timeout) {
              clearTimeout(ctx.timeout);
            }
            const msg = error?.description || error?.message || 'Ad failed to load.';
            reject(Object.assign(new Error(msg), { code: 'AD_LOAD_FAILED' }));
          }
        }
      };

      run();
    });
  },
};
