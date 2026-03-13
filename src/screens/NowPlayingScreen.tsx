/**
 * Now Playing screen — full-screen player with artwork, progress bar,
 * and dynamic gradient background extracted from artwork colors.
 */

import React, {useEffect, useRef} from 'react';
import {Animated, BackHandler, Image, StyleSheet, Text, View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {NowPlayingBars} from '../components/NowPlayingBars';
import {useImageColors} from '../hooks/useImageColors';
import {usePlayer} from '../hooks/usePlayer';
import {spacing} from '../theme/layout';

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

export function NowPlayingScreen({onBack}: Readonly<NowPlayingScreenProps>): React.JSX.Element {
  const {state} = usePlayer();
  const {track, position, duration, playbackState} = state;
  const isPlaying = playbackState === 'playing';
  const hasTrack = track !== null && playbackState !== 'stopped';
  const palette = useImageColors(track?.artworkUrl);
  const paletteLoading = track?.artworkUrl && !palette;

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

  if (!track) {
    // Select music warning
    return (
      <LinearGradient
        colors={["#c1d5f3", "#bfc0c6"]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.root}
      >
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          <Text style={{fontSize: 20, color: '#333', fontWeight: '600'}}>Select a song to play.</Text>
        </View>
      </LinearGradient>
    );
  }
  if (!hasTrack || paletteLoading) {
    const LoadingIndicator = require('../components/LoadingIndicator').LoadingIndicator;
    return (
      <LinearGradient
        colors={["#c1d5f3", "#bfc0c6"]}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}
        style={styles.root}
      >
        <LoadingIndicator />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[bg1, bg2]}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.root}>
      {/* Centered content: artwork + track info */}
      <View style={styles.content}>
        <Animated.View style={[styles.artworkShadow, {transform: [{scale: scaleAnim}]}]}>
          {track?.artworkUrl ? (
            <Image
              source={{uri: track.artworkUrl}}
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
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {width: `${progress * 100}%`, backgroundColor: accentColor},
            ]}
          />
          <View
            style={[
              styles.progressKnob,
              {left: `${progress * 100}%`, backgroundColor: '#fff'},
            ]}
          />
        </View>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Text style={styles.timeText}>-{formatTime(remainingMs)}</Text>
        </View>
      </View>
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
    shadowOffset: {width: 0, height: 12},
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
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 1.5,
    overflow: 'visible',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  progressKnob: {
    position: 'absolute',
    top: -3.5,
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: -5,
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
