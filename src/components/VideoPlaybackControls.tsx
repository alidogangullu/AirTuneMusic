import React, { useRef } from 'react';
import { StyleSheet, View, Pressable, findNodeHandle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { spacing, radius } from '../theme/layout';
import { lightColors as C } from '../theme/colors';

interface ControlButtonProps {
  onPress: () => void;
  disabled?: boolean;
  nextFocusDown?: number | null;
  hasTVPreferredFocus?: boolean;
  onLayout?: (node: number | null) => void;
  children: (focused: boolean) => React.ReactNode;
}

function ControlButton({ onPress, disabled, nextFocusDown, hasTVPreferredFocus, onLayout, children }: Readonly<ControlButtonProps>) {
  const buttonRef = useRef<View | null>(null);
  return (
    <Pressable
      ref={buttonRef}
      onPress={onPress}
      disabled={disabled}
      nextFocusDown={nextFocusDown ?? undefined}
      hasTVPreferredFocus={hasTVPreferredFocus}
      onLayout={() => onLayout?.(findNodeHandle(buttonRef.current))}
      style={({ focused }) => [
        styles.button,
        focused && styles.buttonFocused,
        disabled && styles.buttonDisabled,
      ]}>
      {({ focused }) => children(focused)}
    </Pressable>
  );
}

interface VideoPlaybackControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
  nextFocusDown?: number | null;
  onLayoutPlayPause?: (node: number | null) => void;
}

export const VideoPlaybackControls = React.memo(({
  isPlaying,
  isLoading,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onPlayPause,
  nextFocusDown,
  onLayoutPlayPause,
}: VideoPlaybackControlsProps) => {
  const iconColor = (focused: boolean) => focused ? C.onDarkFocusedIcon : C.onDarkTextDim;

  return (
    <View style={styles.container}>
      <View style={styles.primaryGroup}>
        <ControlButton onPress={onPrev} disabled={!canPrev} nextFocusDown={nextFocusDown}>
          {(focused) => (
            <Svg width="24" height="24" viewBox="0 0 24 24" fill={iconColor(focused)}>
              <Path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
            </Svg>
          )}
        </ControlButton>

        <ControlButton
          onPress={onPlayPause}
          disabled={isLoading}
          nextFocusDown={nextFocusDown}
          hasTVPreferredFocus
          onLayout={onLayoutPlayPause}>
          {(focused) => isLoading ? (
            <Svg width="24" height="24" viewBox="0 0 24 24" fill={iconColor(focused)}>
              <Path d="M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" opacity="0.3"/>
            </Svg>
          ) : isPlaying ? (
            <Svg width="24" height="24" viewBox="0 0 24 24" fill={iconColor(focused)}>
              <Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </Svg>
          ) : (
            <Svg width="24" height="24" viewBox="0 0 24 24" fill={iconColor(focused)}>
              <Path d="M8 5v14l11-7z" />
            </Svg>
          )}
        </ControlButton>

        <ControlButton onPress={onNext} disabled={!canNext} nextFocusDown={nextFocusDown}>
          {(focused) => (
            <Svg width="24" height="24" viewBox="0 0 24 24" fill={iconColor(focused)}>
              <Path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </Svg>
          )}
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
  buttonDisabled: {
    opacity: 0.3,
  },
});
