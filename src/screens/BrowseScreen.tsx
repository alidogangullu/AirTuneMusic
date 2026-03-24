/**
 * Browse screen — placeholder.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing } from '../theme/layout';
import { useTheme } from '../theme';

export function BrowseScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(colors);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{t('topBar.browse')}</Text>
      <Text style={styles.subtitle}>{t('common.comingSoon') || 'Coming soon'}</Text>
    </View>
  );
}

function useStyles(c: { textOnDark: string; textMuted: string }) {
  return StyleSheet.create({
    root: {
      flex: 1,
      padding: spacing.xl,
      paddingTop: 85,
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
