import {NativeModules, NativeEventEmitter, Platform} from 'react-native';
import {getDeveloperToken} from '../api/apple-music/getDeveloperToken';
import {waitForToken, getMusicUserToken, clearMusicUserToken} from '../api/apple-music/musicUserToken';
import * as ratings from '../api/apple-music/ratings';
import {clearRecentSearchesGlobal} from '../hooks/useRecentSearches';

const {MusicPlayer} = NativeModules;

if (!MusicPlayer) {
  console.warn(
    '[musicPlayer] NativeModules.MusicPlayer is undefined — playback will not work.',
  );
}

// On Android, NativeEventEmitter uses DeviceEventEmitter under the hood;
// pass undefined instead of a potentially-null module to avoid bridge issues.
const emitter =
  Platform.OS === 'android' ? new NativeEventEmitter() : null;

// ── Types ───────────────────────────────────────────────────────

export type PlaybackStateName = 'playing' | 'paused' | 'stopped' | 'unknown';

export interface TrackInfo {
  id: string | null;
  title: string | null;
  artistName: string | null;
  albumTitle: string | null;
  artworkUrl: string | null;
  duration: number;
  trackIndex: number;
  playbackQueueId?: number;
  kind?: 'song' | 'musicVideo';
}

export interface PlaybackStateInfo {
  state: PlaybackStateName;
  position: number;
  duration: number;
  shuffleMode: number;
  repeatMode: number;
  queueCount: number;
  queueIndex: number;
  id?: string;
  title?: string;
  artistName?: string;
  albumTitle?: string;
  artworkUrl?: string;
  trackDuration?: number;
}

export interface ProgressInfo {
  position: number;
  duration: number;
  buffered: number;
}

// ── Shuffle / Repeat constants ──────────────────────────────────

export const ShuffleMode = {
  OFF: 0,
  SONGS: 1,
} as const;

export const RepeatMode = {
  NONE: 0,
  ONE: 1,
  ALL: 2,
} as const;

// ── Event listeners ─────────────────────────────────────────────

type EventMap = {
  onPlaybackStateChanged: {state: PlaybackStateName; previousState: PlaybackStateName};
  onCurrentItemChanged: TrackInfo;
  onPlaybackProgress: ProgressInfo;
  onPlaybackError: {message: string};
  onBufferingStateChanged: {buffering: boolean};
  onPlaybackQueueChanged: {count: number};
  onShuffleModeChanged: {shuffleMode: number};
  onRepeatModeChanged: {repeatMode: number};
  onItemEnded: {title: string; endPosition: number};
};

type EventName = keyof EventMap;

export function addEventListener<E extends EventName>(
  event: E,
  handler: (data: EventMap[E]) => void,
) {
  if (!emitter && Platform.OS !== 'web') {
    // On some platforms (like simulation or when module fails), emitter might be null.
    // However, we still want to allow web progress events even if native emitter is missing.
  }
  
  // Create a local emitter for cross-platform/manual events if native is missing or as a secondary
  const sub = emitter ? emitter.addListener(event, handler) : null;
  
  return {
    remove: () => {
      sub?.remove();
    },
  };
}

/**
 * Manually emits playback progress. Used by the Web engine to sync with the same 
 * listeners as the native engine.
 */
export function emitManualPlaybackProgress(data: ProgressInfo) {
  if (Platform.OS === 'android') {
    // DeviceEventEmitter is what NativeEventEmitter uses on Android
    const DeviceEventEmitter = require('react-native').DeviceEventEmitter;
    DeviceEventEmitter.emit('onPlaybackProgress', data);
  }
}

// ── Service methods ─────────────────────────────────────────────

let configured = false;

export async function ensureConfigured(): Promise<void> {
  if (!MusicPlayer) {
    throw new Error('MusicPlayer native module is not available');
  }
  if (configured) {
    return;
  }
  const devToken = await getDeveloperToken();
  const usrToken = (await waitForToken()) ?? '';
  await MusicPlayer.configure(devToken, usrToken);
  configured = true;
}

export async function clearTokens(): Promise<void> {
  if (MusicPlayer) {
    await MusicPlayer.updateTokens('', '');
  }
}

export async function syncTokens(): Promise<void> {
  if (!MusicPlayer) return;
  const devToken = await getDeveloperToken();
  const usrToken = (await waitForToken()) ?? '';
  await MusicPlayer.updateTokens(devToken, usrToken);
}

export async function handleLogout(): Promise<void> {
  try {
    stop();
  } catch (e) {
    console.warn('Failed to stop music during logout:', e);
  }
  clearMusicUserToken();
  clearRecentSearchesGlobal();
  await clearTokens();
  configured = false;
}

export async function playAlbum(
  albumId: string,
  startIndex = 0,
  shuffle = false,
): Promise<void> {
  await ensureConfigured();
  await MusicPlayer.playAlbum(albumId, startIndex, shuffle);
}

export async function playPlaylist(
  playlistId: string,
  startIndex = 0,
  shuffle = false,
): Promise<void> {
  await ensureConfigured();
  await MusicPlayer.playPlaylist(playlistId, startIndex, shuffle);
}

export async function playStation(stationId: string): Promise<void> {
  await ensureConfigured();
  await MusicPlayer.playStation(stationId);
}

export async function playSong(songId: string): Promise<void> {
  await ensureConfigured();
  await MusicPlayer.playSong(songId);
}

export async function playMusicVideo(musicVideoId: string): Promise<void> {
  await ensureConfigured();
  await MusicPlayer.playMusicVideo(musicVideoId);
}

export async function playTracks(
  trackIds: string[],
  startIndex = 0,
  shuffle = false,
): Promise<void> {
  await ensureConfigured();
  await MusicPlayer.playTracks(trackIds, startIndex, shuffle);
}

export function play(): void {
  MusicPlayer?.play();
}

export function pause(): void {
  MusicPlayer?.pause();
}

export function stop(): void {
  MusicPlayer?.stop();
}

export function skipToNext(): void {
  MusicPlayer?.skipToNext();
}

export function skipToPrevious(): void {
  MusicPlayer?.skipToPrevious();
}

export function seekTo(positionMs: number): void {
  MusicPlayer?.seekTo(positionMs);
}

export function setShuffleMode(mode: number): void {
  MusicPlayer?.setShuffleMode(mode);
}

export function setRepeatMode(mode: number): void {
  MusicPlayer?.setRepeatMode(mode);
}

export async function getPlaybackState(): Promise<PlaybackStateInfo | null> {
  if (!MusicPlayer) {
    return null;
  }
  await ensureConfigured();
  return MusicPlayer.getPlaybackState();
}

export async function getQueue(): Promise<TrackInfo[]> {
  if (!MusicPlayer) {
    return [];
  }
  await ensureConfigured();
  return MusicPlayer.getQueue();
}

export async function getRating(songId: string): Promise<number> {
  const userToken = getMusicUserToken();
  if (!userToken) return 0;
  return ratings.getRating(songId);
}

export async function setRating(songId: string, value: number): Promise<void> {
  const userToken = getMusicUserToken();
  if (!userToken) return;
  await ratings.addRating(songId, value);
}

export function setAutoplay(enabled: boolean): void {
  // Placeholder: Some SDKs handle this automatically or via a flag.
  // We'll store it in a local variable or use a bridge method if found.
  console.log('[musicPlayer] setAutoplay:', enabled);
}

export function setKeepAwake(enabled: boolean): void {
  MusicPlayer?.setKeepAwake(enabled);
}

export function release(): void {
  MusicPlayer?.release();
  configured = false;
}
