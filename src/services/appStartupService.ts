import { loadMusicUserToken } from '../api/apple-music';
import { checkAppVersion, VersionCheckResult } from './versionService';
import { IapService } from './iapService';
import { ensureConfigured } from './musicPlayer';

export interface StartupData {
  hasToken: boolean;
  updateInfo: VersionCheckResult;
}

export const AppStartupService = {
  /**
   * Runs all startup activities in parallel and returns the results.
   */
  async init(): Promise<StartupData> {
    console.log('[AppStart] Starting initialization...');
    
    // 1. Version check and Token check in parallel
    const [updateInfo, token] = await Promise.all([
      checkAppVersion(),
      loadMusicUserToken(),
    ]);

    const hasToken = token !== null && token.length > 0;
    console.log(`[AppStart] Version status: ${updateInfo.status}, Has token: ${hasToken}`);

    // 2. Initialize IAP
    try {
      await IapService.init();
      await IapService.checkSubscriptionStatus();
    } catch (e) {
      console.warn('[AppStart] IAP initialization failed:', e);
    }

    // 3. Configure Music Player if token exists
    if (hasToken) {
      try {
        await ensureConfigured();
      } catch (e) {
        console.warn('[AppStart] MusicPlayer configuration failed:', e);
      }
    }

    return {
      hasToken,
      updateInfo,
    };
  },

  /**
   * Cleanup startup-related resources
   */
  destroy(): void {
    IapService.end();
  }
};
