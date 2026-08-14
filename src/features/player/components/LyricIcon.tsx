import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';
import { lightColors as colors } from '../../../theme/colors';

interface LyricIconProps {
  readonly active?: boolean;
  readonly focused?: boolean;
  readonly color?: string;
  readonly accessibilityLabel?: string;
}

export function LyricIcon({
  active = false,
  focused = false,
  color: colorProp,
  accessibilityLabel,
}: LyricIconProps): React.JSX.Element {
  const color = colorProp ?? (active || focused ? colors.onDarkTextPrimary : colors.onDarkTextDim);

  return (
    <View
      style={styles.container}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? 'Lyrics'}
      accessibilityState={{
        selected: active,
      }}>
      <Svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <Path d="M4 6c0-1.1.9-2 2-2h12c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2h-4.5l-4.5 3.5v-3.5H6c-1.1 0-2-.9-2-2V6z" />
        <Path d="M9 10.5v1.5c0 1.5-1.5 2.5-1.5 2.5" />
        <Path d="M14 10.5v1.5c0 1.5-1.5 2.5-1.5 2.5" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
