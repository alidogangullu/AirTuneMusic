import React from 'react';
import { RecommendationScreen } from '../components/RecommendationScreen';
import {
  groupRecommendations,
  useRecommendations,
  useCharts,
  RecommendationSection,
} from '../hooks/useRecommendations';
import { useTranslation } from 'react-i18next';

export function BrowseScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: recsData, isLoading: recsLoading, error: recsError, refetch: refetchRecs } = useRecommendations();
  const { data: chartsData, isLoading: chartsLoading, error: chartsError, refetch: refetchCharts } = useCharts();

  const browseSections = React.useMemo(() => {
    const sections: RecommendationSection[] = [];

    // 1. Localized Popular Charts from catalog (Top of the page)
    if (chartsData?.results) {
      // Top Playlists
      if (chartsData.results.playlists?.[0]?.data?.length > 0) {
        sections.push({
          title: chartsData.results.playlists[0].name || t('topBar.playlists'),
          isCategorical: true,
          contents: chartsData.results.playlists[0].data,
        });
      }
      // Top Albums
      if (chartsData.results.albums?.[0]?.data?.length > 0) {
        sections.push({
          title: chartsData.results.albums[0].name || t('topBar.albums'),
          isCategorical: true,
          contents: chartsData.results.albums[0].data,
        });
      }
    }

    // 2. Categorical Recommendations from /me/recommendations
    if (recsData?.data) {
      const allRecs = groupRecommendations(recsData.data);
      sections.push(...allRecs.filter(s => s.isCategorical));
    }

    return sections;
  }, [recsData?.data, chartsData?.results, t]);

  const isLoading = recsLoading || chartsLoading;
  const error = recsError || chartsError;
  const refetch = () => {
    refetchRecs();
    refetchCharts();
  };

  return (
    <RecommendationScreen
      sections={browseSections}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
    />
  );
}
