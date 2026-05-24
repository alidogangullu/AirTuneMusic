import { NativeModules } from 'react-native';

import { UNITY_ADS_REWARDED_AD_UNIT_ID } from '../config/unityAds';
import { initializeUnityAds } from './unityAds';

const { UnityAdsModule } = NativeModules;

// Load + full video playback + end card can exceed 15s easily — use a generous timeout.
const REQUEST_TIMEOUT_MS = 300000;

// DEV ONLY — set to simulate ad outcomes without a real network ad.
// 'success' | 'LOAD_FAILED' | 'AD_SKIPPED' | null (null = real ad)
export const devAdSimulate = { value: null as 'success' | 'LOAD_FAILED' | 'AD_SKIPPED' | 'NO_ACTIVITY' | 'SHOW_FAILED' | null };

export const RewardAdService = {
  async showRewardedAd(adUnitIdOverride?: string): Promise<boolean> {
    const adUnitId = adUnitIdOverride || UNITY_ADS_REWARDED_AD_UNIT_ID;

    if (!adUnitId) {
      throw Object.assign(
        new Error('Unity Ads rewarded ad unit id is missing. Set UNITY_ADS_REWARDED_AD_UNIT_ID in src/config/unityAds.ts.'),
        { code: 'AD_CONFIGURATION_MISSING' },
      );
    }

    if (__DEV__ && devAdSimulate.value !== null) {
      const sim = devAdSimulate.value;
      await new Promise<void>(r => setTimeout(r, 800));
      if (sim === 'success') return true;
      throw Object.assign(new Error(`[DEV] Simulated ad result: ${sim}`), { code: sim });
    }

    await initializeUnityAds();

    return new Promise<boolean>((resolve, reject) => {
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(Object.assign(new Error('Rewarded ad timed out. Please try again.'), { code: 'AD_TIMEOUT' }));
        }
      }, REQUEST_TIMEOUT_MS);

      (UnityAdsModule.showRewardedAd(adUnitId) as Promise<boolean>)
        .then((result: boolean) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve(result);
          }
        })
        .catch((error: { code?: string; message?: string }) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            const nativeCode = error.code ?? '';
            const codeMap: Record<string, string> = {
              AD_SKIPPED: 'AD_SKIPPED',
              LOAD_FAILED: 'AD_LOAD_FAILED',
              NO_ACTIVITY: 'AD_NO_ACTIVITY',
              SHOW_FAILED: 'AD_SHOW_FAILED',
            };
            const code = codeMap[nativeCode] ?? 'AD_DISPLAY_FAILED';
            reject(Object.assign(new Error(error.message || 'Ad failed.'), { code }));
          }
        });
    });
  },
};
