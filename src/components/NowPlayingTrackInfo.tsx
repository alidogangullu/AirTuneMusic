import React from 'react';
import {Animated, Image, StyleSheet, Text, View} from 'react-native';
import {NowPlayingBars} from './NowPlayingBars';
import {spacing} from '../theme/layout';
import {TrackInfo} from '../services/musicPlayer';

interface NowPlayingTrackInfoProps {
  track: TrackInfo | null;
  isPlaying: boolean;
  isLoading: boolean;
  isBuffering: boolean;
  accentColor: string;
  scaleAnim?: Animated.Value;
  showBars?: boolean;
  align?: 'center' | 'flex-start';
  style?: any;
}

export const ARTWORK_SIZE = 260;

export function NowPlayingTrackInfo({
  track,
  isPlaying,
  isLoading,
  isBuffering,
  accentColor,
  scaleAnim,
  showBars = true,
  align = 'center',
  style,
}: NowPlayingTrackInfoProps): React.JSX.Element {
  const containerStyle = [
    styles.container,
    align === 'flex-start' && styles.alignStart,
    style,
  ];

  return (
    <View style={containerStyle}>
      <Animated.View
        style={[
          styles.artworkShadow,
          scaleAnim && {transform: [{scale: scaleAnim}]},
        ]}>
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
      <View style={[styles.meta, align === 'flex-start' && styles.metaStart]}>
        <View style={styles.titleRow}>
          {showBars && (
            <NowPlayingBars
              playing={isPlaying && !isLoading && !isBuffering}
              color={accentColor}
              size={16}
            />
          )}
          <Text style={styles.title} numberOfLines={1}>
            {track?.title ?? ''}
          </Text>
        </View>
        <Text style={styles.artist} numberOfLines={1}>
          {track?.artistName ?? ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignStart: {
    alignItems: 'flex-start',
  },
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
  meta: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  metaStart: {
    alignItems: 'flex-start',
  },
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
});
