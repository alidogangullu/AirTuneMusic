import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTranslation} from 'react-i18next';
import * as musicPlayer from '../services/musicPlayer';
import {QuotaService} from '../services/quotaService';
import {RewardAdService} from '../services/rewardAdService';
import {getDeveloperToken} from '../api/apple-music/getDeveloperToken';
import {waitForToken, getMusicUserToken} from '../api/apple-music/musicUserToken';
import {MusicKitWebView, MusicKitWebPlayerRef} from '../components/MusicKitWebView';
import type {QuotaRecoveryRequest} from '../screens/QuotaLimitScreen';
import type {
  PlaybackStateName,
  TrackInfo,
  ProgressInfo,
} from '../services/musicPlayer';

// ── State shape ─────────────────────────────────────────────────

export interface PlayerState {
  playbackState: PlaybackStateName;
  track: TrackInfo | null;
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

export interface ProgressState {
  position: number;
  duration: number;
  buffered: number;
}

const initialState: PlayerState = {
  playbackState: 'stopped',
  track: null,
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

const initialProgress: ProgressState = {
  position: 0,
  duration: 0,
  buffered: 0,
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
  quotaRecoveryRequest: QuotaRecoveryRequest | null;
  requestQuotaRecovery: (retryAction?: () => Promise<void>) => void;
  dismissQuotaRecovery: () => void;
  startQuotaRewardAd: () => Promise<boolean>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

const PlaybackProgressContext = createContext<ProgressState>(initialProgress);

export function PlaybackProgressProvider({children}: Readonly<{children: React.ReactNode}>) {
  const [progress, setProgress] = useState<ProgressState>(initialProgress);

  useEffect(() => {
    const subs = [
      musicPlayer.addEventListener('onPlaybackProgress', (data: ProgressInfo) => {
        setProgress({
          position: data.position,
          duration: data.duration,
          buffered: data.buffered,
        });
      }),
      // Handle track changes to reset progress or set initial duration
      musicPlayer.addEventListener('onCurrentItemChanged', data => {
        if (data.duration !== undefined) {
          setProgress(p => ({
            ...p,
            duration: data.duration ?? 0,
            position: 0,
          }));
        }
      }),
      // Initial state sync
      musicPlayer.addEventListener('onPlaybackStateChanged', data => {
         if (data.state === 'stopped') {
           setProgress(initialProgress);
         }
      })
    ];

    // Sync initial state if already playing
    musicPlayer.getPlaybackState().then(info => {
      if (info) {
        setProgress({
          position: info.position,
          duration: info.trackDuration ?? info.duration,
          buffered: 0, // SDK info doesn't provide buffered for initial sync
        });
      }
    });

    return () => subs.forEach(s => s.remove());
  }, []);

  return (
    <PlaybackProgressContext.Provider value={progress}>
      {children}
    </PlaybackProgressContext.Provider>
  );
}

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

export function PlayerProvider({children}: Readonly<{children: React.ReactNode}>) {
  const {t} = useTranslation();
  const [state, setState] = useState<PlayerState>(initialState);
  const [showSettings, setShowSettings] = useState(false);
  const [quotaRecoveryRequest, setQuotaRecoveryRequest] = useState<QuotaRecoveryRequest | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastTrackIdRef = useRef<number | null>(null);
  const pendingQuotaRetryRef = useRef<(() => Promise<void>) | null>(null);
  const quotaRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quotaRewardInFlightRef = useRef(false);

  const activeEngineRef = useRef<'native' | 'web'>('native');
  const webPlayerRef = useRef<MusicKitWebPlayerRef>(null);
  const [tokens, setTokens] = useState<{dev: string; user: string | null} | null>(null);

  const clearQuotaRecoveryTimer = useCallback(() => {
    if (quotaRecoveryTimerRef.current) {
      clearTimeout(quotaRecoveryTimerRef.current);
      quotaRecoveryTimerRef.current = null;
    }
  }, []);

  const dismissQuotaRecovery = useCallback(() => {
    clearQuotaRecoveryTimer();
    pendingQuotaRetryRef.current = null;
    setQuotaRecoveryRequest(null);
  }, [clearQuotaRecoveryTimer]);

  const startQuotaRewardAd = useCallback(async (): Promise<boolean> => {
    if (!quotaRecoveryRequest || quotaRewardInFlightRef.current) {
      return false;
    }

    quotaRewardInFlightRef.current = true;
    clearQuotaRecoveryTimer();

    try {
      await RewardAdService.showRewardedAd();
      QuotaService.addBonusPlays();

      const retryAction = pendingQuotaRetryRef.current;
      dismissQuotaRecovery();

      if (retryAction) {
        await retryAction();
      }

      return true;
    } finally {
      quotaRewardInFlightRef.current = false;
    }
  }, [clearQuotaRecoveryTimer, dismissQuotaRecovery, quotaRecoveryRequest]);

  const requestQuotaRecovery = useCallback(
    (retryAction?: () => Promise<void>) => {
      if (retryAction && !pendingQuotaRetryRef.current) {
        pendingQuotaRetryRef.current = retryAction;
      }

      let shouldScheduleAutoStart = false;

      setQuotaRecoveryRequest(existingRequest => {
        if (existingRequest) {
          return existingRequest;
        }

        const usage = QuotaService.getUsageInfo();
        const remaining = QuotaService.getRemainingTimeFormatted();
        shouldScheduleAutoStart = true;

        return {
          title: t('quotaLimit.title'),
          message: t('quotaLimit.message', {
            limit: QuotaService.HOURLY_LIMIT,
            used: usage.used,
            total: usage.total,
            remaining,
            bonus: QuotaService.BONUS_PLAYS_PER_AD,
          }),
          bonusPlays: QuotaService.BONUS_PLAYS_PER_AD,
          autoWatchAfterMs: 5000,
          limit: QuotaService.HOURLY_LIMIT,
          used: usage.used,
          total: usage.total,
          remaining,
        };
      });

      if (!shouldScheduleAutoStart) {
        return;
      }

      clearQuotaRecoveryTimer();
      quotaRecoveryTimerRef.current = setTimeout(() => {
        startQuotaRewardAd();
      }, 5000);
    },
    [clearQuotaRecoveryTimer, startQuotaRewardAd, t],
  );

  const updateTrackRating = useCallback((trackId: string) => {
    musicPlayer.getRating(trackId).then(rating => {
      setState(s => ({...s, rating}));
    });
  }, []);

  const updateNativeTrackState = useCallback((data: TrackInfo, sdkQueue: TrackInfo[]) => {
    setState(s => {
      const newContainerId = (data as any).containerStoreId ?? s.containerId;
      const newContainerIndex = (data as any).containerIndex ?? s.containerIndex;

      const tempState = {
        ...s,
        track: data,
        containerId: newContainerId,
        containerIndex: newContainerIndex,
      };

      const merged = buildVisualQueue(tempState, sdkQueue);

      return {
        ...tempState,
        queueIndex: data.trackIndex ?? s.queueIndex,
        queue: merged,
        canSkipToPrevious: (data as any).canSkipToPrevious ?? s.canSkipToPrevious,
        canSkipToNext: (data as any).canSkipToNext ?? s.canSkipToNext,
        isLoading: false,
      };
    });
  }, []);

  const updateNativeQueueState = useCallback((sdkQueue: TrackInfo[], queueCount: number) => {
    setState(s => {
      const merged = buildVisualQueue(s, sdkQueue);
      return {...s, queue: merged, queueCount};
    });
  }, []);

  const updateNativeShuffleState = useCallback((sdkQueue: TrackInfo[], shuffleMode: number) => {
    setState(s => {
      const merged = buildVisualQueue({...s, shuffleMode}, sdkQueue);
      return {...s, queue: merged, shuffleMode};
    });
  }, []);

  const handleNativePlaybackStateChanged = useCallback((data: {state: PlaybackStateName}) => {
    setState(s => ({
      ...s,
      playbackState: data.state,
      isLoading: (data.state === 'stopped' || !!s.track) ? false : s.isLoading,
    }));
  }, []);

  const resumeCurrentPlayback = useCallback(async () => {
    if (activeEngineRef.current === 'web') {
      webPlayerRef.current?.play();
      return;
    }
    musicPlayer.play();
  }, []);

  const handleNativeCurrentItemChanged = useCallback((data: TrackInfo) => {
    if (data.playbackQueueId !== undefined && data.playbackQueueId !== lastTrackIdRef.current) {
      if (!QuotaService.canPlayNextSong()) {
        musicPlayer.stop();
        requestQuotaRecovery(resumeCurrentPlayback);
        return;
      }
      QuotaService.recordSongPlay();
      lastTrackIdRef.current = data.playbackQueueId;
    }

    if (data.playbackQueueId === undefined) return;

    musicPlayer.getQueue().then(sdkQueue => {
      updateNativeTrackState(data, sdkQueue);
    });

    if (data.id) {
      updateTrackRating(data.id);
    }
  }, [requestQuotaRecovery, resumeCurrentPlayback, updateNativeTrackState, updateTrackRating]);

  const handleNativePlaybackProgress = useCallback((data: ProgressInfo) => {
    setState(s => ({
      ...s,
      isLoading: false,
      buffering: data.position > 0 ? false : s.buffering,
    }));
  }, []);

  const handleNativePlaybackQueueChanged = useCallback((queueCount: number) => {
    musicPlayer.getQueue().then(sdkQueue => {
      updateNativeQueueState(sdkQueue, queueCount);
    });
  }, [updateNativeQueueState]);

  const handleNativeShuffleModeChanged = useCallback((shuffleMode: number) => {
    musicPlayer.getQueue().then(sdkQueue => {
      updateNativeShuffleState(sdkQueue, shuffleMode);
    });
  }, [updateNativeShuffleState]);

  const syncStartupQueue = useCallback((queue: TrackInfo[]) => {
    setState(s => ({...s, queue}));
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const dev = await getDeveloperToken();
        const user = await waitForToken();
        if (mounted) {
          setTokens({dev, user});
        }
      } catch (e) {
        if (mounted) {
          console.warn('Failed to load tokens for WebPlayer', e);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const subs = [
      musicPlayer.addEventListener('onPlaybackStateChanged', handleNativePlaybackStateChanged),
      musicPlayer.addEventListener('onCurrentItemChanged', handleNativeCurrentItemChanged),
      musicPlayer.addEventListener('onPlaybackProgress', handleNativePlaybackProgress),
      musicPlayer.addEventListener('onBufferingStateChanged', data => {
        setState(s => ({...s, buffering: data.buffering}));
      }),
      musicPlayer.addEventListener('onPlaybackQueueChanged', data => {
        handleNativePlaybackQueueChanged(data.count);
      }),
      musicPlayer.addEventListener('onShuffleModeChanged', data => {
        handleNativeShuffleModeChanged(data.shuffleMode);
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
      subs.forEach(subscription => subscription.remove());
    };
  }, [
    handleNativeCurrentItemChanged,
    handleNativePlaybackProgress,
    handleNativePlaybackQueueChanged,
    handleNativePlaybackStateChanged,
    handleNativeShuffleModeChanged,
  ]);

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
        queueCount: info.queueCount,
        queueIndex: info.queueIndex,
        queue: info.title ? s.queue : [],
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
        if (mounted) {
          syncStartupQueue(queue);
        }
      });

      if (info.id) {
        updateTrackRating(info.id);
      }
    });

    return () => {
      mounted = false;
      musicPlayer.stop();
      setState(initialState);
    };
  }, [syncStartupQueue, updateTrackRating]);

