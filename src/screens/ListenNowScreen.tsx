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
import {ContentSection} from '../components/ContentSection';
import {RecommendationCard} from '../components/RecommendationCard';
import {
  flattenRecommendationContents,
  useRecommendations,
} from '../hooks/useRecommendations';
import {useContentNavigation} from '../navigation';
import {spacing} from '../theme/layout';
import {useTheme} from '../theme';

export function ListenNowScreen(): React.JSX.Element {
  const {colors} = useTheme();
  const {data, isLoading, error, refetch} = useRecommendations();
  const {pushContent} = useContentNavigation();
  const styles = useStyles(colors);

  const allItems = data?.data ? flattenRecommendationContents(data.data) : [];

  // split recommendations into the two main headings we care about
  const madeForYouItems = allItems
    .filter(i => i.recommendationTitle === 'Made for You')
    .slice(0, 12);
  const recentlyPlayedItems = allItems
    .filter(i => i.recommendationTitle === 'Recently Played')
    .slice(0, 12);

  const errorMessage =
    error instanceof Error ? error.message : 'Failed to load';

  let contentNode: React.ReactNode;
    if (isLoading) {
      const LoadingIndicator = require('../components/LoadingIndicator').LoadingIndicator;
      contentNode = <LoadingIndicator />;
  } else if (error) {
    contentNode = (
      <View style={styles.error}>
        <Text style={styles.errorText}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Yenile</Text>
        </Pressable>
      </View>
    );
  } else if (allItems.length === 0) {
    contentNode = (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No recommendations yet</Text>
      </View>
    );
  } else {
    contentNode = (
      <>
        {madeForYouItems.length > 0 && (
          <ContentSection title="Made for You">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.rail}>
              {madeForYouItems.map(({content}) => (
                <RecommendationCard
                  key={content.id}
                  category=""
                  content={content}
                  onPress={() => pushContent(content)}
                />
              ))}
            </ScrollView>
          </ContentSection>
        )}
        {recentlyPlayedItems.length > 0 && (
          <ContentSection title="Recently Played">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.rail}>
              {recentlyPlayedItems.map(({content}) => (
                <RecommendationCard
                  key={content.id}
                  category=""
                  content={content}
                  onPress={() => pushContent(content)}
                />
              ))}
            </ScrollView>
          </ContentSection>
        )}
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
      paddingTop: 70,
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
