import axios from 'axios';
import { CURRENT_VERSION, VERSION_CHECK_URL } from '../constants/versionInfo';

export interface VersionInfo {
  min_version: string;
  latest_version: string;
  store_url: string;
}

export type UpdateStatus = 'up_to_date' | 'optional_update' | 'force_update';

export interface VersionCheckResult {
  status: UpdateStatus;
  storeUrl: string;
  latestVersion: string;
}

/**
 * Compare two semver strings (simple version)
 * @returns 1 if v1 > v2, -1 if v1 < v2, 0 if v1 == v2
 */
const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

export const checkAppVersion = async (): Promise<VersionCheckResult> => {
  try {
    const response = await axios.get<VersionInfo>(VERSION_CHECK_URL, {
      timeout: 5000,
    });
    
    const { min_version, latest_version, store_url } = response.data;
    
    // Check for force update
    if (compareVersions(CURRENT_VERSION, min_version) < 0) {
      return {
        status: 'force_update',
        storeUrl: store_url,
        latestVersion: latest_version,
      };
    }
    
    // Check for optional update
    if (compareVersions(CURRENT_VERSION, latest_version) < 0) {
      return {
        status: 'optional_update',
        storeUrl: store_url,
        latestVersion: latest_version,
      };
    }
    
    return {
      status: 'up_to_date',
      storeUrl: store_url,
      latestVersion: latest_version,
    };
  } catch (error) {
    console.warn('[VersionService] Versiyon kontrolü başarısız:', error);
    // In case of error, assume up to date to not block the user
    return {
      status: 'up_to_date',
      storeUrl: '',
      latestVersion: CURRENT_VERSION,
    };
  }
};
