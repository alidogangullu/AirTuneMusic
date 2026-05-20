import { NativeModules } from 'react-native';

import { UNITY_ADS_GAME_ID, UNITY_ADS_TEST_MODE } from '../config/unityAds';

const { UnityAdsModule } = NativeModules;

let initPromise: Promise<void> | null = null;

export async function initializeUnityAds(): Promise<void> {
  if (initPromise !== null) {
    return initPromise;
  }

  if (!UNITY_ADS_GAME_ID) {
    throw new Error('Unity Ads game ID is missing. Set UNITY_ADS_GAME_ID in src/config/unityAds.ts.');
  }

  initPromise = (UnityAdsModule.initialize(UNITY_ADS_GAME_ID, UNITY_ADS_TEST_MODE) as Promise<void>).catch(
    (error: unknown) => {
      initPromise = null;
      throw error;
    },
  );

  return initPromise;
}
