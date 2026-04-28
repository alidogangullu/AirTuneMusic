import { appleMusicApi } from '../../../api/apple-music/client';

/**
 * Checks if the currently authenticated Apple Music user has a paid subscription.
 * Uses /me/recommendations as a proxy: Apple returns 403 Forbidden for non-subscribers.
 * Returns true if active or indeterminate, false ONLY if confirmed inactive.
 */
export async function checkAppleMusicSubscription(): Promise<boolean> {
  try {
    // /me/recommendations requires an active subscription.
    // We use a small limit to minimize data transfer.
    const response = await appleMusicApi.get('/me/recommendations', {
      params: { limit: 1 },
    });

    if (response.status === 200) {
      console.log('[Subscription] Active subscription confirmed via recommendations.');
      return true;
    }

    return true; // Default to true for unknown 2xx status
  } catch (error: any) {
    const status = error.response?.status;

    if (status === 403) {
      console.log('[Subscription] No active Apple Music subscription found (Status: 403 Forbidden)');
      return false;
    }

    // 401 means the token is expired/invalid, not necessarily that there's no subscription.
    // The client interceptor should handle 401s.
    if (status === 401) {
      console.warn('[Subscription] Unauthorized (401). Cannot determine subscription status.');
      return true; // Let them through, the API call that failed will handle re-auth
    }

    // For any other error (including the legacy 404), we default to TRUE.
    // This prevents blocking legitimate subscribers due to API inconsistencies or network issues.
    console.warn(
      `[Subscription] Indeterminate status (Status: ${status}). Defaulting to true. Error:`,
      error.message,
    );
    return true;
  }
}
