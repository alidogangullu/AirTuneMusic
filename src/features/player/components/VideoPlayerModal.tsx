import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Modal,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
  useTVEventHandler,
} from 'react-native';

import { useTranslation } from 'react-i18next';
import { MusicKitVideoWebView, MusicKitVideoWebViewRef } from './MusicKitVideoWebView';
import { NowPlayingProgressBar, ExternalProgressState } from './NowPlayingProgressBar';
import { VideoPlaybackControls } from './VideoPlaybackControls';
import type { VideoQueue } from '../hooks/usePlayer';
import { spacing, radius } from '../../../theme/layout';
import { lightColors as C } from '../../../theme/colors';

interface Props {
  queue: VideoQueue;
  tokens: { dev: string; user: string | null } | null;
  onClose: () => void;
}

export function VideoPlayerModal({ queue, tokens, onClose }: Readonly<Props>) {
  const { t } = useTranslation();
  const webViewRef = useRef<MusicKitVideoWebViewRef>(null);

  const [playbackState, setPlaybackState] = useState<string>('loading');
  const [currentIndex, setCurrentIndex] = useState(queue.startIndex);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    setShowControls(true);
    if (timerRef.current) clearTimeout(timerRef.current);

    // Don't auto-hide if currently loading
    if (playbackState === 'loading') return;

    timerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 5000);
  }, [playbackState]);

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

  /**
   * Trigger initial playback after WebView initial load.
   * IMPORTANT: Do NOT add resetTimer to the dependencies. 
   * resetTimer depends on playbackState, so including it would cause 
   * this effect to re-run when loading finishes, creating a double-load loop.
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      webViewRef.current?.playQueue(queue.ids, queue.startIndex);
      resetTimer();
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [resetTimer, playbackState]); // Include playbackState to trigger when loading finishes

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
            onError={(msg) => {
              setErrorMessage(
                msg.includes('restricted') || msg.includes('Content restricted')
                  ? t('videos.errorRestricted')
                  : t('videos.errorGeneric'),
              );
            }}
          />
        )}

        {/* Global dimming overlay — only when controls are active */}
        {showControls && (
          <>
            <View style={styles.dimOverlay} pointerEvents="none" />

            {/* Top bar */}
            <View style={styles.topBar}>

              <View style={styles.topTrackInfo}>
                <Text style={styles.topTitle} numberOfLines={1}>{currentTrack?.title ?? ''}</Text>
                <Text style={styles.topArtist} numberOfLines={1}>{currentTrack?.artistName ?? ''}</Text>
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
        {!!errorMessage && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorOverlayText}>{errorMessage}</Text>
          </View>
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
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  topTrackInfo: {
    paddingTop: spacing.sm,
    flexDirection: 'column',
    alignItems: 'flex-start',
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
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  errorOverlayText: {
    color: C.onDarkTextPrimary,
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
