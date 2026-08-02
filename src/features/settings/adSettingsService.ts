import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'ad-settings' });

const AUTO_START_AD_KEY = 'auto_start_ad';

export const AdSettingsService = {
  getAutoStartAd: (): boolean => storage.getBoolean(AUTO_START_AD_KEY) ?? true,
  setAutoStartAd: (value: boolean): void => storage.set(AUTO_START_AD_KEY, value),
};
