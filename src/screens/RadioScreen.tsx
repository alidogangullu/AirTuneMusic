import React from 'react';
import { RecommendationScreen } from '../components/RecommendationScreen';
import { useRadioStations } from '../hooks/useRadio';
import { RecommendationSection, useRecommendations, groupRecommendations } from '../hooks/useRecommendations';
import { useTranslation } from 'react-i18next';
import { RecommendationContent } from '../types/recommendations';

export function RadioScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { liveRadio, personalRadio, recentRadio, isLoading: radioLoading, error: radioError, refetch: refetchRadio } = useRadioStations();
  const { data: recsData, isLoading: recsLoading, error: recsError, refetch: refetchRecs } = useRecommendations();

  const isLoading = radioLoading || recsLoading;
  const error = radioError || recsError;
  const refetch = React.useCallback(() => {
    refetchRadio();
    refetchRecs();
  }, [refetchRadio, refetchRecs]);

  const mapStationToContent = (station: any): RecommendationContent => ({
    id: station.id,
    type: 'stations',
    attributes: {
      name: station.attributes?.name,
      artwork: station.attributes?.artwork,
      url: station.attributes?.url,
    },
  });

  const radioSections = React.useMemo(() => {
    const sections: RecommendationSection[] = [];

    // 1. Live Radio
    if (liveRadio.data?.data && liveRadio.data.data.length > 0) {
      sections.push({
        title: t('radio.liveRadio') || 'Live Radio',
        isCategorical: true,
        isRadio: true,
        contents: liveRadio.data.data.map(mapStationToContent),
      });
    }

    // 2. Personal Station
    if (personalRadio.data?.data && personalRadio.data.data.length > 0) {
      sections.push({
        title: t('radio.personalStation') || 'Your Station',
        isCategorical: true,
        isRadio: true,
        contents: personalRadio.data.data.map(mapStationToContent),
      });
    }

    // 3. Recently Played
    if (recentRadio.data?.data && recentRadio.data.data.length > 0) {
      sections.push({
        title: t('radio.recentlyPlayed') || 'Recently Played',
        isCategorical: true,
        isRadio: true,
        contents: recentRadio.data.data.map(mapStationToContent),
      });
    }

    // 4. Stations for You (from /me/recommendations)
    if (recsData?.data) {
      const allRecs = groupRecommendations(recsData.data);
      sections.push(...allRecs.filter(s => s.isRadio));
    }

    return sections;
  }, [liveRadio.data, personalRadio.data, recentRadio.data, recsData, t]);

  return (
    <RecommendationScreen
      sections={radioSections}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
    />
  );
}
