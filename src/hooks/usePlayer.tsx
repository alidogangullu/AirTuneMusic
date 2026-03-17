import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {Alert} from 'react-native';
import * as musicPlayer from '../services/musicPlayer';
import {QuotaService} from '../services/quotaService';
import type {
  PlaybackStateName,
  TrackInfo,
  ProgressInfo,
} from '../services/musicPlayer';

// ── State shape ─────────────────────────────────────────────────

export interface PlayerState {
  playbackState: PlaybackStateName;
  track: TrackInfo | null;
  position: number;
  duration: number;
  buffered: number;
  buffering: boolean;
  shuffleMode: number;
  repeatMode: number;
  queueCount: number;
  queueIndex: number;
  containerId: string | null;
  isLoading: boolean;
}

const initialState: PlayerState = {
  playbackState: 'stopped',
  track: null,
  position: 0,
  duration: 0,
  buffered: 0,
  buffering: false,
  shuffleMode: 0,
  repeatMode: 0,
  queueCount: 0,
  queueIndex: 0,
  containerId: null,
  isLoading: false,
};

// ── Context ─────────────────────────────────────────────────────

interface PlayerContextValue {
  state: PlayerState;
  playAlbum: (albumId: string, startIndex?: number, shuffle?: boolean) => Promise<boolean>;
  playPlaylist: (playlistId: string, startIndex?: number, shuffle?: boolean) => Promise<boolean>;
  playStation: (stationId: string) => Promise<boolean>;
  playSong: (songId: string) => Promise<boolean>;
  playMusicVideo: (musicVideoId: string) => Promise<boolean>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  skipToNext: () => void;
  skipToPrevious: () => void;
  seekTo: (positionMs: number) => void;
  setShuffleMode: (mode: number) => void;
  setRepeatMode: (mode: number) => void;
  isPlaying: boolean;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────

export function PlayerProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<PlayerState>(initialState);
  const [showSettings, setShowSettings] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastTrackIdRef = useRef<number | null>(null);

  useEffect(() => {
    const subs = [
      musicPlayer.addEventListener('onPlaybackStateChanged', data => {
        setState(s => ({
          ...s,
          playbackState: data.state,
          // If we transition to anything other than stopped, we're done with the initial "loading"
          isLoading: data.state === 'stopped' ? s.isLoading : false,
        }));
      }),
      musicPlayer.addEventListener('onCurrentItemChanged', data => {
        // Enforce quota on track transitions (manual or automatic)
        if (data.playbackQueueId !== undefined && data.playbackQueueId !== lastTrackIdRef.current) {
          if (!QuotaService.canPlayNextSong()) {
            musicPlayer.stop();
            const remaining = QuotaService.getRemainingTimeFormatted();
            Alert.alert(
              'Limit Reached',
              `You have reached your hourly limit of ${QuotaService.HOURLY_LIMIT} songs. Next play available in: ${remaining}.`,
              [
                {text: 'Cancel', style: 'cancel'},
                {
                  text: 'View Options',
                  onPress: () => setShowSettings(true),
                },
              ],
            );
            return;
          }
          // Quota available, record the play and update tracking
          QuotaService.recordSongPlay();
          lastTrackIdRef.current = data.playbackQueueId;
        }

        setState(s => ({
          ...s,
          track: data,
          duration: data.duration ?? 0,
          position: 0,
          queueIndex: data.trackIndex ?? s.queueIndex,
          isLoading: false,
        }));
      }),
      musicPlayer.addEventListener('onPlaybackProgress', (data: ProgressInfo) => {
        setState(s => ({
          ...s,
          position: data.position,
          duration: data.duration,
          buffered: data.buffered,
          isLoading: false, // Progress received, definitely not loading anymore
          // If we are progressing, we shouldn't be "stuck" in a buffering state visual
          buffering: data.position > 0 ? false : s.buffering,
        }));
      }),
      musicPlayer.addEventListener('onBufferingStateChanged', data => {
        setState(s => ({...s, buffering: data.buffering}));
      }),
      musicPlayer.addEventListener('onPlaybackQueueChanged', data => {
        setState(s => ({...s, queueCount: data.count}));
      }),
      musicPlayer.addEventListener('onShuffleModeChanged', data => {
        setState(s => ({...s, shuffleMode: data.shuffleMode}));
      }),
      musicPlayer.addEventListener('onRepeatModeChanged', data => {
        setState(s => ({...s, repeatMode: data.repeatMode}));
      }),
      musicPlayer.addEventListener('onPlaybackError', data => {
        console.warn('[MusicPlayer] Playback error:', data.message);
      }),
      musicPlayer.addEventListener('onItemEnded', data => {
        console.log('[MusicPlayer] Item ended:', data.title);
        // We record the play when it successfully ends (or starts, but ends is safer to avoid accidental clicks)
        // Actually, user requested "after first music", let's record when it STARTS to be strict
      }),
    ];

    return () => {
      subs.forEach(s => s.remove());
    };
  }, []);

