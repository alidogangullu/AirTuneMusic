import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useTVEventHandler,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MusicKitVideoWebView, MusicKitVideoWebViewRef } from './MusicKitVideoWebView';
import { NowPlayingProgressBar, ExternalProgressState } from './NowPlayingProgressBar';
import { VideoPlaybackControls } from './VideoPlaybackControls';
import type { VideoQueue } from '../hooks/usePlayer';
import { spacing, radius } from '../theme/layout';
import { lightColors as C } from '../theme/colors';

interface Props {
  queue: VideoQueue;
  tokens: { dev: string; user: string | null } | null;
  onClose: () => void;
}

export function VideoPlayerModal({ queue, tokens, onClose }: Readonly<Props>) {
  const webViewRef = useRef<MusicKitVideoWebViewRef>(null);

  const [playbackState, setPlaybackState] = useState<string>('loading');
  const [currentIndex, setCurrentIndex] = useState(queue.startIndex);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  }, []);

  useTVEventHandler((evt) => {
    // Show controls on any remote interaction
    if (evt.eventType && !['blur', 'focus'].includes(evt.eventType)) {
      resetTimer();
    }
  });

  const isPlaying = playbackState === 'playing';
  const isLoading = playbackState === 'loading';

  const currentTrack = queue.tracks[currentIndex];

  const canNext = currentIndex < queue.ids.length - 1;
  const canPrev = currentIndex > 0;

  // Trigger initial playback after WebView loads
  useEffect(() => {
    const timer = setTimeout(() => {
      webViewRef.current?.playQueue(queue.ids, queue.startIndex);
      resetTimer();
    }, 1500);
    return () => clearTimeout(timer);
  }, [queue, resetTimer]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer]);

  const handleClose = useCallback(() => {
    webViewRef.current?.stop();
    onClose();
  }, [onClose]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [handleClose]);

  const handleNext = useCallback(() => {
    if (!canNext) return;
    webViewRef.current?.skipToNext();
    setCurrentIndex(i => i + 1);
  }, [canNext]);

  const handlePrev = useCallback(() => {
    if (!canPrev) return;
    webViewRef.current?.skipToPrevious();
    setCurrentIndex(i => i - 1);
  }, [canPrev]);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      webViewRef.current?.pause();
      setPlaybackState('paused');
    } else {
      webViewRef.current?.play();
      setPlaybackState('playing');
    }
  }, [isPlaying]);

  // Wire external progress state into NowPlayingProgressBar
  const progressBarRef = useRef<View>(null);
  const [controlsNode, setControlsNode] = useState<number | null>(null);

  const externalProgress: ExternalProgressState = {
    position,
    duration,
    isPlaying,
    onSeekTo: (ms) => webViewRef.current?.seekTo(ms),
    onPlay: () => { webViewRef.current?.play(); setPlaybackState('playing'); },
    onPause: () => { webViewRef.current?.pause(); setPlaybackState('paused'); },
  };

  return (
    <Modal
      visible
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={handleClose}>
      <View style={styles.root}>
        {/* Video WebView — full screen */}
        {tokens && (
          <MusicKitVideoWebView
            ref={webViewRef}
            developerToken={tokens.dev}
            musicUserToken={tokens.user}
            onPlaybackStateChanged={setPlaybackState}
            onProgressChanged={({ position: pos, duration: dur }) => {
              setPosition(pos);
              setDuration(dur);
            }}
            onQueueIndexChanged={setCurrentIndex}
          />
        )}

        {/* Global dimming overlay — only when controls are active */}
        {showControls && (
          <>
            <View style={styles.dimOverlay} pointerEvents="none" />

            {/* Top bar */}
            <View style={styles.topBar}>

              <View style={styles.topTrackInfo}>
                {currentTrack?.artworkUrl && (
                  <Image source={{ uri: currentTrack.artworkUrl }} style={styles.topArtwork} />
                )}
                <View style={styles.topTextContainer}>
                  <Text style={styles.topTitle} numberOfLines={1}>{currentTrack?.title ?? ''}</Text>
                  <Text style={styles.topArtist} numberOfLines={1}>{currentTrack?.artistName ?? ''}</Text>
                </View>
              </View>
            </View>

            {/* Footer — same layout as NowPlayingScreen */}
            <View style={styles.footerContainer}>
              <View
                onLayout={() => setControlsNode(findNodeHandle(progressBarRef.current))}>
                <VideoPlaybackControls
                  isPlaying={isPlaying}
                  isLoading={isLoading}
                  canPrev={canPrev}
                  canNext={canNext}
                  onPrev={handlePrev}
                  onNext={handleNext}
                  onPlayPause={handlePlayPause}
                  nextFocusDown={findNodeHandle(progressBarRef.current)}
                  onLayoutPlayPause={(node) => setControlsNode(node)}
                />
              </View>

              <NowPlayingProgressBar
                isLiveRadio={false}
                isLoading={isLoading}
                isBuffering={false}
                isPlaying={isPlaying}
                external={externalProgress}
                showExtras={false}
                playbackControlsNode={controlsNode}
                progressBarRef={progressBarRef}
              />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },
  topTrackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  topArtwork: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
  },
  topTextContainer: {
    flex: 1,
  },
  topTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onDarkTextPrimary,
  },
  topArtist: {
    fontSize: 13,
    color: C.onDarkTextSecondary,
    marginTop: 2,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.md,
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
});
