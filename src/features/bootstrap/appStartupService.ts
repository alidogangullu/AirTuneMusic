import { loadMusicUserToken } from '../../api/apple-music/musicUserToken';
import { checkAppleMusicSubscription } from './api/subscription';
import { checkAppVersion, VersionCheckResult } from '../../services/versionService';
import { IapService } from '../settings/iapService';
import { ensureConfigured } from '../../services/musicPlayer';

export interface StartupData {
  hasToken: boolean;
  isAppleMusicSubscriber: boolean;
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
    let isAppleMusicSubscriber = true; // Default to true if no token, check after

    if (hasToken) {
      try {
        console.log('[AppStart] Checking Apple Music subscription...');
        isAppleMusicSubscriber = await checkAppleMusicSubscription();
        console.log('[AppStart] Subscription check result:', isAppleMusicSubscriber);
      } catch (e) {
        console.warn('[AppStart] Subscription check failed:', e);
      }
    }

    console.log(`[AppStart] Version status: ${updateInfo.status}, Has token: ${hasToken}, Subscriber: ${isAppleMusicSubscriber}`);

    // 2. Initialize IAP (AirTune Pro)
    try {
      await IapService.init();
      await IapService.checkSubscriptionStatus();
    } catch (e) {
      console.warn('[AppStart] IAP initialization failed:', e);
    }

    // 3. Configure Music Player if token exists
    if (hasToken && isAppleMusicSubscriber) {
      try {
        await ensureConfigured();
      } catch (e) {
        console.warn('[AppStart] MusicPlayer configuration failed:', e);
      }
    }

    return {
      hasToken,
      isAppleMusicSubscriber,
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
