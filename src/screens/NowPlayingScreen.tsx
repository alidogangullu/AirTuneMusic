/**
 * Now Playing screen — full-screen player with artwork, progress bar,
 * and dynamic gradient background extracted from artwork colors.
 *
 * Progress bar is fully interactive via Android TV remote:
 *   - OK/Select   → play/pause toggle (or confirm seek when scrubbing)
 *   - D-pad Left  → scrub -5 s
 *   - D-pad Right → scrub +5 s
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useTVEventHandler,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { NowPlayingBars } from '../components/NowPlayingBars';
import { useImageColors } from '../hooks/useImageColors';
import { usePlayer } from '../hooks/usePlayer';
import { spacing } from '../theme/layout';

const SEEK_STEP_MS = 5000;

// ── Helpers ──────────────────────────────────────────────────────

function formatTime(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Component ────────────────────────────────────────────────────

interface NowPlayingScreenProps {
  onBack?: () => void;
}

export function NowPlayingScreen({ onBack }: Readonly<NowPlayingScreenProps>): React.JSX.Element {
  const { state, play, pause, seekTo } = usePlayer();
  const { track, position, duration, playbackState } = state;
  const isPlaying = playbackState === 'playing';
  const hasTrack = track !== null && playbackState !== 'stopped';
  const palette = useImageColors(track?.artworkUrl);
  const paletteLoading = track?.artworkUrl && !palette;

  // ── Interactive progress bar state ──────────────────────────────
  const [isFocused, setIsFocused] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [pendingSeekMs, setPendingSeekMs] = useState(0);

  // Animated values for focus feedback
  const barHeightAnim = useRef(new Animated.Value(3)).current;
  const knobSizeAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(barHeightAnim, {
        toValue: isFocused ? 6 : 3,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.timing(knobSizeAnim, {
        toValue: isFocused ? 16 : 10,
        duration: 150,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isFocused, barHeightAnim, knobSizeAnim]);

  // Keep latest scrubbing state in refs so useTVEventHandler callback doesn't go stale
  const isFocusedRef = useRef(false);
  const isScrubbingRef = useRef(false);
  const pendingSeekMsRef = useRef(0);
  const positionRef = useRef(position);
  const durationRef = useRef(duration);

  positionRef.current = position;
  durationRef.current = duration;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    isFocusedRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    isFocusedRef.current = false;
    setIsScrubbing(false);
    isScrubbingRef.current = false;
    setPendingSeekMs(0);
    pendingSeekMsRef.current = 0;
  }, []);

  const handlePress = useCallback(() => {
    if (isScrubbingRef.current) {
      // Confirm seek
      seekTo(pendingSeekMsRef.current);
      setIsScrubbing(false);
      isScrubbingRef.current = false;
      setPendingSeekMs(0);
      pendingSeekMsRef.current = 0;
    } else {
      // Toggle play/pause
      if (isPlaying) {
        pause();
      } else {
        play();
      }
    }
  }, [isPlaying, seekTo, play, pause]);

  // D-pad left/right: scrub ±5 s when progress bar is focused
  useTVEventHandler(useCallback((evt: { eventType: string }) => {
    if (!isFocusedRef.current) return;
    if (evt.eventType !== 'left' && evt.eventType !== 'right') return;
    const base = isScrubbingRef.current ? pendingSeekMsRef.current : positionRef.current;
    const delta = evt.eventType === 'right' ? SEEK_STEP_MS : -SEEK_STEP_MS;
    const next = Math.max(0, Math.min(durationRef.current, base + delta));
    pendingSeekMsRef.current = next;
    isScrubbingRef.current = true;
    setPendingSeekMs(next);
    setIsScrubbing(true);
  }, []));

  // Handle back button (remote) in fullscreen mode
  useEffect(() => {
    if (!onBack) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  // Animate artwork scale on track change
  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [track?.title, scaleAnim]);

  // Background colors derived from artwork
  const bg1 = palette?.darkMuted || palette?.dominant || '#1a1a2e';
  const bg2 = palette?.darkVibrant || palette?.muted || '#16213e';
  const accentColor = palette?.vibrant || palette?.lightVibrant || '#fa243c';

  const progress = duration > 0 ? position / duration : 0;
  const remainingMs = duration > 0 ? duration - position : 0;

  // Scrub indicator progress (pending seek position)
  const scrubProgress = duration > 0 ? pendingSeekMs / duration : 0;

  if (!track) {
    // Select music warning
    return (
      <LinearGradient
        colors={["#c1d5f3", "#bfc0c6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.root}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, color: '#333', fontWeight: '600' }}>Select a song to play.</Text>
        </View>
      </LinearGradient>
    );
  }
  if (!hasTrack || paletteLoading) {
    const LoadingIndicator = require('../components/LoadingIndicator').LoadingIndicator;
    return (
      <LinearGradient
        colors={["#c1d5f3", "#bfc0c6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.root}
      >
        <LoadingIndicator />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[bg1, bg2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}>
      {/* Centered content: artwork + track info */}
      <View style={styles.content}>
        <Animated.View style={[styles.artworkShadow, { transform: [{ scale: scaleAnim }] }]}>
          {track?.artworkUrl ? (
            <Image
              source={{ uri: track.artworkUrl }}
              style={styles.artwork}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.artwork, styles.artworkPlaceholder]} />
          )}
        </Animated.View>

        {/* Track info below artwork, aligned with artwork width */}
        <View style={styles.meta}>
          <View style={styles.titleRow}>
            <NowPlayingBars playing={isPlaying} color={accentColor} size={16} />
            <Text style={styles.title} numberOfLines={1}>
              {track?.title ?? ''}
            </Text>
          </View>
          <Text style={styles.artist} numberOfLines={1}>
            {track?.artistName ?? ''}
          </Text>
        </View>
      </View>

      {/* Progress bar — full width at screen bottom */}
      <Pressable
        style={styles.progressContainer}
        focusable={true}
        hasTVPreferredFocus={false}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPress={handlePress}
        accessibilityLabel="Progress bar"
        accessibilityRole="adjustable">
        {({ focused }) => (
          <>
            <Animated.View
              style={[
                styles.progressTrack,
                { height: barHeightAnim },
                focused && styles.progressTrackFocused,
              ]}>
              {/* Playback fill */}
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: accentColor },
                ]}
              />
              {/* Scrub indicator (only when scrubbing) */}
              {isScrubbing && (
                <View
                  style={[
                    styles.progressFill,
                    styles.scrubFill,
                    { width: `${scrubProgress * 100}%` },
                  ]}
                />
              )}
              {/* Playback knob */}
              <Animated.View
                style={[
                  styles.progressKnob,
                  {
                    left: `${progress * 100}%` as unknown as number,
                    backgroundColor: accentColor,
                    width: knobSizeAnim,
                    height: knobSizeAnim,
                    borderRadius: Animated.divide(knobSizeAnim, 2) as unknown as number,
                    marginLeft: Animated.multiply(knobSizeAnim, -0.5) as unknown as number,
                    top: Animated.multiply(Animated.subtract(knobSizeAnim, barHeightAnim), -0.5) as unknown as number,
                  },
                ]}
              />
              {/* Scrub knob (pending position) */}
              {isScrubbing && (
                <Animated.View
                  style={[
                    styles.progressKnob,
                    {
                      left: `${scrubProgress * 100}%` as unknown as number,
                      backgroundColor: '#fff',
                      width: knobSizeAnim,
                      height: knobSizeAnim,
                      borderRadius: Animated.divide(knobSizeAnim, 2) as unknown as number,
                      marginLeft: Animated.multiply(knobSizeAnim, -0.5) as unknown as number,
                      top: Animated.multiply(Animated.subtract(knobSizeAnim, barHeightAnim), -0.5) as unknown as number,
                    },
                  ]}
                />
              )}
            </Animated.View>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>
                {isScrubbing ? formatTime(pendingSeekMs) : formatTime(position)}
              </Text>
              <Text style={[styles.timeText, isScrubbing && styles.timeTextScrubbing]}>
                {isScrubbing
                  ? `→ ${formatTime(pendingSeekMs)}`
                  : `-${formatTime(remainingMs)}`}
              </Text>
            </View>
          </>
        )}
      </Pressable>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const ARTWORK_SIZE = 260;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  emptyRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.5)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
  },
  // Artwork
  artworkShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 20,
  },
  artwork: {
    width: ARTWORK_SIZE,
    height: ARTWORK_SIZE,
  },
  artworkPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  // Meta: track info aligned with artwork
  meta: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  // Title row: bars + title inline
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    flexShrink: 1,
  },
  artist: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  // Progress — full width at bottom
  progressContainer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
    // Extra vertical padding so the focus highlight / knob are not clipped
    paddingTop: spacing.lg,
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'visible',
  },
  progressTrackFocused: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 3,
  },
  scrubFill: {
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  progressKnob: {
    position: 'absolute',
  },
  timeTextScrubbing: {
    color: '#fff',
    fontWeight: '700',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontVariant: ['tabular-nums'],
  },
});
