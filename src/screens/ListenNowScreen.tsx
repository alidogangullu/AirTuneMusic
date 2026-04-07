import React from 'react';
import { RecommendationScreen } from '../components/RecommendationScreen';
import {
  groupRecommendations,
  useRecommendations,
} from '../hooks/useRecommendations';

export function ListenNowScreen(): React.JSX.Element {
  const { data, isLoading, error, refetch } = useRecommendations();

  const sections = React.useMemo(() => {
    if (!data?.data) return [];
    const all = groupRecommendations(data.data);
    return all.filter(section => !section.isCategorical && !section.isRadio);
  }, [data?.data]);

  return (
    <RecommendationScreen
      sections={sections}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
    />
  );
}

