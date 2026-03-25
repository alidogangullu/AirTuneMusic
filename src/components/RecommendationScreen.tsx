/**
 * Shared layout component for Listen Now and Browse screens.
 * Handles loading, error, empty, and scrollable rails.
 */

import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { spacing } from '../theme/layout';
import { useTheme } from '../theme';
import { ContentRail } from './ContentRail';
import { RecommendationSection } from '../hooks/useRecommendations';
import { LoadingIndicator } from './LoadingIndicator';

export type RecommendationScreenProps = {
  sections: RecommendationSection[];
  isLoading: boolean;
  error: any;
  refetch: () => void;
};

export function RecommendationScreen({
  sections,
  isLoading,
  error,
  refetch,
}: Readonly<RecommendationScreenProps>): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(colors);

  const errorMessage = React.useMemo(
    () => (error instanceof Error ? error.message : t('common.failedToLoad')),
    [error, t],
  );

  let contentNode: React.ReactNode;
  if (isLoading) {
    contentNode = <LoadingIndicator />;
  } else if (error) {
    contentNode = (
      <View style={styles.error}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={refetch}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  } else if (sections.length === 0) {
    contentNode = (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('detail.noRecommendationsYet')}</Text>
      </View>
    );
  } else {
    contentNode = (
      <>
        {sections.map((section: RecommendationSection, idx: number) => (
          <ContentRail
            key={`${section.title}-${idx}`}
            title={section.title}
            contents={section.contents}
          />
        ))}
      </>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      {contentNode}
    </ScrollView>
  );
}

function useStyles(c: { textMuted: string; accent: string }) {
  return StyleSheet.create({
    retryButton: {
      marginTop: 12,
      paddingHorizontal: 16,
      paddingVertical: 8,
      backgroundColor: c.accent,
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    retryButtonText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: '600',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingTop: 85,
      paddingBottom: spacing.xxxl,
    },
    error: {
      minHeight: 120,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    errorText: {
      color: c.textMuted,
      fontSize: 15,
    },
    empty: {
      minHeight: 120,
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 15,
    },
  });
}
