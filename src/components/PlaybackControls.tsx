import React, { useCallback } from 'react';
import { StyleSheet, View, Pressable, findNodeHandle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { spacing, radius } from '../theme/layout';
import { lightColors as C } from '../theme/colors';
import { usePlayer } from '../hooks/usePlayer';
import { ShuffleMode, RepeatMode } from '../services/musicPlayer';

interface ControlButtonProps {
  onPress: () => void;
  active?: boolean;
  activeTransparent?: boolean;
  children: (focused: boolean) => React.ReactNode;
  disabled?: boolean;
  nextFocusDown?: number | null;
  onLayout?: (node: number | null) => void;
}

function ControlButton({ onPress, active, activeTransparent, children, disabled, nextFocusDown, onLayout }: Readonly<ControlButtonProps>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      nextFocusDown={nextFocusDown}
      onLayout={(e: any) => onLayout?.(findNodeHandle(e.nativeEvent.target))}
      style={({ focused }) => [
        styles.button,
        active && !focused && !activeTransparent && styles.buttonActive,
        focused && styles.buttonFocused,
        disabled && styles.buttonDisabled,
      ]}>
      {({ focused }) => children(focused)}
    </Pressable>
  );
}

export const PlaybackControls = React.memo(({
  nextFocusDown,
  onLayoutButton,
  isLive,
}: {
  nextFocusDown?: number | null,
  onLayoutButton?: (node: number | null) => void,
  isLive?: boolean,
}) => {
  const { state, setShuffleMode, setRepeatMode, toggleRating, toggleAutoplay, skipToPrevious, skipToNext } = usePlayer();
  const { shuffleMode, repeatMode, rating, autoplay, track, isLoading, buffering, containerId } = state;

  const isDisabled = !track || isLoading || buffering || !!isLive;
  const isStation = containerId?.startsWith('ra.') || containerId?.startsWith('st.');
  const isPreviousDisabled = isDisabled || !state.canSkipToPrevious;
  const isNextDisabled = isDisabled || !state.canSkipToNext;

  const handleShufflePress = useCallback(() => {
    const nextMode = shuffleMode === ShuffleMode.OFF ? ShuffleMode.SONGS : ShuffleMode.OFF;
    setShuffleMode(nextMode);
  }, [shuffleMode, setShuffleMode]);

  const handleRepeatPress = useCallback(() => {
    let nextMode: number;
    if (repeatMode === RepeatMode.NONE) { nextMode = RepeatMode.ALL; }
    else if (repeatMode === RepeatMode.ALL) { nextMode = RepeatMode.ONE; }
    else { nextMode = RepeatMode.NONE; }
    setRepeatMode(nextMode);
  }, [repeatMode, setRepeatMode]);

  const iconColor = (focused: boolean, active: boolean) => {
    if (focused) return C.onDarkFocusedIcon;
    if (active) return C.onDarkTextPrimary;
    return C.onDarkTextDim;
  };

  return (
    <View style={styles.container}>
      {/* Primary Controls */}
      <View style={styles.primaryGroup}>
        <ControlButton onPress={skipToPrevious} disabled={isPreviousDisabled} nextFocusDown={nextFocusDown}>
          {(focused) => (
            <Svg width="24" height="24" viewBox="0 0 24 24" fill={iconColor(focused, true)}>
              <Path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </Svg>
          )}
        </ControlButton>
        <ControlButton
          onPress={skipToNext}
          disabled={isNextDisabled}
          nextFocusDown={nextFocusDown}
          onLayout={(node: number | null) => onLayoutButton?.(node)}>
          {(focused) => (
            <Svg width="24" height="24" viewBox="0 0 24 24" fill={iconColor(focused, true)}>
              <Path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </Svg>
          )}
        </ControlButton>
      </View>

      {/* Secondary Controls */}
      <View style={styles.secondaryGroup}>
        {/* Shuffle */}
        <ControlButton
          onPress={handleShufflePress}
          active={shuffleMode !== ShuffleMode.OFF}
          disabled={isDisabled || isStation}
          nextFocusDown={nextFocusDown}>
          {(focused) => (
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor(focused, shuffleMode !== ShuffleMode.OFF)} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M16 3h5v5" />
              <Path d="M4 20L21 3" />
              <Path d="M21 16v5h-5" />
              <Path d="M15 15l6 6" />
              <Path d="M4 4l5 5" />
            </Svg>
          )}
        </ControlButton>

        {/* Repeat */}
        <ControlButton
          onPress={handleRepeatPress}
          active={repeatMode !== RepeatMode.NONE}
          disabled={isDisabled || isStation}
          nextFocusDown={nextFocusDown}>
          {(focused) => (
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor(focused, repeatMode !== RepeatMode.NONE)} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Path d="m17 2 4 4-4 4" />
              <Path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <Path d="m7 22-4-4 4-4" />
              <Path d="M21 13v2a4 4 0 0 1-4 4H3" />
              {repeatMode === RepeatMode.ONE && (
                <Path d="M11 10h1v4" strokeWidth="2" />
              )}
            </Svg>
          )}
        </ControlButton>

        {/* Autoplay */}
        <ControlButton
          onPress={toggleAutoplay}
          active={autoplay}
          disabled={isDisabled || isStation}
          nextFocusDown={nextFocusDown}>
          {(focused) => (
            <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={iconColor(focused, autoplay)} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 12c-2-2.67-4-4-6-4a4 4 0 1 0 0 8c2 0 4-1.33 6-4Zm0 0c2 2.67 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.33-6 4Z" />
            </Svg>
          )}
        </ControlButton>

        {/* Favorite — active bg transparent */}
        <ControlButton
          onPress={toggleRating}
          active={rating === 1}
          activeTransparent
          disabled={isDisabled}
          nextFocusDown={nextFocusDown}>
          {(focused) => {
            let favFill = 'none';
            if (focused) { favFill = C.onDarkFocusedIcon; }
            else if (rating === 1) { favFill = C.onDarkTextPrimary; }
            return (
              <Svg width="20" height="20" viewBox="0 0 24 24" fill={favFill} stroke={iconColor(focused, rating === 1)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 17.75l-6.172 3.245 1.179-6.873-4.993-4.867 6.9-1.002L12 2l3.086 6.253 6.9 1.002-4.993 4.867 1.179 6.873z" />
              </Svg>
            );
          }}
        </ControlButton>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    marginBottom: -spacing.md,
  },
  primaryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  secondaryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
    backgroundColor: C.scrubKnobBg,
  },
  buttonActive: {
    backgroundColor: C.onDarkButtonActiveBg,
  },
  buttonDisabled: {
    opacity: 0.3,
  },
});
