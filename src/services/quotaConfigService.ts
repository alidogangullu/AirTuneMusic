import axios from 'axios';
import { createMMKV } from 'react-native-mmkv';
import { VERSION_CHECK_URL } from '../constants/versionInfo';

export interface QuotaConfig {
  period_hours: number;
  track_limit: number;
  airplay_minutes: number;
}

const DEFAULTS: QuotaConfig = {
  period_hours: 6,
  track_limit: 5,
  airplay_minutes: 15,
};

const storage = createMMKV({ id: 'quota-config-storage' });
const CONFIG_KEY = 'quota_config';

function loadCached(): QuotaConfig {
  const raw = storage.getString(CONFIG_KEY);
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as Partial<QuotaConfig>;
    return {
      period_hours: parsed.period_hours ?? DEFAULTS.period_hours,
      track_limit: parsed.track_limit ?? DEFAULTS.track_limit,
      airplay_minutes: parsed.airplay_minutes ?? DEFAULTS.airplay_minutes,
    };
  } catch {
    return DEFAULTS;
  }
}

export const QuotaConfigService = {
  /** Returns cached config (MMKV) synchronously. Falls back to defaults. */
  getConfig(): QuotaConfig {
    return loadCached();
  },

  /** Fetches latest config from Gist and persists to MMKV. */
  async fetchAndUpdate(): Promise<void> {
    try {
      const response = await axios.get<{ quota?: Partial<QuotaConfig> }>(
        `${VERSION_CHECK_URL}?t=${Date.now()}`,
        { timeout: 5000 },
      );
      const quota = response.data.quota;
      if (!quota) return;

      const isValidHours = (v: unknown): v is number => Number.isFinite(v) && (v as number) > 0;
      const isValidCount = (v: unknown): v is number => Number.isFinite(v) && Number.isInteger(v) && (v as number) >= 0;

      const invalid: string[] = [];
      if (!isValidHours(quota.period_hours)) invalid.push('period_hours');
      if (!isValidCount(quota.track_limit)) invalid.push('track_limit');
      if (!isValidCount(quota.airplay_minutes)) invalid.push('airplay_minutes');
      if (invalid.length) console.warn('[QuotaConfig] Invalid fields, using defaults:', invalid);

      const merged: QuotaConfig = {
        period_hours: isValidHours(quota.period_hours) ? quota.period_hours : DEFAULTS.period_hours,
        track_limit: isValidCount(quota.track_limit) ? quota.track_limit : DEFAULTS.track_limit,
        airplay_minutes: isValidCount(quota.airplay_minutes) ? quota.airplay_minutes : DEFAULTS.airplay_minutes,
      };
      storage.set(CONFIG_KEY, JSON.stringify(merged));
      console.log('[QuotaConfig] Updated:', merged);
    } catch (error) {
      console.warn('[QuotaConfig] Fetch failed, using cached/defaults:', error);
    }
  },
};
