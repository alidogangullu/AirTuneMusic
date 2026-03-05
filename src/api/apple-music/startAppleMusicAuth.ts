/**
 * Starts the Apple Music sign-in flow (Android only, via MusicKit for Android).
 * Resolves with the Music User Token on success; use setMusicUserToken to store it.
 * Rejects if not on Android, native module is missing (AAR not added), or user cancels.
 */

import {NativeModules, Platform} from 'react-native';
import {getDeveloperToken} from './getDeveloperToken';
import {setMusicUserToken} from './musicUserToken';

const {AppleMusicAuth} = NativeModules;

/**
 * Launches the Apple Music sign-in UI and returns the Music User Token.
 * On Android: uses MusicKit for Android; the token is also stored via setMusicUserToken.
 * On iOS/tvOS: not implemented; rejects. Use MusicKit for Apple platforms instead.
 */
export async function startAppleMusicAuth(): Promise<string> {
  if (Platform.OS !== 'android') {
    throw new Error(
      'Apple Music user auth is only implemented on Android. On iOS/tvOS use MusicKit.',
    );
  }

  if (!AppleMusicAuth || typeof AppleMusicAuth.startAuth !== 'function') {
    throw new Error(
      'AppleMusicAuth native module not found. Add the MusicKit for Android AAR to android/app/libs/ (see android/app/libs/README.md).',
    );
  }

  const developerToken = await getDeveloperToken();
  const token = await AppleMusicAuth.startAuth(developerToken);
  setMusicUserToken(token);
  return token;
}
