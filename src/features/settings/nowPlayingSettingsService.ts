import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'now-playing-settings' });

const AUTO_HIDE_CONTROLS_KEY = 'auto_hide_controls_enabled';

/**
 * User preference for auto-hiding playback controls on Now Playing screen when idle.
 * Defaults to enabled (true); can be toggled in Settings → App Preferences.
 */
export const NowPlayingSettingsService = {
  getAutoHideControls: (): boolean => storage.getBoolean(AUTO_HIDE_CONTROLS_KEY) ?? true,
  setAutoHideControls: (value: boolean): void => storage.set(AUTO_HIDE_CONTROLS_KEY, value),
};
