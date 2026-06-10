/**
 * Cover that shows the static artwork and, while the card is focused, plays the
 * Apple Music motion artwork (looping muted HLS video) on top of it.
 *
 * The motion video URL is fetched lazily once focus settles, so we never fetch
 * for cards the user just scrolls past. Anything missing (no token, no motion
 * artwork, playback error) degrades silently to the static image.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';
import Video from 'react-native-video';
import { useEditorialVideo } from '../features/content/hooks/useEditorialVideo';
import { MotionArtworkService } from '../features/settings/motionArtworkService';

const FOCUS_DEBOUNCE_MS = 120;

export type MotionArtworkCoverProps = {
  contentType: 'playlists' | 'albums' | 'stations';
  contentId: string;
  artworkUrl?: string;
  focused: boolean;
  width: number;
  height: number;
  borderRadius?: number;
};

export function MotionArtworkCover({
  contentType,
  contentId,
  artworkUrl,
  focused,
  width,
  height,
  borderRadius = 0,
}: Readonly<MotionArtworkCoverProps>): React.JSX.Element {
  const enabled = MotionArtworkService.getEnabled();

  // Debounce focus so fast D-pad scrolling doesn't trigger fetch/playback.
  const [focusSettled, setFocusSettled] = useState(false);
  useEffect(() => {
    if (!focused) {
      setFocusSettled(false);
      return;
    }
    const t = setTimeout(() => setFocusSettled(true), FOCUS_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [focused]);

  const { motionUrl } = useEditorialVideo(
    contentType,
    contentId,
    enabled && focusSettled,
  );

  const showVideo = enabled && focused && focusSettled && !!motionUrl;

  // Fade the video in once the first frame is ready for a seamless swap.
  const opacity = useRef(new Animated.Value(0)).current;
  const onReady = () => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };
  useEffect(() => {
    if (!showVideo) opacity.setValue(0);
  }, [showVideo, opacity]);

  return (
    <View style={[styles.container, { width, height, borderRadius }]}>
      {artworkUrl ? (
        <Image
          source={{ uri: artworkUrl }}
          style={styles.fill}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.fill} />
      )}
      {showVideo && motionUrl ? (
        <Animated.View style={[styles.fill, styles.absolute, { opacity }]}>
          <Video
            source={{ uri: motionUrl }}
            style={styles.fill}
            resizeMode="cover"
            muted
            repeat
            paused={!focused}
            disableFocus
            focusable={false}
            playInBackground={false}
            onReadyForDisplay={onReady}
            onError={() => opacity.setValue(0)}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});
