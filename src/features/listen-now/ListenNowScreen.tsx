import React from 'react';
import { RecommendationScreen } from '../recommendations/RecommendationScreen';
import {
  groupRecommendations,
  useRecommendations,
} from '../recommendations/hooks/useRecommendations';
import { useSyncTvChannels } from '../home/hooks/useSyncTvChannels';

export function ListenNowScreen(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useRecommendations();

  const sections = React.useMemo(() => {
    if (!data?.data) return [];
    const all = groupRecommendations(data.data);
    return all.filter(section => !section.isCategorical && !section.isRadio);
  }, [data?.data]);

  // Auto-sync recommendations to Android TV Home Screen Channels
  useSyncTvChannels(sections);

  return (
    <RecommendationScreen
      sections={sections}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
    />
  );
}

