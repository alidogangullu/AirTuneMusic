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
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import LinearGradient from 'react-native-linear-gradient';
import { useImageColors } from '../hooks/useImageColors';
import { usePlayer, usePlaybackProgress } from '../hooks/usePlayer';
import { PlaybackControls } from '../components/PlaybackControls';
import { ContentNavigationContext } from '../navigation';
import { radius, spacing } from '../theme/layout';
import { lightColors as C } from '../theme/colors';
import { useTheme } from '../theme';
import { useStorefront } from '../hooks/useStorefront';
import { fetchSongDetail } from '../api/apple-music/recommendations';
import { LyricsView } from '../components/LyricsView';
import { LyricIcon } from '../components/LyricIcon';
import { NowPlayingTrackInfo, ARTWORK_SIZE } from '../components/NowPlayingTrackInfo';

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
  isTabView?: boolean;
}

// ── Sub-component: Progress Bar & Time ─────────────────────────────

interface ProgressBarProps {
  accentColor: string;
  isLiveRadio: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  isPlaying: boolean;
  playbackControlsNode: number | null;
  infoButtonNode: number | null;
  onSetInfoButtonNode: (node: number | null) => void;
  onOpenInfo: () => void;
  showLyrics: boolean;
  onToggleLyrics: () => void;
  showQueue: boolean;
  onToggleQueue: () => void;
  progressBarRef: React.RefObject<View | null>;
  onLayoutProgress: () => void;
}

