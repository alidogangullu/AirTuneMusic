/**
 * Gradient background — Apple Music pink (top-left) to white (bottom-right).
 * Uses react-native-linear-gradient (AGP 8 + Java 17).
 */

import React from 'react';
import {StyleSheet} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export type GradientBackgroundProps = {
  startColor: string;
  endColor: string;
  children?: React.ReactNode;
};

export function GradientBackground({
  startColor,
  endColor,
  children,
}: Readonly<GradientBackgroundProps>): React.JSX.Element {
  return (
    <LinearGradient
      colors={[startColor, endColor]}
      start={{x: 0, y: 0}}
      end={{x: 1, y: 1}}
      style={styles.container}>
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
});
