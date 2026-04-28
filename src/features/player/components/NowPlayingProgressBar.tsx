import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { usePlayer, usePlaybackProgress } from '../hooks/usePlayer';
import { LyricIcon } from './LyricIcon';
import { spacing, radius } from '../../../theme/layout';
import { lightColors as C } from '../../../theme/colors';

const SEEK_STEP_MS = 5000;

function formatTime(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** When provided, overrides hook-based state (used by VideoPlayerModal). */
export interface ExternalProgressState {
  position: number;
  duration: number;
  isPlaying: boolean;
  onSeekTo: (ms: number) => void;
  onPlay: () => void;
  onPause: () => void;
}

interface NowPlayingProgressBarProps {
  isLiveRadio: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  isPlaying: boolean;
  /** When provided, component uses external state instead of usePlayer/usePlaybackProgress */
  external?: ExternalProgressState;
  /** Hide info/lyrics/queue extra buttons (for video player) */
  showExtras?: boolean;
  playbackControlsNode?: number | null;
  infoButtonNode?: number | null;
  onSetInfoButtonNode?: (node: number | null) => void;
  onOpenInfo?: () => void;
  showLyrics?: boolean;
  onToggleLyrics?: () => void;
  showQueue?: boolean;
  onToggleQueue?: () => void;
  progressBarRef?: React.RefObject<View | null>;
  onLayoutProgress?: () => void;
}

export const NowPlayingProgressBar = React.memo(({
  isLiveRadio,
  isLoading,
  isBuffering,
  isPlaying,
  external,
  showExtras = true,
  playbackControlsNode,
  infoButtonNode,
  onSetInfoButtonNode,
  onOpenInfo,
  showLyrics,
  onToggleLyrics,
  showQueue,
  onToggleQueue,
  progressBarRef: externalProgressBarRef,
  onLayoutProgress,
}: NowPlayingProgressBarProps) => {
  const { t } = useTranslation();

  // Native player hooks — only used when external is not provided
  const nativePlayer = usePlayer();
  const nativeProgress = usePlaybackProgress();

  const position = external?.position ?? nativeProgress.position;
  const duration = external?.duration ?? nativeProgress.duration;
  const seekTo = external?.onSeekTo ?? nativePlayer.seekTo;
  const play = external?.onPlay ?? nativePlayer.play;
  const pause = external?.onPause ?? nativePlayer.pause;

  const [isFocused, setIsFocused] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [pendingSeekMs, setPendingSeekMs] = useState(0);

  const shimmerAnim = useRef(new Animated.Value(-1)).current;
  const fillOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isBuffering || isLoading) {
      Animated.loop(
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
      ).start();
    } else {
      shimmerAnim.stopAnimation();
      shimmerAnim.setValue(-1);
    }
  }, [isBuffering, isLoading, shimmerAnim]);

  const isFocusedRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const pendingSeekMsRef = useRef(0);
  const positionRef = useRef(position);
  const durationRef = useRef(duration);

  isFocusedRef.current = isFocused;
  isScrubbingRef.current = isScrubbing;
  positionRef.current = position;
  durationRef.current = duration;
  pendingSeekMsRef.current = pendingSeekMs;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    Animated.timing(fillOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [fillOpacity]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setIsScrubbing(false);
    setPendingSeekMs(0);
    Animated.timing(fillOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
  }, [fillOpacity]);

  const handlePress = useCallback(() => {
    if (isBuffering || isLoading) return;
    if (isScrubbingRef.current) {
      seekTo(pendingSeekMsRef.current);
      setIsScrubbing(false);
      setPendingSeekMs(0);
      if (!isPlaying) play();
    } else {
      isPlaying ? pause() : play();
    }
  }, [isPlaying, isBuffering, isLoading, seekTo, play, pause]);

  // Import useTVEventHandler inline — only for D-pad scrubbing
  const { useTVEventHandler } = require('react-native');
  useTVEventHandler(useCallback((evt: { eventType: string }) => {
    if (!isFocusedRef.current || isBuffering || isLoading || isLiveRadio) return;
    if (evt.eventType !== 'left' && evt.eventType !== 'right') return;
    const base = isScrubbingRef.current ? pendingSeekMsRef.current : positionRef.current;
    const delta = evt.eventType === 'right' ? SEEK_STEP_MS : -SEEK_STEP_MS;
    const next = Math.max(0, Math.min(durationRef.current, base + delta));
    setPendingSeekMs(next);
    setIsScrubbing(true);
  }, [isBuffering, isLoading, isLiveRadio]));

  const progress = (duration > 0 && !isLiveRadio) ? position / duration : 0;
  const remainingMs = (duration > 0 && !isLiveRadio) ? duration - position : 0;
  const scrubProgress = (duration > 0 && !isLiveRadio) ? pendingSeekMs / duration : 0;

  const internalProgressBarRef = useRef<View>(null);
  const progressBarRef = externalProgressBarRef ?? internalProgressBarRef;
  const infoButtonRef = useRef<View>(null);
  const queueButtonRef = useRef<View>(null);

  return (
    <View>
      <Pressable
        ref={progressBarRef}
        onLayout={onLayoutProgress}
        style={styles.progressContainer}
        nextFocusUp={playbackControlsNode ?? undefined}
        nextFocusDown={infoButtonNode ?? undefined}
        focusable={true}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPress={handlePress}
        accessibilityLabel={t('nowPlaying.progressBar')}
        accessibilityRole="adjustable">
        {({ focused }) => (
          <View style={[styles.progressTrack, focused && styles.progressTrackFocused]}>
            <View style={[StyleSheet.absoluteFill, styles.progressClip]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${isScrubbing ? scrubProgress * 100 : progress * 100}%`, opacity: fillOpacity },
                ]}
              />
              {(isBuffering || isLoading) && (
                <Animated.View
                  style={[
                    styles.shimmerContainer,
                    {
                      transform: [{
                        translateX: shimmerAnim.interpolate({
                          inputRange: [-1, 1],
                          outputRange: [-250, 1200],
                        }),
                      }],
                    },
                  ]}>
                  <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.shimmerGradient}
                  />
                </Animated.View>
              )}
            </View>
            <View
              style={[
                styles.progressKnob,
                { left: `${isScrubbing ? scrubProgress * 100 : progress * 100}%` as unknown as number },
                focused && styles.progressKnobFocused,
              ]}
            />
          </View>
        )}
      </Pressable>

      <View style={styles.timeRow}>
        <View style={styles.timeInfoColumn}>
          <Text style={styles.timeText}>
            {isScrubbing ? formatTime(pendingSeekMs) : formatTime(position)}
          </Text>
          {showExtras && onOpenInfo && (
            <Pressable
              ref={infoButtonRef}
              onLayout={() => onSetInfoButtonNode?.(findNodeHandle(infoButtonRef.current))}
              style={({ focused }) => [styles.infoButton, focused && styles.infoButtonFocused]}
              nextFocusUp={findNodeHandle(progressBarRef.current)}
              onPress={onOpenInfo}
              focusable={true}>
              {({ focused }) => (
                <Text style={[styles.infoButtonText, focused && styles.infoButtonTextFocused]}>
                  {t('nowPlaying.info')}
                </Text>
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.timeInfoColumnRight}>
          <Text style={[styles.timeText, isScrubbing && styles.timeTextScrubbing]}>
            {isScrubbing ? formatTime(pendingSeekMs) : `-${formatTime(remainingMs)}`}
          </Text>
          {showExtras && (
            <View style={styles.footerButtonsRight}>
              {onToggleLyrics && (
                <Pressable
                  style={({ focused }) => [
                    styles.infoButton,
                    showLyrics && !focused && styles.infoButtonActive,
                    focused && styles.infoButtonFocused,
                    { marginRight: spacing.md },
                  ]}
                  nextFocusUp={findNodeHandle(progressBarRef.current)}
                  onPress={onToggleLyrics}
                  focusable={true}>
                  {({ focused }) => (
                    <LyricIcon active={!!showLyrics} focused={focused} color={focused ? C.onDarkFocusedIcon : undefined} />
                  )}
                </Pressable>
              )}
              {onToggleQueue && (
                <Pressable
                  ref={queueButtonRef}
                  style={({ focused }) => [
                    styles.infoButton,
                    showQueue && !focused && styles.infoButtonActive,
                    focused && styles.infoButtonFocused,
                    { alignSelf: 'flex-end', marginRight: -spacing.sm },
                  ]}
                  nextFocusUp={findNodeHandle(progressBarRef.current)}
                  onPress={onToggleQueue}
                  focusable={true}>
                  {({ focused }) => {
                    const iconColor = focused ? C.onDarkFocusedIcon : (showQueue ? C.onDarkTextPrimary : C.onDarkTextFaint);
                    return (
                      <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M3 12h18" />
                        <Path d="M3 6h18" />
                        <Path d="M3 18h18" />
                      </Svg>
                    );
                  }}
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  progressContainer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.sm,
    paddingTop: spacing.lg,
  },
  progressTrack: {
    height: 6,
    backgroundColor: C.progressTrackBg,
    borderRadius: 3,
    overflow: 'visible',
  },
  progressTrackFocused: {
    height: 6,
  },
  progressClip: {
    overflow: 'hidden',
    borderRadius: 3,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    backgroundColor: C.scrubFillBg,
  },
  progressKnob: {
    position: 'absolute',
    width: 1,
    height: 6,
    marginLeft: -1,
    borderRadius: 2,
    backgroundColor: C.scrubKnobBg,
  },
  progressKnobFocused: {
    width: 1,
    height: 6,
    marginLeft: -1,
    borderRadius: 2,
  },
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 200,
  },
  shimmerGradient: {
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
  },
  timeInfoColumn: {
    alignItems: 'flex-start',
  },
  timeInfoColumnRight: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    color: C.onDarkTextMuted,
    fontVariant: ['tabular-nums'],
  },
  timeTextScrubbing: {
    color: C.onDarkTextPrimary,
    fontWeight: '700',
  },
  footerButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginLeft: -spacing.sm,
  },
  infoButtonFocused: {
    backgroundColor: C.scrubKnobBg,
  },
  infoButtonActive: {
    backgroundColor: C.onDarkButtonActiveBg,
  },
  infoButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onDarkTextFaint,
  },
  infoButtonTextFocused: {
    color: C.onDarkFocusedIcon,
  },
});
