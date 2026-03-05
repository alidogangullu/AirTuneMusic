/**
 * Store for the Music User Token (from Apple Music sign-in).
 * Persisted with MMKV so the user stays signed in until token expiry or sign out.
 */

import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();
const STORAGE_KEY = '@AirTuneMusic/music_user_token';

let musicUserToken: string | null = null;

export function getMusicUserToken(): string | null {
  return musicUserToken;
}

export function setMusicUserToken(token: string | null): void {
  musicUserToken = token;
  if (token) {
    storage.set(STORAGE_KEY, token);
  } else {
    storage.remove(STORAGE_KEY);
  }
}

export function clearMusicUserToken(): void {
  musicUserToken = null;
  storage.remove(STORAGE_KEY);
}

/**
 * Loads the token from storage and sets it in memory. Call on app launch.
 * @returns The token if found, null otherwise.
 */
export async function loadMusicUserToken(): Promise<string | null> {
  try {
    const stored = storage.getString(STORAGE_KEY);
    if (stored) {
      musicUserToken = stored;
      return stored;
    }
  } catch {
    // ignore
  }
  return null;
}
