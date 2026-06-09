import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';

export interface AirPlayTrackInfo {
  title: string;
  artist: string;
  album: string;
  genre: string;
  durationMs: number;
  coverArtBase64?: string;
}

export interface AirPlayProgress {
  positionMs: number;
  durationMs: number;
}

export type AirPlayState = 'stopped' | 'running' | 'error';

function getModule() {
  return NativeModules.AirPlayReceiver;
}

let _emitter: NativeEventEmitter | null = null;
function getEmitter(): NativeEventEmitter {
  _emitter ??= new NativeEventEmitter(getModule());
  return _emitter;
}

export const airPlayReceiver = {
  // async so a missing/failed native module surfaces as a rejected promise
  // (catchable) rather than a synchronous throw that could crash the app.
  start: async (deviceName: string = 'AirTune'): Promise<boolean> => {
    const mod = getModule();
    if (!mod?.startReceiver) {
      throw new Error('AirPlayReceiver native module unavailable');
    }
    return mod.startReceiver(deviceName);
  },

  stop: async (): Promise<boolean> => {
    const mod = getModule();
    if (!mod?.stopReceiver) return false;
    return mod.stopReceiver();
  },

  disconnect: (): void => {
    try { getModule()?.disconnect(); } catch { /* native unavailable — ignore */ }
  },

  pause: (): void => {
    try { getModule()?.pause(); } catch { /* native unavailable — ignore */ }
  },

  /** DACP play/pause toggle on the connected sender (iPhone/Mac). */
  playPause: (): void => {
    try { getModule()?.dacpPlayPause(); } catch { /* native unavailable — ignore */ }
  },

  /** DACP skip to next track on the connected sender. */
  next: (): void => {
    try { getModule()?.dacpNext(); } catch { /* native unavailable — ignore */ }
  },

  /** DACP skip to previous track on the connected sender. */
  prev: (): void => {
    try { getModule()?.dacpPrev(); } catch { /* native unavailable — ignore */ }
  },

  onStateChanged: (cb: (state: AirPlayState) => void): EmitterSubscription =>
    getEmitter().addListener('onAirPlayStateChanged', ({ state }) => cb(state)),

  onTrackChanged: (cb: (info: AirPlayTrackInfo) => void): EmitterSubscription =>
    getEmitter().addListener('onAirPlayTrackChanged', cb),

  onProgress: (cb: (progress: AirPlayProgress) => void): EmitterSubscription =>
    getEmitter().addListener('onAirPlayProgress', cb),

  onConnectionCount: (cb: (count: number) => void): EmitterSubscription =>
    getEmitter().addListener('onAirPlayConnectionCount', ({ count }) => cb(count)),

  onModeChange: (cb: (audioOnly: boolean) => void): EmitterSubscription =>
    getEmitter().addListener('onAirPlayModeChange', ({ audioOnly }) => cb(audioOnly)),

  onPin: (cb: (pin: string | null) => void): EmitterSubscription =>
    getEmitter().addListener('onAirPlayPin', ({ pin }) => cb(pin ?? null)),
};
