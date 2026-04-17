import {
  LevelPlayRewardedAd,
  type LevelPlayAdError,
  type LevelPlayAdInfo,
  type LevelPlayReward,
  type LevelPlayRewardedAdListener,
} from 'unity-levelplay-mediation';

import {
  LEVELPLAY_REWARDED_AD_UNIT_ID,
  LEVELPLAY_REWARDED_PLACEMENT_NAME,
} from '../config/levelPlay';
import { initializeLevelPlay } from './levelPlay';

const REQUEST_TIMEOUT_MS = 15000;
const REWARD_GRACE_MS = 2000;

export const RewardAdService = {
  async showRewardedAd(adUnitIdOverride?: string): Promise<boolean> {
    const adUnitId = adUnitIdOverride || LEVELPLAY_REWARDED_AD_UNIT_ID;

    if (!adUnitId) {
      const error = new Error('LevelPlay rewarded ad unit id is missing. Add it to app.json.');
      const configuredError = Object.assign(error, { code: 'AD_CONFIGURATION_MISSING' });
      throw configuredError;
    }

    await initializeLevelPlay();

    const rewardedAd = new LevelPlayRewardedAd(adUnitId);

    return new Promise<boolean>((resolve, reject) => {
      let settled = false;
      let rewardGranted = false;
      let closed = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      let rewardGraceTimer: ReturnType<typeof setTimeout> | null = null;
      const placementName = LEVELPLAY_REWARDED_PLACEMENT_NAME || null;

      const rejectWithCode = (code: string, message: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        const err = Object.assign(new Error(message), { code });
        reject(err);
      };

      const resolveSuccess = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(true);
      };

      const rejectSkipped = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(Object.assign(new Error('Ad was not fully watched.'), { code: 'AD_SKIPPED' }));
      };

      const maybeResolveAfterReward = () => {
        if (settled || !closed || !rewardGranted) {
          return;
        }

        resolveSuccess();
      };

      const listener: LevelPlayRewardedAdListener = {
        onAdLoaded: () => {
          rewardedAd
            .isAdReady()
            .then(isReady => {
              if (!isReady) {
                rejectWithCode('AD_NOT_READY', 'Rewarded ad is not ready yet.');
                return;
              }

              return rewardedAd.showAd(placementName);
            })
            .catch((error: unknown) => {
              const message = error instanceof Error ? error.message : 'Ad failed to show.';
              rejectWithCode('AD_DISPLAY_FAILED', message);
            });
        },
        onAdLoadFailed: (error: LevelPlayAdError) => {
          rejectWithCode('AD_LOAD_FAILED', error.errorMessage || 'Ad failed to load.');
        },
        onAdDisplayed: (_adInfo: LevelPlayAdInfo) => {
          // No-op
        },
        onAdDisplayFailed: (error: LevelPlayAdError) => {
          rejectWithCode('AD_DISPLAY_FAILED', error.errorMessage || 'Ad failed to show.');
        },
        onAdClicked: (_adInfo: LevelPlayAdInfo) => {
          // No-op
        },
        onAdClosed: (_adInfo: LevelPlayAdInfo) => {
          closed = true;

          if (rewardGranted) {
            resolveSuccess();
            return;
          }

          if (rewardGraceTimer) {
            clearTimeout(rewardGraceTimer);
          }

          rewardGraceTimer = setTimeout(() => {
            if (!rewardGranted) {
              rejectSkipped();
            }
          }, REWARD_GRACE_MS);
        },
        onAdRewarded: (_reward: LevelPlayReward) => {
          rewardGranted = true;
          maybeResolveAfterReward();
        },
        onAdInfoChanged: (_adInfo: LevelPlayAdInfo) => {
          // No-op
        },
      };

      rewardedAd.setListener(listener);

      const cleanup = () => {
        rewardedAd.remove().catch(() => {});
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        if (rewardGraceTimer) {
          clearTimeout(rewardGraceTimer);
          rewardGraceTimer = null;
        }
      };

      timeout = setTimeout(() => {
        rejectWithCode('AD_TIMEOUT', 'Rewarded ad timed out. Please try again.');
      }, REQUEST_TIMEOUT_MS);

      rewardedAd.loadAd().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Ad failed to load.';
        rejectWithCode('AD_LOAD_FAILED', message);
      });
    });
  },
};