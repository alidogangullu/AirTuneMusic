import React from 'react';
import {StyleSheet, View} from 'react-native';
import Svg, {G, Path} from 'react-native-svg';

interface LyricIconButtonProps {
  active?: boolean;
  focused?: boolean;
}

export function LyricIconButton({
  active = false,
  focused = false,
}: LyricIconButtonProps): React.JSX.Element {
  const color = active || focused ? '#fff' : 'rgba(255, 255, 255, 0.4)';

  return (
    <View style={styles.container}>
      <Svg width="24" height="24" viewBox="0 0 100 100">
        <G
          transform="translate(0, 100) scale(0.1, -0.1)"
          fill={color}
          stroke={color}
          strokeWidth="45"
          strokeLinecap="round"
          strokeLinejoin="round">
          <Path d="M173 845 c-18 -8 -42 -29 -53 -47 -18 -30 -20 -50 -20 -243 0 -185 2 -215 18 -245 23 -44 73 -70 134 -70 l47 0 3 -77 c2 -45 8 -78 14 -80 6 -2 42 32 80 76 l69 80 165 0 c266 1 270 6 270 311 0 322 16 310 -400 310 -231 -1 -302 -4 -327 -15z m658 -54 l29 -29 0 -211 c0 -207 0 -210 -24 -238 l-24 -28 -181 -3 -181 -3 -52 -61 -53 -61 -5 59 -5 59 -73 5 c-65 4 -77 8 -98 33 -24 28 -24 31 -24 238 l0 211 29 29 29 29 302 0 302 0 29 -29z" />
          <Path d="M342 637 c-12 -13 -22 -35 -22 -50 0 -32 32 -67 60 -67 26 0 25 -8 -2 -37 -16 -17 -19 -26 -11 -34 29 -29 93 62 93 132 0 69 -74 103 -118 56z m73 -47 c0 -18 -6 -26 -23 -28 -13 -2 -25 3 -28 12 -10 26 4 48 28 44 17 -2 23 -10 23 -28z" />
          <Path d="M562 637 c-12 -13 -22 -35 -22 -50 0 -32 32 -67 60 -67 26 0 25 -8 -2 -37 -16 -17 -19 -26 -11 -34 29 -29 93 62 93 132 0 69 -74 103 -118 56z m73 -47 c0 -18 -6 -26 -23 -28 -13 -2 -25 3 -28 12 -10 26 4 48 28 44 17 -2 23 -10 23 -28z" />
        </G>
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
