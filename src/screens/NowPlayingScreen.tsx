/**
 * Now Playing screen — placeholder.
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {spacing} from '../theme/layout';
import {useTheme} from '../theme';

export function NowPlayingScreen(): React.JSX.Element {
  const {colors} = useTheme();
  const styles = useStyles(colors);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Now Playing</Text>
      <Text style={styles.subtitle}>Coming soon</Text>
    </View>
  );
}

function useStyles(c: {textOnDark: string; textMuted: string}) {
  return StyleSheet.create({
    root: {
      flex: 1,
      padding: spacing.xl,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: c.textOnDark,
    },
    subtitle: {
      fontSize: 16,
      color: c.textMuted,
      marginTop: spacing.sm,
    },
  });
}
