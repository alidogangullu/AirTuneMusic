import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {Alert} from 'react-native';
import {useTranslation} from 'react-i18next';
import * as musicPlayer from '../services/musicPlayer';
import {QuotaService} from '../services/quotaService';
import {getDeveloperToken} from '../api/apple-music/getDeveloperToken';
import {waitForToken} from '../api/apple-music/musicUserToken';
import {MusicKitWebView, MusicKitWebPlayerRef} from '../components/MusicKitWebView';
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
  queue: TrackInfo[];
  containerTracks: TrackInfo[] | null; // Full ordered track list for current container
  containerIndex: number;              // Current position in containerTracks
  containerId: string | null;
  canSkipToPrevious: boolean;
  canSkipToNext: boolean;
  isLoading: boolean;
  rating: number;
  autoplay: boolean;
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
  queue: [],
  containerTracks: null,
  containerIndex: 0,
  containerId: null,
  canSkipToPrevious: false,
  canSkipToNext: false,
  isLoading: false,
  rating: 0,
  autoplay: false,
};

// ── Context ─────────────────────────────────────────────────────

interface PlayerContextValue {
  state: PlayerState;
  playAlbum: (albumId: string, startIndex?: number, shuffle?: boolean, tracks?: TrackInfo[]) => Promise<boolean>;
  playPlaylist: (playlistId: string, startIndex?: number, shuffle?: boolean, tracks?: TrackInfo[]) => Promise<boolean>;
  playStation: (stationId: string) => Promise<boolean>;
  playSong: (songId: string) => Promise<boolean>;
  playMusicVideo: (musicVideoId: string) => Promise<boolean>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  skipToNext: () => void;
  skipToPrevious: () => void;
  seekTo: (positionMs: number) => void;
  getQueue: () => Promise<TrackInfo[]>;
  setShuffleMode: (mode: number) => void;
  setRepeatMode: (mode: number) => void;
  toggleRating: () => Promise<void>;
  toggleAutoplay: () => void;
  isPlaying: boolean;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// ── Queue builder ─────────────────────────────────────────────────
/**
 * Builds the full visual queue for NowPlayingScreen.
 * - Non-shuffle: containerTracks[0..containerIndex-1] + SDK queue (current+upcoming)
 * - Shuffle / no containerTracks: SDK queue as-is
 */
function buildVisualQueue(s: PlayerState, sdkQueue: TrackInfo[]): TrackInfo[] {
  if (s.shuffleMode !== 0 || !s.containerTracks || s.containerTracks.length === 0) {
    return sdkQueue;
  }
  // Tracks before current position in container order
  const previous = s.containerTracks.slice(0, s.containerIndex);
  // Combine: previous (from API list) + SDK queue (current+upcoming)
  const sdkIds = new Set(sdkQueue.map(t => t.id).filter(Boolean));
  const filteredPrevious = previous.filter(t => !sdkIds.has(t.id));
  return [...filteredPrevious, ...sdkQueue];
}

// ── Provider ────────────────────────────────────────────────────

export function PlayerProvider({children}: {children: React.ReactNode}) {
  const {t} = useTranslation();
  const [state, setState] = useState<PlayerState>(initialState);
  const [showSettings, setShowSettings] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastTrackIdRef = useRef<number | null>(null);

  const activeEngineRef = useRef<'native' | 'web'>('native');
  const webPlayerRef = useRef<MusicKitWebPlayerRef>(null);
  const [tokens, setTokens] = useState<{dev: string; user: string | null} | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const dev = await getDeveloperToken();
        const user = await waitForToken();
        setTokens({dev, user});
      } catch (e) {
        console.warn('Failed to load tokens for WebPlayer', e);
      }
    })();
  }, []);

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
              t('settings.pro.limitReached'),
              t('settings.pro.limitReachedMessage', {
                limit: QuotaService.HOURLY_LIMIT,
                remaining: remaining,
              }),
              [
                {text: t('common.cancel'), style: 'cancel'},
                {
                  text: t('common.viewOptions'),
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

        if (data.playbackQueueId === undefined) return;

        // Rebuild visual queue and update state atomically to prevent NowPlaying jitter
        musicPlayer.getQueue().then(sdkQueue => {
          setState(s => {
            const newContainerId = (data as any).containerStoreId ?? s.containerId;
            const newContainerIndex = (data as any).containerIndex ?? s.containerIndex;
            const isSameTrack = data.playbackQueueId === s.track?.playbackQueueId;
            
            // Build the merged queue using the NEW state properties locally
            const tempState = {
              ...s,
              track: data,
              containerId: newContainerId,
              containerIndex: newContainerIndex,
              shuffleMode: s.shuffleMode, // explicit for buildVisualQueue
            };
            const merged = buildVisualQueue(tempState, sdkQueue);

            return {
              ...tempState,
              duration: data.duration ?? 0,
              position: isSameTrack ? s.position : 0,
              queueIndex: data.trackIndex ?? s.queueIndex,
              queue: merged,
              canSkipToPrevious: (data as any).canSkipToPrevious ?? s.canSkipToPrevious,
              canSkipToNext: (data as any).canSkipToNext ?? s.canSkipToNext,
              isLoading: false,
            };
          });
        });

        // Fetch rating in background (doesn't affect layout)
        if (data.id) {
          musicPlayer.getRating(data.id).then(r => {
            setState(s => ({...s, rating: r}));
          });
        }
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
        musicPlayer.getQueue().then(sdkQueue => {
          setState(s => {
            const merged = buildVisualQueue(s, sdkQueue);
            return {...s, queue: merged, queueCount: data.count};
          });
        });
      }),
      musicPlayer.addEventListener('onShuffleModeChanged', data => {
        // SDK rebuilds queue on shuffle change - re-fetch to get updated order
        musicPlayer.getQueue().then(sdkQueue => {
          setState(s => {
            const merged = buildVisualQueue({...s, shuffleMode: data.shuffleMode}, sdkQueue);
            return {...s, queue: merged, shuffleMode: data.shuffleMode};
          });
        });
      }),
      musicPlayer.addEventListener('onRepeatModeChanged', data => {
        setState(s => ({...s, repeatMode: data.repeatMode}));
      }),
      musicPlayer.addEventListener('onPlaybackError', data => {
        console.warn('[MusicPlayer] Playback error:', data.message);
      }),
      musicPlayer.addEventListener('onItemEnded', data => {
        console.log('[MusicPlayer] Item ended:', data.title);
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
        queue: info.title ? s.queue : [], // Will be updated by getQueue() call below
        track: info.title
          ? {
              id: info.id ?? null,
              title: info.title,
              artistName: info.artistName ?? null,
              albumTitle: info.albumTitle ?? null,
              artworkUrl: info.artworkUrl ?? null,
              duration: info.trackDuration ?? info.duration,
              trackIndex: info.queueIndex,
              playbackQueueId: (info as any).playbackQueueId,
            }
          : s.track,
      }));

      musicPlayer.getQueue().then(queue => {
        setState(s => ({...s, queue}));
      });

      if (info.id) {
        musicPlayer.getRating(info.id).then(r => {
          setState(s => ({...s, rating: r}));
        });
      }
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
          t('settings.pro.limitReached'),
          t('settings.pro.limitReachedMessage', {
            limit: QuotaService.HOURLY_LIMIT,
            remaining: remaining,
          }),
          [
            {text: t('common.cancel'), style: 'cancel'},
            {
              text: t('common.viewOptions'),
              onPress: () => setShowSettings(true),
            },
          ],
        );
        return false;
      }

      try {
        if (activeEngineRef.current === 'web') {
          webPlayerRef.current?.stop();
          activeEngineRef.current = 'native';
        }
        await playFn();
        // Quota is now recorded in onCurrentItemChanged to handle automatic transitions
        return true;
      } catch (err) {
        console.error('[PlayerProvider] Playback error:', err);
        return false;
      }
    },
    [t],
  );

  const playAlbum = useCallback(
    async (albumId: string, startIndex = 0, shuffle = false, tracks?: TrackInfo[]) => {
      setState(s => ({
        ...s,
        containerId: albumId,
        containerTracks: tracks ?? null,
        containerIndex: startIndex,
        isLoading: true,
      }));
      return checkQuotaAndPlay(() => {
        if (albumId.startsWith('l.') && tracks && tracks.length > 0) {
          const trackIds = tracks.map(t => t.id).filter(Boolean) as string[];
          return musicPlayer.playTracks(trackIds, startIndex, shuffle);
        }
        return musicPlayer.playAlbum(albumId, startIndex, shuffle);
      });
    },
    [checkQuotaAndPlay],
  );

  const playPlaylist = useCallback(
    async (playlistId: string, startIndex = 0, shuffle = false, tracks?: TrackInfo[]) => {
      setState(s => ({
        ...s,
        containerId: playlistId,
        containerTracks: tracks ?? null,
        containerIndex: startIndex,
        isLoading: true,
      }));
      return checkQuotaAndPlay(() => {
        if (playlistId.startsWith('p.') && tracks && tracks.length > 0) {
          const trackIds = tracks.map(t => t.id).filter(Boolean) as string[];
          return musicPlayer.playTracks(trackIds, startIndex, shuffle);
        }
        return musicPlayer.playPlaylist(playlistId, startIndex, shuffle);
      });
    },
    [checkQuotaAndPlay],
  );

  const playStation = useCallback(
    async (stationId: string) => {
      if (!QuotaService.canPlayNextSong()) {
        const remaining = QuotaService.getRemainingTimeFormatted();
        Alert.alert(
          t('settings.pro.limitReached'),
          t('settings.pro.limitReachedMessage', {
            limit: QuotaService.HOURLY_LIMIT,
            remaining: remaining,
          }),
          [
            {text: t('common.cancel'), style: 'cancel'},
            {
              text: t('common.viewOptions'),
              onPress: () => setShowSettings(true),
            },
          ],
        );
        return false;
      }

      musicPlayer.stop();
      activeEngineRef.current = 'web';
      QuotaService.recordSongPlay();

      setState(s => ({...s, containerId: stationId, isLoading: true, playbackState: 'unknown'}));
      webPlayerRef.current?.playStation(stationId);
      return true;
    },
    [t],
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
    if (activeEngineRef.current === 'web') {
      webPlayerRef.current?.seekTo?.(positionMs);
    } else {
      musicPlayer.seekTo(positionMs);
    }
  }, []);

  const getQueue = useCallback(async () => {
    return musicPlayer.getQueue();
  }, []);

  const value: PlayerContextValue = {
    state,
    playAlbum,
    playPlaylist,
    playStation,
    playSong,
    playMusicVideo,
    play: () => {
      if (activeEngineRef.current === 'web') {
        webPlayerRef.current?.play();
        setState(s => ({...s, playbackState: 'playing'}));
      } else {
        musicPlayer.play();
      }
    },
    pause: () => {
      if (activeEngineRef.current === 'web') {
        webPlayerRef.current?.pause();
        setState(s => ({...s, playbackState: 'paused'}));
      } else {
        musicPlayer.pause();
      }
    },
    stop: () => {
      if (activeEngineRef.current === 'web') {
        webPlayerRef.current?.stop();
        activeEngineRef.current = 'native';
        setState(s => ({...s, playbackState: 'stopped'}));
      }
      musicPlayer.stop();
    },
    skipToNext: () => {
      if (activeEngineRef.current === 'web') {
        webPlayerRef.current?.skipToNext?.();
      } else {
        musicPlayer.skipToNext();
      }
    },
    skipToPrevious: () => {
      if (activeEngineRef.current === 'web') {
        webPlayerRef.current?.skipToPrevious?.();
      } else {
        musicPlayer.skipToPrevious();
      }
    },
    seekTo,
    getQueue,
    setShuffleMode: musicPlayer.setShuffleMode,
    setRepeatMode: musicPlayer.setRepeatMode,
    toggleRating: async () => {
      const {track, rating} = stateRef.current;
      if (!track?.id) return;
      const newValue = rating === 1 ? 0 : 1;
      setState(s => ({...s, rating: newValue}));
      try {
        await musicPlayer.setRating(track.id, newValue);
      } catch (e) {
        console.warn('Failed to set rating:', e);
        setState(s => ({...s, rating})); // Rollback
      }
    },
    toggleAutoplay: () => {
      const newValue = !stateRef.current.autoplay;
      setState(s => ({...s, autoplay: newValue}));
      musicPlayer.setAutoplay(newValue);
    },
    isPlaying: state.playbackState === 'playing',
    showSettings,
    setShowSettings,
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {tokens && (
        <MusicKitWebView
          ref={webPlayerRef}
          developerToken={tokens.dev}
          musicUserToken={tokens.user}
          onPlaybackStateChanged={stateName => {
            if (activeEngineRef.current === 'web') {
               const isLoading = stateName === 'loading';
               const mappedState: PlaybackStateName = isLoading ? 'unknown' : (stateName as PlaybackStateName);
               setState(s => ({...s, playbackState: mappedState, isLoading}));
            }
          }}
          onTrackChanged={trackInfo => {
            if (activeEngineRef.current === 'web') {
               setState(s => ({...s, track: trackInfo}));
            }
          }}
          onCapabilitiesChanged={data => {
            if (activeEngineRef.current === 'web') {
              setState(s => ({
                ...s,
                canSkipToNext: data.canSkipToNext,
                canSkipToPrevious: data.canSkipToPrevious,
              }));
            }
          }}
          onProgressChanged={data => {
            if (activeEngineRef.current === 'web') {
              setState(s => ({
                ...s,
                position: data.position,
                // Web event provides duration in MS. Keep it or prioritize track metadata duration
                duration: data.duration > 0 ? data.duration : s.duration,
                buffered: data.buffered,
                isLoading: false,
                buffering: false,
              }));
            }
          }}
          onQueueChanged={queueInfo => {
            if (activeEngineRef.current === 'web') {
              setState(s => ({
                ...s,
                queue: queueInfo,
                queueCount: queueInfo.length
              }));
            }
          }}
        />
      )}
    </PlayerContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────────

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) {
    throw new Error('usePlayer must be used within <PlayerProvider>');
  }
  return ctx;
}
