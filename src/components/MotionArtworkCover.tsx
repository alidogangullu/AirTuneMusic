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

const FOCUS_DEBOUNCE_MS = 50;

// Motion artwork is a small looping thumbnail, so cap the HLS rendition at
// 2 million bits/sec for a faster first buffer and lower data use vs. the
// full ladder.
const MAX_BIT_RATE = 2_000_000;

// Start playback as soon as a little is buffered rather than ExoPlayer's larger
// defaults — the image overlay hides the load, so a quick start is all we need.
const BUFFER_CONFIG = {
  minBufferMs: 1000,
  maxBufferMs: 5000,
  bufferForPlaybackMs: 250,
  bufferForPlaybackAfterRebufferMs: 500,
};

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

  // Fetch the URL immediately on focus so the network request overlaps with
  // the debounce window. Video is only mounted after focus settles to avoid
  // spinning up ExoPlayer for items the user just scrolls past.
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
    enabled && focused, // fetch starts immediately, not after debounce
  );

  const showVideo = enabled && focused && focusSettled && !!motionUrl;

  // The static image sits on TOP of the video and only fades out once the
  // video has actually played a little (see onVideoProgress) — Apple Music's
  // HLS motion streams start with a few black frames, and the image hides them.
  // It also stays opaque while the video mounts/unmounts, so the GPU never
  // exposes a black ExoPlayer surface on real hardware.
  const [videoMounted, setVideoMounted] = useState(false);
  const imageOverlayOpacity = useRef(new Animated.Value(1)).current;

  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showVideoRef = useRef(showVideo);
  showVideoRef.current = showVideo;

  useEffect(() => {
    if (showVideo) {
      if (unmountTimerRef.current !== null) {
        clearTimeout(unmountTimerRef.current);
        unmountTimerRef.current = null;
      }
      imageOverlayOpacity.stopAnimation();
      imageOverlayOpacity.setValue(1);
      setVideoMounted(true);
    } else {
      // Cover instantly so ExoPlayer's black-on-pause frame is never visible,
      // then unmount ~2 frames later so GPU teardown happens behind the image.
      imageOverlayOpacity.stopAnimation();
      imageOverlayOpacity.setValue(1);
      unmountTimerRef.current = setTimeout(() => {
        unmountTimerRef.current = null;
        setVideoMounted(false);
      }, 32);
    }
    return () => {
      if (unmountTimerRef.current !== null) {
        clearTimeout(unmountTimerRef.current);
      }
    };
  }, [showVideo, imageOverlayOpacity]);

  const videoRevealedRef = useRef(false);

  useEffect(() => {
    if (!showVideo) videoRevealedRef.current = false;
  }, [showVideo]);

  const revealVideo = () => {
    if (videoRevealedRef.current || !showVideoRef.current) return;
    videoRevealedRef.current = true;
    Animated.timing(imageOverlayOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  };

  // Wait until the video has actually played 300 ms worth of content before
  // revealing it — this skips any initial black frames in the HLS stream.
  const onVideoProgress = ({ currentTime }: { currentTime: number }) => {
    if (currentTime >= 0.3) revealVideo();
  };

  return (
    <View style={[styles.container, { width, height, borderRadius }]}>
      {videoMounted && motionUrl ? (
        <Video
          source={{ uri: motionUrl, bufferConfig: BUFFER_CONFIG }}
          style={styles.fill}
          resizeMode="cover"
          muted
          repeat
          paused={!focused}
          disableFocus
          focusable={false}
          playInBackground={false}
          maxBitRate={MAX_BIT_RATE}
          progressUpdateInterval={100}
          onProgress={onVideoProgress}
          onError={() => imageOverlayOpacity.setValue(1)}
        />
      ) : null}
      <Animated.View
        style={[styles.fill, styles.absolute, { opacity: imageOverlayOpacity }]}
        pointerEvents="none"
      >
        {artworkUrl ? (
          <Image
            source={{ uri: artworkUrl }}
            style={styles.fill}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.fill} />
        )}
      </Animated.View>
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
