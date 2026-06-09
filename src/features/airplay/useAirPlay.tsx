import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { createMMKV } from 'react-native-mmkv';
import { airPlayReceiver, AirPlayTrackInfo, AirPlayState } from './airPlayReceiver';
import { usePlayer } from '../player/hooks/usePlayer';
import { AirPlayQuotaService } from './airPlayQuotaService';
import * as musicPlayer from '../player/musicPlayer';
import type { TrackInfo } from '../player/musicPlayer';

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
  quotaUsedMs: number;
  quotaRemainingMs: number;
  quotaExceeded: boolean;
  /** DACP play/pause toggle on the connected sender. */
  playPause: () => void;
  /** DACP skip to next track on the connected sender. */
  next: () => void;
  /** DACP skip to previous track on the connected sender. */
  prev: () => void;
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
  quotaUsedMs: 0,
  quotaRemainingMs: AirPlayQuotaService.HOURLY_LIMIT_SECONDS * 1000,
  quotaExceeded: false,
  playPause: () => {},
  next: () => {},
  prev: () => {},
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
  // Last displayed position (ms), used to smooth out stale/backward progress updates.
  const displayPositionRef = useRef(0);

  const [quotaUsedMs, setQuotaUsedMs] = useState(() => AirPlayQuotaService.getUsedSeconds() * 1000);
  const quotaRemainingMs = AirPlayQuotaService.getRemainingMs();
  const quotaExceeded = !AirPlayQuotaService.canPlay();

  const { setShowSettings } = usePlayer();

  const _showQuotaAlert = useCallback(() => {
    const { used, total } = AirPlayQuotaService.getUsageInfo();
    const usedMin = Math.ceil(used / 60);
    const totalMin = Math.round(total / 60);
    const remaining = AirPlayQuotaService.getRemainingTimeFormatted();
    Alert.alert(
      t('airplay.quotaTitle', 'Hourly Limit Reached'),
      t('airplay.quotaMessage', 'You have used {{used}}/{{total}} minutes of AirPlay playback this hour.\n\nLimit resets in: {{remaining}}.', { used: usedMin, total: totalMin, remaining }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.viewOptions'), onPress: () => setShowSettings(true) },
      ],
    );
  }, [t, setShowSettings]);

  // Quota tick: record one second of playback while actively playing
  useEffect(() => {
    if (!active || !isPlaying) return;

    const interval = setInterval(() => {
      const wasAllowed = AirPlayQuotaService.canPlay();
      AirPlayQuotaService.recordPlaybackSecond();
      const usedMs = AirPlayQuotaService.getUsedSeconds() * 1000;
      setQuotaUsedMs(usedMs);

      if (wasAllowed && !AirPlayQuotaService.canPlay()) {
        airPlayReceiver.disconnect();
        _showQuotaAlert();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [active, isPlaying, _showQuotaAlert]);

  // Initial mount auto-start — intentionally runs once; enabled changes are handled below
  useEffect(() => {
    if (enabled) {
      airPlayReceiver.start('AirTune').catch(() => {
        // If it fails on mount, disable it to prevent crashes
        storage.set(AIRPLAY_ENABLED_KEY, false);
        setEnabled(false);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
              } catch {
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
          displayPositionRef.current = 0;
          setDurationMs(0);
          setIsPlaying(false);
        } else if (!AirPlayQuotaService.canPlay()) {
          // Block reconnection while quota is exceeded
          airPlayReceiver.disconnect();
          _showQuotaAlert();
        }
      }),

      airPlayReceiver.onModeChange(audioOnly => {
        console.log('[AirPlay] mode changed:', audioOnly ? 'audio-only' : 'video/idle');
        if (!audioOnly) {
          // If a video session starts or audio ends, clear state
          setActive(false);
          setTrack(null);
          setPositionMs(0);
          displayPositionRef.current = 0;
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
        // Ignore stale 0 updates. Accept forward motion and large jumps (track
        // changes / seeks), but reject small backward jitter (<4s) so the bar
        // doesn't stutter. Mirrors AirPipe's JS smoothing.
        if (pos > 0) {
          const diff = pos - displayPositionRef.current;
          if (diff >= -500 || Math.abs(diff) > 4000) {
            displayPositionRef.current = pos;
            setPositionMs(pos);
          }
          setIsPlaying(true);
          if (dur > 0) setDurationMs(dur);
        }
      }),
    ];

    return () => subs.forEach(s => s.remove());
  }, [enabled, _showQuotaAlert]);

  // Handle auto-pause detection for AirPlay with a lenient timeout
  useEffect(() => {
    if (!active || positionMs === 0) {
      setIsPlaying(false);
      return;
    }
    // Native emits interpolated progress ~1×/sec while audio flows; if none
    // arrives for 1.5s we treat playback as paused (matches AirPipe).
    const timer = setTimeout(() => {
      setIsPlaying(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, [positionMs, active]);

  const playPause = useCallback(() => airPlayReceiver.playPause(), []);
  const next = useCallback(() => airPlayReceiver.next(), []);
  const prev = useCallback(() => airPlayReceiver.prev(), []);

  const value = useMemo(
    () => ({ enabled, setEnabled: setEnabledPersisted, active, receiverState, track, positionMs, durationMs, connectionCount, isPlaying, quotaUsedMs, quotaRemainingMs, quotaExceeded, playPause, next, prev }),
    [enabled, setEnabledPersisted, active, receiverState, track, positionMs, durationMs, connectionCount, isPlaying, quotaUsedMs, quotaRemainingMs, quotaExceeded, playPause, next, prev],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAirPlay() {
  return useContext(Ctx);
}
