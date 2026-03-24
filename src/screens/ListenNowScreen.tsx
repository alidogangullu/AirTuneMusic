/**
 * Listen Now screen — Top Picks from recommendations API.
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
import { ContentSection } from '../components/ContentSection';
import { RecommendationCard } from '../components/RecommendationCard';
import {
  groupRecommendations,
  RecommendationSection,
  useRecommendations,
} from '../hooks/useRecommendations';
import { RecommendationContent } from '../types/recommendations';
import { useContentNavigation } from '../navigation';
import { spacing } from '../theme/layout';
import { useTheme } from '../theme';

function _ListenNowScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, isLoading, error, refetch } = useRecommendations();
  const { pushContent } = useContentNavigation();
  const styles = React.useMemo(() => useStyles(colors), [colors]);

  const sections = React.useMemo(
    () => (data?.data ? groupRecommendations(data.data) : []),
    [data?.data],
  );

  const errorMessage = React.useMemo(
    () => (error instanceof Error ? error.message : t('common.failedToLoad')),
    [error, t],
  );

  let contentNode: React.ReactNode;
  if (isLoading) {
    const LoadingIndicator = require('../components/LoadingIndicator').LoadingIndicator;
    contentNode = <LoadingIndicator />;
  } else if (error) {
    contentNode = (
      <View style={styles.error}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>{t('common.retry')}</Text>
        </Pressable>
      </View>
    );
  } else if (sections.length === 0) {
    contentNode = (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{t('detail.noRecommendationsYet') || 'No recommendations yet'}</Text>
      </View>
    );
  } else {
    contentNode = (
      <>
        {sections.map((section: RecommendationSection, idx: number) => (
          <ContentSection key={`${section.title}-${idx}`} title={section.title}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.rail}>
              {section.contents.map((content: RecommendationContent) => (
                <RecommendationCard
                  key={content.id}
                  category=""
                  content={content}
                  onPress={() => pushContent(content)}
                />
              ))}
            </ScrollView>
          </ContentSection>
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

export const ListenNowScreen = React.memo(_ListenNowScreen);

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
    rail: {
      flexDirection: 'row',
      paddingRight: spacing.xl,
      gap: spacing.sm,
    },
    horizontalScroll: {
      overflow: 'visible', // hint to RN layout system
    },
    loading: {
      minHeight: 200,
      justifyContent: 'center',
      alignItems: 'center',
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