const NowPlayingProgressBar = React.memo(({
  accentColor,
  isLiveRadio,
  isLoading,
  isBuffering,
  isPlaying,
  playbackControlsNode,
  infoButtonNode,
  onSetInfoButtonNode,
  onOpenInfo,
  showLyrics,
  onToggleLyrics,
  showQueue,
  onToggleQueue,
  progressBarRef,
  onLayoutProgress,
}: ProgressBarProps) => {
  const { t } = useTranslation();
  const { seekTo, play, pause } = usePlayer();
  const { position, duration } = usePlaybackProgress();
  
  const [isFocused, setIsFocused] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [pendingSeekMs, setPendingSeekMs] = useState(0);

  // Animated values for focus feedback
  const barHeightAnim = useRef(new Animated.Value(3)).current;
  const knobSizeAnim = useRef(new Animated.Value(10)).current;
  const shimmerAnim = useRef(new Animated.Value(-1)).current;

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

  useEffect(() => {
    if (isBuffering || isLoading) {
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

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    setIsScrubbing(false);
    setPendingSeekMs(0);
  }, []);

  const handlePress = useCallback(() => {
    if (isBuffering || isLoading) return;
    if (isScrubbingRef.current) {
      seekTo(pendingSeekMsRef.current);
      setIsScrubbing(false);
      setPendingSeekMs(0);
    } else {
      isPlaying ? pause() : play();
    }
  }, [isPlaying, isBuffering, isLoading, seekTo, play, pause]);

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

  const infoButtonRef = useRef<View>(null);
  const queueButtonRef = useRef<View>(null);

  return (
    <View>
      <Pressable
        ref={progressBarRef}
        onLayout={onLayoutProgress}
        style={styles.progressContainer}
        nextFocusUp={playbackControlsNode}
        nextFocusDown={infoButtonNode}
        focusable={true}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPress={handlePress}
        accessibilityLabel={t('nowPlaying.progressBar')}
        accessibilityRole="adjustable">
        {({ focused }) => (
          <Animated.View
            style={[
              styles.progressTrack,
              { height: barHeightAnim, overflow: 'visible' },
              focused && styles.progressTrackFocused,
            ]}>
            <View style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 3 }]}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${progress * 100}%`, backgroundColor: accentColor },
                ]}
              />
              {isScrubbing && (
                <View
                  style={[
                    styles.progressFill,
                    styles.scrubFill,
                    { width: `${scrubProgress * 100}%` },
                  ]}
                />
              )}
              {(isBuffering || isLoading) && (
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
                    end={{ x: 0, y: 0.5 }}
                    style={styles.shimmerGradient}
                  />
                </Animated.View>
              )}
            </View>

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
            {isScrubbing && (
              <Animated.View
                style={[
                  styles.progressKnob,
                  {
                    left: `${scrubProgress * 100}%` as unknown as number,
                    backgroundColor: C.scrubKnobBg,
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
            onLayout={() => onSetInfoButtonNode(findNodeHandle(infoButtonRef.current))}
            style={({ focused }) => [
              styles.infoButton,
              focused && styles.infoButtonFocused,
            ]}
            nextFocusUp={findNodeHandle(progressBarRef.current)}
            onPress={onOpenInfo}
            focusable={true}>
            {({ focused }) => (
              <Text style={[styles.infoButtonText, focused && styles.infoButtonTextFocused]}>
                {t('nowPlaying.info')}
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
          <View style={styles.footerButtonsRight}>
            <Pressable
              style={({ focused }) => [
                styles.infoButton,
                focused && styles.infoButtonFocused,
                { marginRight: spacing.md },
              ]}
              nextFocusUp={findNodeHandle(progressBarRef.current)}
              onPress={onToggleLyrics}
              focusable={true}
              accessible={true}
              accessibilityRole="button">
              {({ focused }) => (
                <LyricIcon active={showLyrics} focused={focused} />
              )}
            </Pressable>

            <Pressable
              ref={queueButtonRef}
              style={({ focused }) => [
                styles.infoButton,
                focused && styles.infoButtonFocused,
                { alignSelf: 'flex-end', marginRight: -spacing.sm },
              ]}
              nextFocusUp={findNodeHandle(progressBarRef.current)}
              onPress={onToggleQueue}
              focusable={true}
              accessible={true}
              accessibilityRole="button">
              {({ focused }) => {
                const iconColor = showQueue || focused ? C.onDarkTextPrimary : C.onDarkTextFaint;
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
      </View>
    </View>
  );
});

// ── Sub-component: Queue Item ──────────────────────────────────────

interface QueueItemProps {
  track: any;
  isCurrent: boolean;
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  accentColor: string;
  showInfo: boolean;
}

const QueueItem = React.memo(({
  track,
  isCurrent,
  isPlaying,
  isLoading,
  isBuffering,
  accentColor,
  showInfo,
}: QueueItemProps) => {
  return (
    <View style={styles.queueItemContainer}>
      <NowPlayingTrackInfo
        track={track}
        isPlaying={isPlaying && isCurrent}
        isLoading={isLoading}
        isBuffering={isBuffering}
        accentColor={accentColor}
        showBars={isCurrent}
        align="center"
        style={{ opacity: showInfo ? 0 : 1 }}
      />
    </View>
  );
});

export function NowPlayingScreen({
  onBack,
  isTabView = false,
}: Readonly<NowPlayingScreenProps>): React.JSX.Element {
  const { t } = useTranslation();
  const { colors: themeColors } = useTheme();
  const { state } = usePlayer();
  const { track, playbackState } = state;
  const isPlaying = playbackState === 'playing';
  const palette = useImageColors(track?.artworkUrl);

  const [showInfo, setShowInfo] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const queueListRef = useRef<FlatList>(null);



  const { pushContent } = React.useContext(ContentNavigationContext);
  const { storefrontId } = useStorefront();

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

  // If lyrics button is pressed, hide queue/info and vice versa
  useEffect(() => {
    if (showLyrics) {
      setShowQueue(false);
      setShowInfo(false);
    }
  }, [showLyrics]);

  useEffect(() => {
    if (showQueue || showInfo) {
      setShowLyrics(false);
    }
  }, [showQueue, showInfo]);

  const isLiveRadio = track ? (track.id?.startsWith('ra.') || track.duration === 0) : false;

  const progressBarRef = useRef<View>(null);
  const playbackControlsRef = useRef<View>(null);
  const [progressBarNode, setProgressBarNode] = useState<number | null>(null);
  const [playbackControlsNode, setPlaybackControlsNode] = useState<number | null>(null);
  const [infoButtonNode, setInfoButtonNode] = useState<number | null>(null);

  if (!track) {
    const isActuallyLoading = state.isLoading || state.playbackState !== 'stopped';
    if (isActuallyLoading) {
      // Something is loading but track info isn't available yet
      const LoadingIndicator = require('../components/LoadingIndicator').LoadingIndicator;
      return (
        <LinearGradient
          colors={[themeColors.gradientStart, themeColors.gradientEnd]}
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
        colors={[themeColors.gradientStart, themeColors.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.root}
      >
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, color: themeColors.textMuted, fontWeight: '600' }}>{t('nowPlaying.emptyState')}</Text>
        </View>
      </LinearGradient>
    );
  }

  // Final rendering values
  const bg1 = palette?.darkMuted || palette?.dominant || themeColors.nowPlayingDarkBg;
  const bg2 = palette?.darkVibrant || palette?.muted || themeColors.nowPlayingDarkBgDeep;
  const accentColor = palette?.vibrant || palette?.lightVibrant || themeColors.accent;
  // If we have a track, we show it, even if palette is loading or playback is pending.
  // The only reason to show a full screen spinner is if we have NO track info yet while loading.

  return (
    <LinearGradient
      colors={[bg1, bg2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.root}>
        {showLyrics && (
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: themeColors.overlayLight }]}
            pointerEvents="none"
          />
        )}

        {/* Centered content: artwork OR queue OR lyrics */}
        <View style={styles.content}>
          {!showLyrics && !showQueue ? (
            <NowPlayingTrackInfo
              track={track}
              isPlaying={isPlaying}
              isLoading={state.isLoading}
              isBuffering={state.buffering}
              accentColor={accentColor}
              scaleAnim={scaleAnim}
              showBars={true}
              align="center"
            />
          ) : !showLyrics && showQueue ? (
            <View style={styles.integratedQueueContainer}>
              <FlatList
                key={`queue-${state.shuffleMode}`}
                ref={queueListRef}
                data={state.queue}
                horizontal
                keyExtractor={(item) => item.playbackQueueId?.toString() ?? item.id}
                showsHorizontalScrollIndicator={false}
                removeClippedSubviews={true}
                initialNumToRender={3}
                maxToRenderPerBatch={3}
                windowSize={5}
                contentContainerStyle={[styles.queueListContent, { paddingHorizontal: HORIZONTAL_PADDING }]}
                initialScrollIndex={activeIndex >= 0 ? activeIndex : 0}
                getItemLayout={(_, index) => ({
                  length: ARTWORK_SIZE + 20,
                  offset: (ARTWORK_SIZE + 20) * index,
                  index,
                })}
                renderItem={({ item }) => (
                  <QueueItem
                    track={item}
                    isCurrent={item.playbackQueueId === (state.track as any)?.playbackQueueId}
                    isPlaying={isPlaying}
                    isLoading={state.isLoading}
                    isBuffering={state.buffering}
                    accentColor={accentColor}
                    showInfo={showInfo}
                  />
                )}
              />
            </View>
          ) : (
            <View style={styles.lyricsSplitView}>
              <View style={styles.artworkSectionSide}>
                <NowPlayingTrackInfo
                  track={track}
                  isPlaying={isPlaying}
                  isLoading={state.isLoading}
                  isBuffering={state.buffering}
                  accentColor={accentColor}
                  scaleAnim={scaleAnim}
                  showBars={true}
                  align="center"
                />
              </View>
              <View style={[styles.lyricsSection, isTabView && styles.lyricsTabPadding]}>
                <LyricsView />
              </View>
            </View>
          )}
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
                    {t('nowPlaying.durationFormat', { mins: Math.floor(track.duration / 60000), secs: Math.floor((track.duration % 60000) / 1000) })}
                  </Text>
                </View>
                <Pressable
                  style={({ focused }) => [
                    styles.gotoAlbumButton,
                    focused && styles.gotoAlbumButtonFocused,
                  ]}
                  hasTVPreferredFocus={showInfo}
                  onPress={async () => {
                    if (track?.id && !isLiveRadio) {
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
                  focusable={!isLiveRadio}>
                  {({ focused }) => (
                    <Text style={[styles.gotoAlbumText, focused && styles.gotoAlbumTextFocused]}>
                      {t('nowPlaying.goToAlbum')}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>

        {/* Progress and Info footer — at screen bottom */}
        {!isLiveRadio && (
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

                <NowPlayingProgressBar
                  accentColor={accentColor}
                  isLiveRadio={isLiveRadio}
                  isLoading={state.isLoading}
                  isBuffering={state.buffering}
                  isPlaying={isPlaying}
                  playbackControlsNode={playbackControlsNode}
                  infoButtonNode={infoButtonNode}
                  onSetInfoButtonNode={setInfoButtonNode}
                  onOpenInfo={() => setShowInfo(true)}
                  showLyrics={showLyrics}
                  onToggleLyrics={() => setShowLyrics(!showLyrics)}
                  showQueue={showQueue}
                  onToggleQueue={() => setShowQueue(!showQueue)}
                  progressBarRef={progressBarRef}
                  onLayoutProgress={() => setProgressBarNode(findNodeHandle(progressBarRef.current))}
                />
              </>
            )}
          </View>
        )}
      </LinearGradient>
  );
}

// ── Styles ────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH } = Dimensions.get('window');
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
    color: C.onDarkTextMuted,
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
    color: C.onDarkTextFaint,
    marginTop: spacing.xl,
  },
  artist: {
    fontSize: 12,
    color: C.onDarkTextSecondary,
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
    backgroundColor: C.progressTrackBg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressTrackFocused: {
    backgroundColor: C.progressTrackFocusedBg,
  },
  progressFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 3,
  },
  scrubFill: {
    backgroundColor: C.scrubFillBg,
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
    color: C.onDarkTextPrimary,
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
    color: C.onDarkTextMuted,
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
    backgroundColor: C.onDarkControlBg,
  },
  infoButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.onDarkTextFaint,
  },
  infoButtonTextFocused: {
    color: C.onDarkTextPrimary,
  },
  // Info Menu
  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlayStrong,
    justifyContent: 'flex-end',
  },
  infoMenuContainer: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.overlayMid,
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
    color: C.onDarkTextPrimary,
  },
  infoArtistAlbum: {
    fontSize: 16,
    color: C.onDarkTextSoft,
    marginTop: 2,
  },
  infoDuration: {
    fontSize: 14,
    color: C.onDarkTextSecondary,
    marginTop: 8,
  },
  losslessBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.onDarkTextDim,
    alignSelf: 'flex-start',
  },
  losslessText: {
    fontSize: 10,
    color: C.onDarkTextSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  gotoAlbumButton: {
    backgroundColor: C.glassCardBgStrong,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginLeft: spacing.lg,
  },
  gotoAlbumButtonFocused: {
    backgroundColor: C.scrubKnobBg,
    transform: [{ scale: 1.05 }],
  },
  gotoAlbumText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.textOnDark,
  },
  gotoAlbumTextFocused: {
    fontWeight: '700',
    color: C.textOnDark,
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
    backgroundColor: C.overlayHeavy,
  },
  // List content
  queueListContent: {
    // Center items vertically within the ARTWORK_SIZE container
    justifyContent: 'center',
  },
  // Lyrics Split View
  lyricsSplitView: {
    flex: 1,
    width: '100%',
    flexDirection: 'row',
  },
  lyricsTabPadding: {
    paddingTop: 80, // Account for TopBar height when viewed as a tab
  },
  artworkSectionSide: {
    flex: 0.45,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingLeft: spacing.xxl, // Increased space from the left edge
    paddingRight: spacing.xxl,
  },
  lyricsSection: {
    flex: 0.55,
    paddingLeft: spacing.xxl,
    paddingRight: 80,
    paddingBottom: 100, // Clear the progress bar and footer buttons
  },
  footerButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
