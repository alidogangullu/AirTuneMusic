import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import * as musicPlayer from '../services/musicPlayer';
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
};

// ── Context ─────────────────────────────────────────────────────

interface PlayerContextValue {
  state: PlayerState;
  playAlbum: (albumId: string, startIndex?: number, shuffle?: boolean) => Promise<void>;
  playPlaylist: (playlistId: string, startIndex?: number, shuffle?: boolean) => Promise<void>;
  playStation: (stationId: string) => Promise<void>;
  playSong: (songId: string) => Promise<void>;
  playMusicVideo: (musicVideoId: string) => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  skipToNext: () => void;
  skipToPrevious: () => void;
  seekTo: (positionMs: number) => void;
  setShuffleMode: (mode: number) => void;
  setRepeatMode: (mode: number) => void;
  isPlaying: boolean;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────────

export function PlayerProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<PlayerState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const subs = [
      musicPlayer.addEventListener('onPlaybackStateChanged', data => {
        setState(s => ({...s, playbackState: data.state}));
      }),
      musicPlayer.addEventListener('onCurrentItemChanged', data => {
        setState(s => ({
          ...s,
          track: data,
          duration: data.duration ?? 0,
          position: 0,
        }));
      }),
      musicPlayer.addEventListener('onPlaybackProgress', (data: ProgressInfo) => {
        setState(s => ({
          ...s,
          position: data.position,
          duration: data.duration,
          buffered: data.buffered,
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
    ];

    return () => {
      subs.forEach(s => s.remove());
    };
  }, []);

  const playAlbum = useCallback(
    (albumId: string, startIndex = 0, shuffle = false) => {
      setState(s => ({...s, containerId: albumId}));
      return musicPlayer.playAlbum(albumId, startIndex, shuffle);
    },
    [],
  );

  const playPlaylist = useCallback(
    (playlistId: string, startIndex = 0, shuffle = false) => {
      setState(s => ({...s, containerId: playlistId}));
      return musicPlayer.playPlaylist(playlistId, startIndex, shuffle);
    },
    [],
  );

  const playStation = useCallback(
    (stationId: string) => {
      setState(s => ({...s, containerId: stationId}));
      return musicPlayer.playStation(stationId);
    },
    [],
  );

  const playSong = useCallback(
    (songId: string) => {
      setState(s => ({...s, containerId: songId}));
      return musicPlayer.playSong(songId);
    },
    [],
  );

  const playMusicVideo = useCallback(
    (musicVideoId: string) => {
      setState(s => ({...s, containerId: musicVideoId}));
      return musicPlayer.playMusicVideo(musicVideoId);
    },
    [],
  );

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
    seekTo: musicPlayer.seekTo,
    setShuffleMode: musicPlayer.setShuffleMode,
    setRepeatMode: musicPlayer.setRepeatMode,
    isPlaying: state.playbackState === 'playing',
  };

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
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