  // Sync current state and pre-configure native module on mount
  const checkQuotaAndPlay = useCallback(
    async (playFn: () => Promise<void>): Promise<boolean> => {
      if (!QuotaService.canPlayNextSong()) {
        requestQuotaRecovery(playFn);
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
    [requestQuotaRecovery],
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
          const trackIds = tracks.map(track => track.id).filter(Boolean) as string[];
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
          const trackIds = tracks.map(track => track.id).filter(Boolean) as string[];
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
        requestQuotaRecovery();
        return false;
      }

      try {
        if (activeEngineRef.current !== 'web') {
          musicPlayer.stop();
          activeEngineRef.current = 'web';
        }
        
        setState(s => ({...s, containerId: stationId, isLoading: true, playbackState: 'unknown'}));

        // Ensure WebView has the latest token (handles first-auth case where
        // MusicKitWebView mounted before the user completed sign-in)
        const currentToken = getMusicUserToken();
        if (currentToken) {
          webPlayerRef.current?.updateUserToken(currentToken);
        }

        webPlayerRef.current?.playStation(stationId);

        // Safety timeout to clear loading indicator if playback fails to start
        setTimeout(() => {
          setState(s => {
            if (s.containerId === stationId && s.isLoading) {
              console.warn('[Player] playStation timed out');
              return { ...s, isLoading: false };
            }
            return s;
          });
        }, 15000);

        // Quota is recorded in onTrackChanged when playback actually begins
        return true;
      } catch (err) {
        console.error('[PlayerProvider] playStation error:', err);
        return false;
      }
    },
    [requestQuotaRecovery],
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
    // Note: Local progress state update is handled by the progress event following the seek
    if (activeEngineRef.current === 'web') {
      webPlayerRef.current?.seekTo?.(positionMs);
    } else {
      musicPlayer.seekTo(positionMs);
    }
  }, []);

  const getQueue = useCallback(async () => {
    return musicPlayer.getQueue();
  }, []);

  const playerValue = useMemo<PlayerContextValue>(() => ({
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
      if (!QuotaService.canPlayNextSong()) {
        if (activeEngineRef.current === 'web') {
          webPlayerRef.current?.pause();
        } else {
          musicPlayer.pause();
        }

        requestQuotaRecovery(async () => {
          if (activeEngineRef.current === 'web') {
            webPlayerRef.current?.skipToNext?.();
            webPlayerRef.current?.play();
            return;
          }
          musicPlayer.skipToNext();
          musicPlayer.play();
        });
        return;
      }

      if (activeEngineRef.current === 'web') {
        webPlayerRef.current?.skipToNext?.();
      } else {
        musicPlayer.skipToNext();
      }
    },
    skipToPrevious: () => {
      if (!QuotaService.canPlayNextSong()) {
        if (activeEngineRef.current === 'web') {
          webPlayerRef.current?.pause();
        } else {
          musicPlayer.pause();
        }

        requestQuotaRecovery(async () => {
          if (activeEngineRef.current === 'web') {
            webPlayerRef.current?.skipToPrevious?.();
            webPlayerRef.current?.play();
            return;
          }
          musicPlayer.skipToPrevious();
          musicPlayer.play();
        });
        return;
      }

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
        setState(s => ({...s, rating}));
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
    quotaRecoveryRequest,
    requestQuotaRecovery,
    dismissQuotaRecovery,
    startQuotaRewardAd,
  }), [
    dismissQuotaRecovery,
    getQueue,
    playAlbum,
    playMusicVideo,
    playPlaylist,
    playSong,
    playStation,
    quotaRecoveryRequest,
    requestQuotaRecovery,
    seekTo,
    setShowSettings,
    showSettings,
    startQuotaRewardAd,
    state,
  ]);

  return (
    <PlayerContext.Provider value={playerValue}>
      <PlaybackProgressProvider>
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
              // Mirror native onCurrentItemChanged behavior: only record if queue identifier changed
              if (trackInfo.playbackQueueId !== undefined && trackInfo.playbackQueueId !== lastTrackIdRef.current) {
                if (!QuotaService.canPlayNextSong()) {
                  webPlayerRef.current?.stop();
                  requestQuotaRecovery(resumeCurrentPlayback);
                  return;
                }
                QuotaService.recordSongPlay();
                lastTrackIdRef.current = trackInfo.playbackQueueId;
              }
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
              musicPlayer.emitManualPlaybackProgress(data);
              setState(s => ({
                ...s,
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
      </PlaybackProgressProvider>
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

export function usePlaybackProgress(): ProgressState {
  const ctx = useContext(PlaybackProgressContext);
  return ctx;
}
