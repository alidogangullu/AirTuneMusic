import { NativeModules } from 'react-native';

type RewardedAdNativeModule = {
  showRewardedAd: (adUnitIdOverride?: string) => Promise<boolean>;
};

const rewardedAdModule = NativeModules.RewardedAdModule as RewardedAdNativeModule | undefined;

export const RewardAdService = {
  async showRewardedAd(adUnitIdOverride?: string): Promise<boolean> {
    if (!rewardedAdModule || typeof rewardedAdModule.showRewardedAd !== 'function') {
      throw new Error('Rewarded ad module is not available on this build.');
    }

    return rewardedAdModule.showRewardedAd(adUnitIdOverride);
  },
};