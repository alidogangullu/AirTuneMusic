import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'motion-artwork-settings' });

const ENABLED_KEY = 'motion_artwork_enabled';

/**
 * User preference for animated (motion) playlist/album covers.
 * Defaults to enabled; can be turned off in Settings → App Preferences.
 */
export const MotionArtworkService = {
  getEnabled: (): boolean => storage.getBoolean(ENABLED_KEY) ?? true,
  setEnabled: (value: boolean): void => storage.set(ENABLED_KEY, value),
};
