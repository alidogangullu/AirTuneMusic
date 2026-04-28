/**
 * Shared component for horizontal content rails.
 * Used in Listen Now and Browse screens.
 */

import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ContentSection } from './ContentSection';
import { RecommendationCard } from './RecommendationCard';
import { RecommendationContent } from '../../../types/recommendations';
import { useContentNavigation } from '../../home/navigation';
import { spacing } from '../../../theme/layout';

export type ContentRailProps = {
  title: string;
  subtitle?: string;
  contents: RecommendationContent[];
};

export function ContentRail({
  title,
  subtitle,
  contents,
}: Readonly<ContentRailProps>): React.JSX.Element {
  const { pushContent } = useContentNavigation();

  if (contents.length === 0) return <></>;

  return (
    <ContentSection title={title} subtitle={subtitle}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.horizontalScroll}
        contentContainerStyle={styles.rail}>
        {contents.map((content) => (
          <RecommendationCard
            key={content.id}
            category=""
            content={content}
            onPress={() => pushContent(content)}
          />
        ))}
      </ScrollView>
    </ContentSection>
  );
}

const styles = StyleSheet.create({
  horizontalScroll: {
    overflow: 'visible',
  },
  rail: {
    flexDirection: 'row',
    paddingRight: spacing.xl,
    gap: spacing.sm,
  },
});
