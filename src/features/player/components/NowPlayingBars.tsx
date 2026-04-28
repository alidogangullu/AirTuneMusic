/**
 * Animated equalizer bars — "now playing" indicator for track lists.
 * Shows 4 bars that animate up/down when playing, freeze mid-height when paused.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';
import { lightColors as appColors } from '../../../theme/colors';

const BAR_COUNT = 4;
const BAR_WIDTH = 3;
const BAR_GAP = 2;
const HEIGHT = 13;
const BAR_IDS = ['a', 'b', 'c', 'd'] as const;

interface NowPlayingBarsProps {
  playing: boolean;
  color?: string;
  size?: number;
}

export function NowPlayingBars({
  playing,
  color = appColors.accent,
  size = HEIGHT,
}: Readonly<NowPlayingBarsProps>) {
  const anims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(size * 0.3)),
  ).current;

  useEffect(() => {
    if (playing) {
      const animations = anims.map((anim, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: size * (0.2 + Math.random() * 0.3),
              duration: 280 + i * 60,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: size * (0.7 + Math.random() * 0.3),
              duration: 320 + i * 50,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ]),
        ),
      );
      animations.forEach(a => a.start());
      return () => animations.forEach(a => a.stop());
    } else {
      anims.forEach((anim, i) => {
        Animated.timing(anim, {
          toValue: size * (0.3 + i * 0.1),
          duration: 300,
          useNativeDriver: false,
        }).start();
      });
    }
  }, [playing, anims, size]);

  const totalWidth = BAR_COUNT * BAR_WIDTH + (BAR_COUNT - 1) * BAR_GAP;

  return (
    <View style={[styles.container, { width: totalWidth, height: size }]}>
      {anims.map((anim, i) => (
        <Animated.View
          key={`bar-${BAR_IDS[i]}`}
          style={[
            styles.bar,
            {
              width: BAR_WIDTH,
              backgroundColor: color,
              height: anim,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: BAR_GAP,
  },
  bar: {
    borderRadius: 1.5,
  },
});