  // Sync current state and pre-configure native module on mount
  useEffect(() => {
    let mounted = true;

    // Pre-configure the Native SDK in the background so the first playback is instant
    musicPlayer.ensureConfigured().catch(err => {
      console.warn('Failed to pre-configure music player:', err);
    });

    musicPlayer.getPlaybackState().then(info => {
      if (!mounted || !info) return;
      setState(s => ({
        ...s,
        playbackState: info.state,
        position: info.position,
        duration: info.duration,
        shuffleMode: info.shuffleMode,
        repeatMode: info.repeatMode,
        queueCount: info.queueCount,
        queueIndex: info.queueIndex,
        track: info.title
          ? {
              title: info.title,
              artistName: info.artistName ?? null,
              albumTitle: info.albumTitle ?? null,
              artworkUrl: info.artworkUrl ?? null,
              duration: info.trackDuration ?? info.duration,
              trackIndex: info.queueIndex,
            }
          : s.track,
      }));
    });

    return () => {
      mounted = false;
      // Stop playback and clear state on unmount / reload
      musicPlayer.stop();
      setState(initialState);
    };
  }, []);

  const checkQuotaAndPlay = useCallback(
    async (playFn: () => Promise<void>): Promise<boolean> => {
      if (!QuotaService.canPlayNextSong()) {
        const remaining = QuotaService.getRemainingTimeFormatted();
        Alert.alert(
          'Limit Reached',
          `You have reached your hourly limit of ${QuotaService.HOURLY_LIMIT} songs. Next play available in: ${remaining}.`,
          [
            {text: 'Cancel', style: 'cancel'},
            {
              text: 'View Options',
              onPress: () => setShowSettings(true),
            },
          ],
        );
        return false;
      }

      try {
        await playFn();
        // Quota is now recorded in onCurrentItemChanged to handle automatic transitions
        return true;
      } catch (err) {
        console.error('[PlayerProvider] Playback error:', err);
        return false;
      }
    },
    [],
  );

  const playAlbum = useCallback(
    async (albumId: string, startIndex = 0, shuffle = false) => {
      setState(s => ({...s, containerId: albumId, isLoading: true}));
      return checkQuotaAndPlay(() =>
        musicPlayer.playAlbum(albumId, startIndex, shuffle),
      );
    },
    [checkQuotaAndPlay],
  );

  const playPlaylist = useCallback(
    async (playlistId: string, startIndex = 0, shuffle = false) => {
      setState(s => ({...s, containerId: playlistId, isLoading: true}));
      return checkQuotaAndPlay(() =>
        musicPlayer.playPlaylist(playlistId, startIndex, shuffle),
      );
    },
    [checkQuotaAndPlay],
  );

  const playStation = useCallback(
    async (stationId: string) => {
      setState(s => ({...s, containerId: stationId, isLoading: true}));
      return checkQuotaAndPlay(() => musicPlayer.playStation(stationId));
    },
    [checkQuotaAndPlay],
  );

  const playSong = useCallback(
    async (songId: string) => {
      setState(s => ({...s, containerId: songId, isLoading: true}));
      return checkQuotaAndPlay(() => musicPlayer.playSong(songId));
    },
    [checkQuotaAndPlay],
  );

  const playMusicVideo = useCallback(
    async (musicVideoId: string) => {
      setState(s => ({...s, containerId: musicVideoId, isLoading: true}));
      return checkQuotaAndPlay(() => musicPlayer.playMusicVideo(musicVideoId));
    },
    [checkQuotaAndPlay],
  );

  const seekTo = useCallback((positionMs: number) => {
    setState(s => ({...s, position: positionMs}));
    musicPlayer.seekTo(positionMs);
  }, []);

  const value: PlayerContextValue = {
    state,
    playAlbum,
    playPlaylist,
    playStation,
    playSong,
    playMusicVideo,
    play: musicPlayer.play,
    pause: musicPlayer.pause,
    stop: musicPlayer.stop,
    skipToNext: musicPlayer.skipToNext,
    skipToPrevious: musicPlayer.skipToPrevious,
    seekTo,
    setShuffleMode: musicPlayer.setShuffleMode,
    setRepeatMode: musicPlayer.setRepeatMode,
    isPlaying: state.playbackState === 'playing',
    showSettings,
    setShowSettings,
  };

  const showSettingsInternal = showSettings;
  const setShowSettingsInternal = setShowSettings;

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* 
          We expose showSettings state through context so App.tsx or HomeScreen can consume it.
          Alternatively, we can use an event emitter or a shared signal.
      */}
      <SettingsSyncHelper 
        showSettings={showSettingsInternal} 
        onClose={() => setShowSettingsInternal(false)} 
      />
    </PlayerContext.Provider>
  );
}

// ── Internal Helper to bridge state ─────────────────────────────
// This is a hacky way to sync state from PlayerProvider back up if needed,
// but actually usePlayer hook is enough if consumed in HomeScreen.

function SettingsSyncHelper({showSettings, onClose}: {showSettings: boolean, onClose: () => void}) {
  // This could trigger an effect or just be a placeholder
  return null;
}

// ── Hook ────────────────────────────────────────────────────────

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within <PlayerProvider>');
  }
  return ctx;
}
