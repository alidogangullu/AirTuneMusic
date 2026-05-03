import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
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
  isPlaying: boolean;
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
  isPlaying: false,
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
  const { t } = useTranslation();
  const [receiverState, setReceiverState] = useState<AirPlayState>('stopped');
  const [active, setActive] = useState(false);
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [connectionCount, setConnectionCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Initial mount auto-start
  useEffect(() => {
    if (enabled) {
      airPlayReceiver.start('AirTune').catch(() => {
        // If it fails on mount, disable it to prevent crashes
        storage.set(AIRPLAY_ENABLED_KEY, false);
        setEnabled(false);
      });
    }
  }, []);

  const setEnabledPersisted = useCallback((v: boolean) => {
    if (v) {
      Alert.alert(
        t('airplay.warningTitle', 'Warning'),
        t('airplay.warningMessage', 'Not every device supports this feature. If you experience any issues, please turn this off.'),
        [
          {
            text: t('common.cancel', 'Cancel'),
            style: 'cancel',
          },
          {
            text: t('common.ok', 'OK'),
            onPress: async () => {
              try {
                const success = await airPlayReceiver.start('AirTune');
                if (success !== false) {
                  storage.set(AIRPLAY_ENABLED_KEY, true);
                  setEnabled(true);
                } else {
                  throw new Error('Start returned false');
                }
              } catch (error) {
                Alert.alert(
                  t('airplay.errorTitle', 'Error'),
                  t('airplay.errorMessage', 'An error occurred. Your device might not support this feature.'),
                  [{ text: t('common.ok', 'OK') }]
                );
              }
            },
          },
        ]
      );
    } else {
      airPlayReceiver.stop();
      storage.set(AIRPLAY_ENABLED_KEY, false);
      setEnabled(false);
      setActive(false);
      setTrack(null);
      setIsPlaying(false);
    }
  }, [t]);

  // Attach event listeners while enabled
  useEffect(() => {
    if (!enabled) return;

    const subs = [
      airPlayReceiver.onStateChanged(state => {
        console.log('[AirPlay] state changed:', state);
        setReceiverState(state);
      }),

      airPlayReceiver.onConnectionCount(count => {
        console.log('[AirPlay] connection count:', count);
        setConnectionCount(count);
        if (count === 0) {
          console.log('[AirPlay] connection dropped, clearing active track/progress');
          setActive(false);
          setTrack(null);
          setPositionMs(0);
          setDurationMs(0);
          setIsPlaying(false);
        }
      }),

      airPlayReceiver.onModeChange(audioOnly => {
        console.log('[AirPlay] mode changed:', audioOnly ? 'audio-only' : 'video/idle');
        if (!audioOnly) {
          // If a video session starts or audio ends, clear state
          setActive(false);
          setTrack(null);
          setPositionMs(0);
          setDurationMs(0);
          setIsPlaying(false);
          return;
        }
        setActive(true);
        // AirPlay audio stream started — pause Apple Music so only one source plays
        musicPlayer.pause();
      }),

      airPlayReceiver.onTrackChanged(info => {
        console.log('[AirPlay] track changed:', info.title, 'durationMs=', info.durationMs);
        setTrack(prev => {
          const nextTrack = airPlayTrackToPlayerTrack(info);
          if (info.durationMs > 0) {
            return nextTrack;
          }
          return prev
            ? {...nextTrack, duration: prev.duration > 0 ? prev.duration : nextTrack.duration}
            : nextTrack;
        });
        if (info.durationMs > 0) {
          setDurationMs(info.durationMs);
        }
      }),

      airPlayReceiver.onProgress(({ positionMs: pos, durationMs: dur }) => {
        console.log('[AirPlay] progress:', { positionMs: pos, durationMs: dur });
        // Only update if position is moving; ignore stale 0,0 updates
        if (pos > 0) {
          setPositionMs(pos);
          setIsPlaying(true);
          if (dur > 0) setDurationMs(dur);
        }
      }),
    ];

    return () => subs.forEach(s => s.remove());
  }, [enabled]);

  // Handle auto-pause detection for AirPlay with a lenient timeout
  useEffect(() => {
    if (!active || positionMs === 0) {
      setIsPlaying(false);
      return;
    }
    // If progress doesn't advance for 3 seconds, we assume it's actually paused.
    // This is coordinated with the native audio watchdog (2s).
    const timer = setTimeout(() => {
      setIsPlaying(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [positionMs, active]);

  const value = useMemo(
    () => ({ enabled, setEnabled: setEnabledPersisted, active, receiverState, track, positionMs, durationMs, connectionCount, isPlaying }),
    [enabled, setEnabledPersisted, active, receiverState, track, positionMs, durationMs, connectionCount, isPlaying],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAirPlay() {
  return useContext(Ctx);
}
