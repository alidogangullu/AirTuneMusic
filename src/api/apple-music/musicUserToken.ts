/**
 * Store for the Music User Token (from Apple Music sign-in).
 * Persisted with MMKV so the user stays signed in until token expiry or sign out.
 */

import { useSyncExternalStore } from 'react';

import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'music-user-token' });
const STORAGE_KEY = '@AirTuneMusic/music_user_token';

let musicUserToken: string | null = null;
let isInitialized = false;
let initPromise: Promise<string | null> | null = null;
const { MusicPlayer } = require('react-native').NativeModules;

let listeners: Array<() => void> = [];

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeMusicUserToken(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

export function useMusicUserToken(): string | null {
  return useSyncExternalStore(subscribeMusicUserToken, getMusicUserToken);
}

export function getMusicUserToken(): string | null {
  return musicUserToken;
}

export function isTokenReady(): boolean {
  return isInitialized;
}

export async function waitForToken(): Promise<string | null> {
  if (isInitialized) return musicUserToken;
  return loadMusicUserToken();
}

export function setMusicUserToken(token: string | null): void {
  musicUserToken = token;
  isInitialized = true; // Mark as initialized so waitForToken doesn't reload
  initPromise = Promise.resolve(token); // UPDATE CASHED PROMISE!
  emitChange();
  if (token) {
    storage.set(STORAGE_KEY, token);
    if (MusicPlayer?.saveUserToken) {
      MusicPlayer.saveUserToken(token).catch(() => {});
    }
  } else {
    storage.remove(STORAGE_KEY);
    if (MusicPlayer?.clearUserToken) {
      MusicPlayer.clearUserToken().catch(() => {});
    }
  }
}

export function clearMusicUserToken(): void {
  musicUserToken = null;
  isInitialized = false;
  initPromise = null;
  storage.remove(STORAGE_KEY);
  emitChange();
  if (MusicPlayer?.clearUserToken) {
    MusicPlayer.clearUserToken().catch(() => {});
  }
}

/**
 * Loads the token from storage and sets it in memory. Call on app launch.
 * @returns The token if found, null otherwise.
 */
export async function loadMusicUserToken(): Promise<string | null> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let stored: string | null | undefined = storage.getString(STORAGE_KEY);

      // Fallback: If MMKV lost the token but it was committed to Native SharedPreferences, restore it
      if (!stored && MusicPlayer?.getUserToken) {
        try {
          stored = await MusicPlayer.getUserToken();
          if (stored) {
            storage.set(STORAGE_KEY, stored); // Restore to MMKV
          }
        } catch {
          // ignore
        }
      }

      if (stored) {
        musicUserToken = stored;
        emitChange();
      }
    } catch {
      // ignore
    } finally {
      isInitialized = true;
    }
    return musicUserToken || null;
  })();

  return initPromise;
}
