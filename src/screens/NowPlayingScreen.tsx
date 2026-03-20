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
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useTVEventHandler,
  View,
  FlatList,
  Dimensions,
  findNodeHandle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { NowPlayingBars } from '../components/NowPlayingBars';
import { useImageColors } from '../hooks/useImageColors';
import { usePlayer } from '../hooks/usePlayer';
import { PlaybackControls } from '../components/PlaybackControls';
import { ContentNavigationContext } from '../navigation';
import { radius, spacing } from '../theme/layout';
import { useStorefront } from '../hooks/useStorefront';
import { fetchSongDetail } from '../api/apple-music/recommendations';
import { TrackInfo } from '../services/musicPlayer';

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

  // ── Focus & Navigation ──────────────────────────────────────────
  const progressBarRef = useRef<View>(null);
  const infoButtonRef = useRef<View>(null);
  const queueButtonRef = useRef<View>(null);
  const playbackControlsRef = useRef<View>(null);

  const [progressBarNode, setProgressBarNode] = useState<number | null>(null);
  const [playbackControlsNode, setPlaybackControlsNode] = useState<number | null>(null);
  const [infoButtonNode, setInfoButtonNode] = useState<number | null>(null);
  const [queueButtonNode, setQueueButtonNode] = useState<number | null>(null);

  // ── Interactive progress bar state ──────────────────────────────
  const [isFocused, setIsFocused] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [pendingSeekMs, setPendingSeekMs] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const queueListRef = useRef<FlatList>(null);

  const { pushContent } = React.useContext(ContentNavigationContext);
  const { storefrontId } = useStorefront();

  // Animated values for focus feedback
  const barHeightAnim = useRef(new Animated.Value(3)).current;
  const knobSizeAnim = useRef(new Animated.Value(10)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current; // -1 to 1 (left to right)

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

  // Shimmer animation loop
  useEffect(() => {
    const isBuffering = state.buffering || state.isLoading;
    if (isBuffering) {
      Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        })
      ).start();
    } else {
      shimmerAnim.stopAnimation();
      shimmerAnim.setValue(-1);
    }
  }, [state.buffering, state.isLoading, shimmerAnim]);

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
    if (state.buffering || state.isLoading) return; // Prevent interaction during track transition
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
  }, [isPlaying, seekTo, play, pause, state.buffering, state.isLoading]);

  // D-pad left/right: scrub ±5 s when progress bar is focused
  useTVEventHandler(useCallback((evt: { eventType: string }) => {
    if (!isFocusedRef.current) return;
    if (state.buffering || state.isLoading) return; // Disable scrubbing during track transition
    if (evt.eventType !== 'left' && evt.eventType !== 'right') return;
    const base = isScrubbingRef.current ? pendingSeekMsRef.current : positionRef.current;
    const delta = evt.eventType === 'right' ? SEEK_STEP_MS : -SEEK_STEP_MS;
    const next = Math.max(0, Math.min(durationRef.current, base + delta));
    pendingSeekMsRef.current = next;
    isScrubbingRef.current = true;
    setPendingSeekMs(next);
    setIsScrubbing(true);
  }, [state.buffering, state.isLoading]));

  // Handle back button (remote) in fullscreen mode
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showQueue) {
        setShowQueue(false);
        return true;
      }
      if (showInfo) {
        setShowInfo(false);
        return true;
      }
      if (onBack) {
        onBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [onBack, showInfo, showQueue]);

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

  const activeIndex = state.queue.findIndex(
    item => item.playbackQueueId === (state.track as any)?.playbackQueueId
  );

  // Keep queue centered on track/queue changes
  const lastQueueRef = useRef(state.queue);
  useEffect(() => {
    if (showQueue && activeIndex >= 0 && queueListRef.current) {
      const queueChanged = lastQueueRef.current !== state.queue;
      lastQueueRef.current = state.queue;
      
      queueListRef.current.scrollToOffset({
        offset: activeIndex * (ARTWORK_SIZE + 20),
        animated: !queueChanged, // Instant on shuffle/queue updates, smooth on track skip
      });
    }
  }, [activeIndex, state.queue, showQueue]);

  // Background colors derived from artwork
  const bg1 = palette?.darkMuted || palette?.dominant || '#1a1a2e';
  const bg2 = palette?.darkVibrant || palette?.muted || '#16213e';
  const accentColor = palette?.vibrant || palette?.lightVibrant || '#fa243c';

  const progress = duration > 0 ? position / duration : 0;
  const remainingMs = duration > 0 ? duration - position : 0;

  // Scrub indicator progress (pending seek position)
  const scrubProgress = duration > 0 ? pendingSeekMs / duration : 0;

  if (!track) {
    if (state.isLoading) {
      // Something is loading but track info isn't available yet
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

      {/* Centered content: artwork OR queue + track info */}
      <View style={styles.content}>
        {!showQueue ? (
          <><Animated.View style={[styles.artworkShadow, { transform: [{ scale: scaleAnim }] }]}>
            {track?.artworkUrl ? (
              <Image
                source={{ uri: track.artworkUrl }}
                style={styles.artwork}
                resizeMode="cover" />
            ) : (
              <View style={[styles.artwork, styles.artworkPlaceholder]} />
            )}
          </Animated.View><View style={[styles.meta, { opacity: showInfo ? 0 : 1 }]}>
              <View style={styles.titleRow}>
                <NowPlayingBars playing={isPlaying && !state.isLoading && !state.buffering} color={accentColor} size={16} />
                <Text style={styles.title} numberOfLines={1}>
                  {track?.title ?? ''}
                </Text>
              </View>
              <Text style={styles.artist} numberOfLines={1}>
                {track?.artistName ?? ''}
              </Text>
            </View></>
        ) : (
          <View style={styles.integratedQueueContainer}>
            <FlatList
              key={`queue-${state.shuffleMode}`} // Force remount on shuffle to apply initialScrollIndex instantly
              ref={queueListRef}
              data={state.queue}
              horizontal
              keyExtractor={(item) => item.playbackQueueId?.toString() ?? item.id}
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={true}
              initialNumToRender={5}
              maxToRenderPerBatch={5}
              windowSize={7}
              contentContainerStyle={[styles.queueListContent, { paddingHorizontal: HORIZONTAL_PADDING }]}
              initialScrollIndex={activeIndex >= 0 ? activeIndex : 0}
              contentOffset={{ x: Math.max(0, activeIndex) * (ARTWORK_SIZE + 20), y: 0 }}
              getItemLayout={(_, index) => ({
                length: ARTWORK_SIZE + 20, // artwork width (260) + gap (20)
                offset: (ARTWORK_SIZE + 20) * index,
                index,
              })}
              renderItem={({ item }) => {
                const isCurrent = item.playbackQueueId === (state.track as any)?.playbackQueueId;
                return (
                  <View style={styles.queueItemContainer}>
                    <View style={styles.artworkShadow}>
                      <View style={styles.artwork}>
                        {item.artworkUrl ? (
                          <Image
                            source={{ uri: item.artworkUrl }}
                            style={styles.artwork}
                          />
                        ) : (
                          <View style={[styles.artwork, styles.artworkPlaceholder]} />
                        )}
                      </View>
                    </View>
                    <View style={[styles.meta, { opacity: showInfo ? 0 : 1 }]}>
                      <View style={styles.titleRow}>
                        {isCurrent && (
                          <NowPlayingBars playing={isPlaying && !state.isLoading && !state.buffering} color={accentColor} size={16} />
                        )}
                        <Text style={styles.title} numberOfLines={1}>
                          {item?.title ?? ''}
                        </Text>
                      </View>
                      <Text style={styles.artist} numberOfLines={1}>
                        {item?.artistName ?? ''}
                      </Text>
                    </View>
                  </View>
                );
              }}
            />
          </View>
        )}

        {/*
        <View style={[styles.meta, { opacity: showInfo ? 0 : 1 }]}>
          <View style={styles.titleRow}>
            <NowPlayingBars playing={isPlaying && !state.isLoading && !state.buffering} color={accentColor} size={16} />
            <Text style={styles.title} numberOfLines={1}>
              {track?.title ?? ''}
            </Text>
          </View>
          <Text style={styles.artist} numberOfLines={1}>
            {track?.artistName ?? ''}
          </Text>
        </View>
        */}
      </View>


      {/* Info Modal Panel */}
      <Modal
        visible={showInfo}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowInfo(false)}>
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowInfo(false)}
          focusable={false}>
          <View style={styles.infoMenuContainer}>
            <View style={styles.infoCard}>
              <Image
                source={{ uri: track.artworkUrl ?? '' }}
                style={styles.infoArtwork}
              />
              <View style={styles.infoMeta}>
                <Text style={styles.infoTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.infoArtistAlbum} numberOfLines={1}>
                  {track.artistName} — {track.albumTitle}
                </Text>
                <Text style={styles.infoDuration}>
                  {Math.floor(track.duration / 60000)} min, {Math.floor((track.duration % 60000) / 1000)} secs
                </Text>
              </View>
              <Pressable
                style={({ focused }) => [
                  styles.gotoAlbumButton,
                  focused && styles.gotoAlbumButtonFocused,
                ]}
                hasTVPreferredFocus={showInfo}
                onPress={async () => {
                  if (track?.id) {
                    try {
                      const detail = await fetchSongDetail(track.id, storefrontId);
                      const albumId = detail.data[0]?.relationships?.albums?.data?.[0]?.id;

                      if (albumId) {
                        pushContent({
                          id: albumId,
                          type: 'albums',
                          attributes: {
                            name: track.albumTitle ?? '',
                          },
                        });
                        setShowInfo(false); // Close the info card
                      }
                    } catch (e) {
                      console.warn('NowPlayingScreen: Failed to fetch album ID:', e);
                      // Fallback: try containerId if available
                      if (state.containerId) {
                        pushContent({
                          id: state.containerId,
                          type: 'albums',
                          attributes: {
                            name: track.albumTitle ?? '',
                          },
                        });
                        setShowInfo(false);
                      }
                    }
                  }
                }}
                focusable={true}>
                {({ focused }) => (
                  <Text style={[styles.gotoAlbumText, focused && styles.gotoAlbumTextFocused]}>
                    Go to Album
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Progress and Info footer — at screen bottom */}
      <View style={styles.footerContainer}>
        {!showInfo && (
          <>
            <View
              ref={playbackControlsRef}
              onLayout={() => setPlaybackControlsNode(findNodeHandle(playbackControlsRef.current))}>
              <PlaybackControls 
                nextFocusDown={progressBarNode} 
                onLayoutButton={(node) => setPlaybackControlsNode(node)}
              />
            </View>
            <Pressable
              ref={progressBarRef}
              onLayout={() => setProgressBarNode(findNodeHandle(progressBarRef.current))}
              style={styles.progressContainer}
              nextFocusUp={playbackControlsNode}
              nextFocusDown={infoButtonNode}
              focusable={true}
              hasTVPreferredFocus={false}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onPress={handlePress}
              accessibilityLabel="Progress bar"
              accessibilityRole="adjustable">
              {({ focused }) => (
                <Animated.View
                  style={[
                    styles.progressTrack,
                    { height: barHeightAnim, overflow: 'visible' },
                    focused && styles.progressTrackFocused,
                  ]}>
                  {/* Clipped content wrapper */}
                  <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 3 }]}>
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
                    {/* Shimmer effect for buffering */}
                    {(state.buffering || state.isLoading) && (
                      <Animated.View
                        style={[
                          styles.shimmerContainer,
                          {
                            transform: [
                              {
                                translateX: shimmerAnim.interpolate({
                                  inputRange: [-1, 1],
                                  outputRange: [-250, 1200],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <LinearGradient
                          colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                          start={{ x: 0, y: 0.5 }}
                          end={{ x: 1, y: 0.5 }}
                          style={styles.shimmerGradient}
                        />
                      </Animated.View>
                    )}
                  </View>

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
                  {/* Scrub knob */}
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
              )}
            </Pressable>

            <View style={styles.timeRow}>
              <View style={styles.timeInfoColumn}>
                <Text style={styles.timeText}>
                  {isScrubbing ? formatTime(pendingSeekMs) : formatTime(position)}
                </Text>
                <Pressable
                  ref={infoButtonRef}
                  onLayout={() => setInfoButtonNode(findNodeHandle(infoButtonRef.current))}
                  style={({ focused }) => [
                    styles.infoButton,
                    focused && styles.infoButtonFocused,
                  ]}
                  nextFocusUp={progressBarNode}
                  onPress={() => setShowInfo(true)}
                  focusable={true}>
                  {({ focused }) => (
                    <Text style={[styles.infoButtonText, focused && styles.infoButtonTextFocused]}>
                      Info
                    </Text>
                  )}
                </Pressable>
              </View>

              <View style={styles.timeInfoColumnRight}>
                <Text style={[styles.timeText, isScrubbing && styles.timeTextScrubbing]}>
                  {isScrubbing
                    ? `${formatTime(pendingSeekMs)}`
                    : `-${formatTime(remainingMs)}`}
                </Text>
                <Pressable
                  ref={queueButtonRef}
                  onLayout={() => setQueueButtonNode(findNodeHandle(queueButtonRef.current))}
                  style={({ focused }) => [
                    styles.infoButton,
                    focused && styles.infoButtonFocused,
                    { alignSelf: 'flex-end', marginRight: -spacing.sm },
                  ]}
                  nextFocusUp={progressBarNode}
                  onPress={() => setShowQueue(!showQueue)}
                  focusable={true}>
                  {({ focused }) => {
                    const iconColor = showQueue || focused ? '#fff' : 'rgba(255, 255, 255, 0.7)';
                    return (
                      <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M3 12h18" />
                        <Path d="M3 6h18" />
                        <Path d="M3 18h18" />
                      </Svg>
                    );
                  }}
                </Pressable>
              </View>
            </View>
          </>
        )}
      </View>
    </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_SIZE = 260;
const HORIZONTAL_PADDING = (SCREEN_WIDTH - ARTWORK_SIZE) / 2;

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
    paddingBottom: 25, // Match typical footer height to keep centering consistent
  },
  headerSection: {
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xl,
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
    paddingBottom: spacing.sm,
    // Extra vertical padding so the focus highlight / knob are not clipped
    paddingTop: spacing.lg,
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
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
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 200,
  },
  shimmerGradient: {
    flex: 1,
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
    color: 'rgba(255,255,255,0.5)',
    fontVariant: ['tabular-nums'],
  },
  footerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.md,
  },
  infoButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    alignSelf: 'flex-start',
    marginLeft: -spacing.sm, // Align text with time above
  },
  infoButtonFocused: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  infoButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
  },
  infoButtonTextFocused: {
    color: '#fff',
  },
  // Info Menu
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  infoMenuContainer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  infoArtwork: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
  },
  infoMeta: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  infoArtistAlbum: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  infoDuration: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  losslessBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignSelf: 'flex-start',
  },
  losslessText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gotoAlbumButton: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginLeft: spacing.lg,
  },
  gotoAlbumButtonFocused: {
    backgroundColor: '#fff',
    transform: [{ scale: 1.05 }],
  },
  gotoAlbumText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  gotoAlbumTextFocused: {
    fontWeight: '700',
    color: '#000',
  },
  // Queue View
  integratedQueueContainer: {
    width: '100%',
    height: ARTWORK_SIZE + 80,
    justifyContent: 'center',
  },
  queueItemContainer: {
    marginRight: 20,
    alignItems: 'center',
    width: ARTWORK_SIZE,
  },
  queueContainer: {
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  // List content
  queueListContent: {
    // Center items vertically within the ARTWORK_SIZE container
    justifyContent: 'center',
  },
});
