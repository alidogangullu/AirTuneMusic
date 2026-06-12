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
import Video, { SelectedTrackType } from 'react-native-video';
import { useEditorialVideo } from '../features/content/hooks/useEditorialVideo';
import { MotionArtworkService } from '../features/settings/motionArtworkService';
import { useMotionSuspended } from './MotionSuspenseContext';

const FOCUS_DEBOUNCE_MS = 50;

// Reveal the video over the static image once it has played this far. Apple
// Music's HLS motion streams open with a couple of black frames; this skips
// them while staying as low as possible so the swap feels immediate.
const VIDEO_REVEAL_THRESHOLD_S = 0.3;

// Start playback the instant a tiny amount is buffered — the image overlay
// hides the load, so we optimize purely for the fastest possible first frame.
// cacheSizeMB enables react-native-video's shared on-disk HLS cache so that
// returning to an already-seen motion artwork replays from disk instead of
// re-downloading — faster restart and far less bandwidth contention with the
// (network-streamed) music. The cache is a process-wide singleton shared by
// every motion player.
const BUFFER_CONFIG = {
  minBufferMs: 500,
  maxBufferMs: 5000,
  bufferForPlaybackMs: 80,
  bufferForPlaybackAfterRebufferMs: 250,
  cacheSizeMB: 200,
};

// Motion artwork is always muted, so disable its audio track entirely. This
// stops ExoPlayer from spinning up a second audio decoder + AudioTrack that
// would otherwise contend with the Apple Music SDK's audio rendering and cause
// momentary stutters in the playing song.
const DISABLED_AUDIO_TRACK = { type: SelectedTrackType.DISABLED } as const;

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

  // A focused card under an open Modal never receives a blur (the Modal is a
  // separate Android Window), so focus alone would keep the video decoding
  // invisibly behind the overlay — the suspend signal covers that case.
  const suspended = useMotionSuspended();
  const active = focused && !suspended;

  // Fetch the URL immediately on focus so the network request overlaps with
  // the debounce window. Video is only mounted after focus settles to avoid
  // spinning up ExoPlayer for items the user just scrolls past.
  const [focusSettled, setFocusSettled] = useState(false);
  useEffect(() => {
    if (!active) {
      setFocusSettled(false);
      return;
    }
    const t = setTimeout(() => setFocusSettled(true), FOCUS_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [active]);

  const { motionUrl } = useEditorialVideo(
    contentType,
    contentId,
    enabled && active, // fetch starts immediately, not after debounce
  );

  const showVideo = enabled && active && focusSettled && !!motionUrl;

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
    // useNativeDriver must stay false: this value is also driven by synchronous
    // setValue(1) on mount/unmount/error, and mixing setValue with a
    // native-driven animation desyncs the JS/native value — which left the
    // overlay transparent on unmount and exposed a black ExoPlayer surface.
    Animated.timing(imageOverlayOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  };

  // Reveal only after the video has played past its initial black frames.
  const onVideoProgress = ({ currentTime }: { currentTime: number }) => {
    if (currentTime >= VIDEO_REVEAL_THRESHOLD_S) revealVideo();
  };

  return (
    <View style={[styles.container, { width, height, borderRadius }]}>
      {videoMounted && motionUrl ? (
        <Video
          source={{ uri: motionUrl, bufferConfig: BUFFER_CONFIG }}
          style={styles.fill}
          resizeMode="cover"
          muted
          selectedAudioTrack={DISABLED_AUDIO_TRACK}
          repeat
          paused={!active}
          disableFocus
          focusable={false}
          playInBackground={false}
          progressUpdateInterval={50}
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