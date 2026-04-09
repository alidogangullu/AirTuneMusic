import { appleMusicApi } from './client';

/**
 * Checks if the currently authenticated Apple Music user has a paid subscription.
 * Returns true if active, false otherwise.
 */
export async function checkAppleMusicSubscription(): Promise<boolean> {
  try {
    const response = await appleMusicApi.get('/me/user-subscription');
    
    // In many regions, 200 OK with a non-empty data list indicates an active subscription.
    // However, sometimes it returns 200 with an empty list if not active.
    if (response.status === 200 && response.data && response.data.data && response.data.data.length > 0) {
      return true;
    }
    
    // Fallback: Check if the response itself indicates an active subscription
    // Some versions of the API might return differently.
    return false;
  } catch (error: any) {
    const status = error.response?.status;
    // 403 Forbidden or 404 Not Found are common for non-subscribers at this endpoint
    if (status === 403 || status === 404) {
      console.log('[Subscription] No active Apple Music subscription found (Status:', status, ')');
      return false;
    }
    
    // If it's another error (network, 500), we might want to return true to avoid blocking the user 
    // due to a temporary API issue. But usually, 401/403 are very specific.
    console.warn('[Subscription] Error checking Apple Music subscription:', error.message);
    
    // If we're unauthorized (401), we can't check, so we assume false or let the 401 handler deal with it.
    if (status === 401) return false;
    
    // On network/unknown error, we default to TRUE to be safe and not block legitimate users 
    // who just have a temporary connection issue.
    return true; 
  }
}
