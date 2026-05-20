import { NativeModules } from 'react-native';

import { UNITY_ADS_REWARDED_AD_UNIT_ID } from '../config/unityAds';
import { initializeUnityAds } from './unityAds';

const { UnityAdsModule } = NativeModules;

const REQUEST_TIMEOUT_MS = 15000;

export const RewardAdService = {
  async showRewardedAd(adUnitIdOverride?: string): Promise<boolean> {
    const adUnitId = adUnitIdOverride || UNITY_ADS_REWARDED_AD_UNIT_ID;

    if (!adUnitId) {
      throw Object.assign(
        new Error('Unity Ads rewarded ad unit id is missing. Set UNITY_ADS_REWARDED_AD_UNIT_ID in src/config/unityAds.ts.'),
        { code: 'AD_CONFIGURATION_MISSING' },
      );
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
            let code = 'AD_DISPLAY_FAILED';
            if (nativeCode === 'AD_SKIPPED') code = 'AD_SKIPPED';
            else if (nativeCode === 'LOAD_FAILED') code = 'AD_LOAD_FAILED';
            reject(Object.assign(new Error(error.message || 'Ad failed.'), { code }));
          }
        });
    });
  },
};
