/**
 * Store for the Music User Token (from Apple Music sign-in).
 * Persisted with MMKV so the user stays signed in until token expiry or sign out.
 */

import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'music-user-token' });
const STORAGE_KEY = '@AirTuneMusic/music_user_token';

let musicUserToken: string | null = null;
let isInitialized = false;
let initPromise: Promise<string | null> | null = null;

export function getMusicUserToken(): string | null {
  return musicUserToken;
}

export function isTokenReady(): boolean {
  return isInitialized;
}

export async function waitForToken(): Promise<string | null> {
  if (isInitialized) return musicUserToken;
  if (initPromise) return initPromise;
  return loadMusicUserToken();
}

export function setMusicUserToken(token: string | null): void {
  musicUserToken = token;
  isInitialized = true; // Mark as initialized so waitForToken doesn't reload
  if (token) {
    storage.set(STORAGE_KEY, token);
  } else {
    storage.remove(STORAGE_KEY);
  }
}

export function clearMusicUserToken(): void {
  musicUserToken = null;
  isInitialized = false;
  initPromise = null;
  storage.remove(STORAGE_KEY);
}

/**
 * Loads the token from storage and sets it in memory. Call on app launch.
 * @returns The token if found, null otherwise.
 */
export async function loadMusicUserToken(): Promise<string | null> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const stored = storage.getString(STORAGE_KEY);
      if (stored) {
        musicUserToken = stored;
      }
    } catch {
      // ignore
    } finally {
      isInitialized = true;
    }
    return musicUserToken;
  })();

  return initPromise;
}
