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
  start: (deviceName: string = 'AirTune'): Promise<boolean> =>
    getModule().startReceiver(deviceName),

  stop: (): Promise<boolean> =>
    getModule().stopReceiver(),

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
