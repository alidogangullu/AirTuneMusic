/**
 * Listen Now screen — Top Picks from recommendations API.
 */

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ContentSection} from '../components/ContentSection';
import {RecommendationCard} from '../components/RecommendationCard';
import {
  flattenRecommendationContents,
  useRecommendations,
} from '../hooks/useRecommendations';
import {spacing} from '../theme/layout';
import {useTheme} from '../theme';

export function ListenNowScreen(): React.JSX.Element {
  const {colors} = useTheme();
  const {data, isLoading, error, refetch} = useRecommendations();
  const styles = useStyles(colors);

  const items = data?.data
    ? flattenRecommendationContents(data.data).slice(0, 12)
    : [];

  const errorMessage =
    error instanceof Error ? error.message : 'Failed to load';

  let topPicksContent: React.ReactNode;
  if (isLoading) {
    topPicksContent = (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  } else if (error) {
    topPicksContent = (
      <View style={styles.error}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Yenile</Text>
        </Pressable>
      </View>
    );
  } else if (items.length === 0) {
    topPicksContent = (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No recommendations yet</Text>
      </View>
    );
  } else {
    topPicksContent = (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}>
        {items.map(({recommendationTitle, content}) => (
          <RecommendationCard
            key={content.id}
            category={recommendationTitle}
            content={content}
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <ContentSection title="Top Picks">{topPicksContent}</ContentSection>
    </ScrollView>
  );
}

function useStyles(c: {textMuted: string; accent: string}) {
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
      paddingTop: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    rail: {
      flexDirection: 'row',
      paddingRight: spacing.xl,
      gap: spacing.lg,
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
