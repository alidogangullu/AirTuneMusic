import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createMMKV } from 'react-native-mmkv';
import { airPlayReceiver, AirPlayTrackInfo, AirPlayState } from '../../services/airPlayReceiver';
import * as musicPlayer from '../../services/musicPlayer';
import type { TrackInfo } from '../../services/musicPlayer';

const storage = createMMKV({ id: 'airplay-settings' });
const AIRPLAY_ENABLED_KEY = 'airplay_enabled';

export interface AirPlayContext {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** Whether an audio-only AirPlay stream is currently active */
  active: boolean;
  receiverState: AirPlayState;
  track: TrackInfo | null;
  positionMs: number;
  durationMs: number;
  connectionCount: number;
}

const Ctx = createContext<AirPlayContext>({
  enabled: false,
  setEnabled: () => {},
  active: false,
  receiverState: 'stopped',
  track: null,
  positionMs: 0,
  durationMs: 0,
  connectionCount: 0,
});

function airPlayTrackToPlayerTrack(info: AirPlayTrackInfo): TrackInfo {
  return {
    id: null,
    title: info.title || null,
    artistName: info.artist || null,
    albumTitle: info.album || null,
    artworkUrl: info.coverArtBase64
      ? `data:image/jpeg;base64,${info.coverArtBase64}`
      : null,
    duration: info.durationMs,
    trackIndex: 0,
    kind: 'song',
  };
}

export function AirPlayProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [enabled, setEnabled] = useState<boolean>(storage.getBoolean(AIRPLAY_ENABLED_KEY) ?? false);
  const [receiverState, setReceiverState] = useState<AirPlayState>('stopped');
  const [active, setActive] = useState(false);
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [connectionCount, setConnectionCount] = useState(0);

  const setEnabledPersisted = useCallback((v: boolean) => {
    storage.set(AIRPLAY_ENABLED_KEY, v);
    setEnabled(v);
  }, [setEnabled]);

  // Start or stop the receiver when the setting changes
  useEffect(() => {
    if (enabled) {
      airPlayReceiver.start('AirTune');
    } else {
      airPlayReceiver.stop();
      setActive(false);
      setTrack(null);
    }
  }, [enabled]);

  // Attach event listeners while enabled
  useEffect(() => {
    if (!enabled) return;

    const subs = [
      airPlayReceiver.onStateChanged(setReceiverState),

      airPlayReceiver.onConnectionCount(count => {
        setConnectionCount(count);
        if (count === 0) {
          setActive(false);
          setTrack(null);
          setPositionMs(0);
          setDurationMs(0);
        }
      }),

      airPlayReceiver.onModeChange(audioOnly => {
        setActive(audioOnly);
        if (audioOnly) {
          // AirPlay audio stream started — pause Apple Music so only one source plays
          musicPlayer.pause();
        } else {
          setTrack(null);
          setPositionMs(0);
          setDurationMs(0);
        }
      }),

      airPlayReceiver.onTrackChanged(info => {
        setTrack(airPlayTrackToPlayerTrack(info));
        setDurationMs(info.durationMs);
      }),

      airPlayReceiver.onProgress(({ positionMs: pos, durationMs: dur }) => {
        setPositionMs(pos);
        if (dur > 0) setDurationMs(dur);
      }),
    ];

    return () => subs.forEach(s => s.remove());
  }, [enabled]);

  const value = useMemo(
    () => ({ enabled, setEnabled: setEnabledPersisted, active, receiverState, track, positionMs, durationMs, connectionCount }),
    [enabled, setEnabledPersisted, active, receiverState, track, positionMs, durationMs, connectionCount],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAirPlay() {
  return useContext(Ctx);
}
