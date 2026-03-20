import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { spacing, radius } from '../theme/layout';
import { usePlayer } from '../hooks/usePlayer';
import { ShuffleMode, RepeatMode } from '../services/musicPlayer';

interface ControlButtonProps {
  onPress: () => void;
  active?: boolean;
  children: React.ReactNode;
  focused?: boolean;
  disabled?: boolean;
}

function ControlButton({ onPress, active, children, disabled }: ControlButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ focused }) => [
        styles.button,
        focused && styles.buttonFocused,
        active && !focused && styles.buttonActive,
        disabled && styles.buttonDisabled,
      ]}>
      {children}
    </Pressable>
  );
}

export function PlaybackControls() {
  const { state, setShuffleMode, setRepeatMode, toggleRating, toggleAutoplay } = usePlayer();
  const { shuffleMode, repeatMode, rating, autoplay, track, isLoading, buffering } = state;

  const isDisabled = !track || isLoading || buffering;

  const handleShufflePress = useCallback(() => {
    const nextMode = shuffleMode === ShuffleMode.OFF ? ShuffleMode.SONGS : ShuffleMode.OFF;
    setShuffleMode(nextMode);
  }, [shuffleMode, setShuffleMode]);

  const handleRepeatPress = useCallback(() => {
    let nextMode: number = RepeatMode.NONE;
    if (repeatMode === RepeatMode.NONE) nextMode = RepeatMode.ALL;
    else if (repeatMode === RepeatMode.ALL) nextMode = RepeatMode.ONE;
    else nextMode = RepeatMode.NONE;
    setRepeatMode(nextMode);
  }, [repeatMode, setRepeatMode]);

  const inactiveColor = 'rgba(255, 255, 255, 0.4)';
  const activeColor = '#FFFFFF';

  return (
    <View style={styles.container}>
      {/* Shuffle */}
      <ControlButton onPress={handleShufflePress} active={shuffleMode !== ShuffleMode.OFF} disabled={isDisabled}>
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={shuffleMode !== ShuffleMode.OFF ? activeColor : inactiveColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M16 3h5v5" />
          <Path d="M4 20L21 3" />
          <Path d="M21 16v5h-5" />
          <Path d="M15 15l6 6" />
          <Path d="M4 4l5 5" />
        </Svg>
      </ControlButton>

      {/* Repeat */}
      <ControlButton onPress={handleRepeatPress} active={repeatMode !== RepeatMode.NONE} disabled={isDisabled}>
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={repeatMode !== RepeatMode.NONE ? activeColor : inactiveColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <Path d="m17 2 4 4-4 4" />
          <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <Path d="m7 22-4-4 4-4" />
          <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
          {repeatMode === RepeatMode.ONE && (
            <Path d="M11 10h1v4" strokeWidth="2" />
          )}
        </Svg>
      </ControlButton>

      {/* Autoplay (Infinity) */}
      <ControlButton onPress={toggleAutoplay} active={autoplay} disabled={isDisabled}>
        <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={autoplay ? activeColor : inactiveColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
        </Svg>
      </ControlButton>

      {/* Favorite (Star/Heart) */}
      <ControlButton onPress={toggleRating} active={rating === 1} disabled={isDisabled}>
        <Svg width="20" height="20" viewBox="0 0 24 24" fill={rating === 1 ? activeColor : "none"} stroke={rating === 1 ? activeColor : inactiveColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <Path d="M12 17.75l-6.172 3.245 1.179-6.873-4.993-4.867 6.9-1.002L12 2l3.086 6.253 6.9 1.002-4.993 4.867 1.179 6.873z" />
        </Svg>
      </ControlButton>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    paddingRight: spacing.xxl,
    marginBottom: -spacing.sm, // Pull closer to progress bar
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  buttonFocused: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  buttonActive: {
    // Optional: a subtle indicator when active but not focused
  },
  buttonDisabled: {
    opacity: 0.2, // Drastically dim if disabled
  },
});
