/**
 * Content section for Home screen — title + horizontal rail placeholder.
 * Apple Music style: "Top Picks", "Recently Played", etc.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { spacing } from '../theme/layout';

export type ContentSectionProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function ContentSection({
  title,
  subtitle,
  children,
}: Readonly<ContentSectionProps>): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useStyles(colors);

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle && subtitle.length > 0 ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.rail}>{children}</View>
    </View>
  );
}

function useStyles(c: { textOnDark: string; textMuted: string }) {
  return StyleSheet.create({
    section: {
      marginBottom: spacing.xl,
    },
    header: {
      marginBottom: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: c.textOnDark,
    },
    rail: {
      flexDirection: 'row',
      paddingLeft: spacing.xl,
      gap: spacing.xs,
    },
    subtitle: {
      fontSize: 16,
      color: c.textMuted,
    },
  });
}
