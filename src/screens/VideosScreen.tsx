import React from 'react';
import { RecommendationScreen } from '../components/RecommendationScreen';
import { useVideoCharts, useVideoRecommendations, useRecentlyPlayedVideos, useLibraryMusicVideos, RecommendationSection } from '../hooks/useRecommendations';
import { useTranslation } from 'react-i18next';
import type { MusicVideoDetail } from '../types/catalog';

function videoToContent(video: MusicVideoDetail) {
  return {
    id: video.id,
    type: 'music-videos' as const,
    attributes: {
      name: video.attributes?.name,
      artistName: video.attributes?.artistName,
      artwork: video.attributes?.artwork,
      url: video.attributes?.url,
      releaseDate: video.attributes?.releaseDate,
      genreNames: video.attributes?.genreNames,
    },
  };
}

export function VideosScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const charts = useVideoCharts();
  const recs = useVideoRecommendations();
  const recentlyPlayed = useRecentlyPlayedVideos();
  const library = useLibraryMusicVideos();

  const isLoading = charts.isLoading || recs.isLoading || recentlyPlayed.isLoading || library.isLoading;
  const error = charts.error || recs.error || recentlyPlayed.error || library.error;
  const refetch = React.useCallback(() => {
    charts.refetch();
    recs.refetch();
    recentlyPlayed.refetch();
    library.refetch();
  }, [charts, recs, recentlyPlayed, library]);

  const sections = React.useMemo((): RecommendationSection[] => {
    const chartSections: RecommendationSection[] = (charts.data ?? [])
      .filter(s => s.videos.length > 0)
      .map(s => ({
        title: s.title,
        isCategorical: true,
        isRadio: false,
        contents: s.videos.map(videoToContent),
      }));

    const recSections: RecommendationSection[] = (recs.data ?? [])
      .filter(s => s.videos.length > 0)
      .map(s => ({
        title: s.title,
        isCategorical: true,
        isRadio: false,
        contents: s.videos.map(videoToContent),
      }));

    const recentVideos = recentlyPlayed.data ?? [];
    const recentSection: RecommendationSection[] = recentVideos.length > 0
      ? [{
          title: t('videos.recentlyPlayed'),
          isCategorical: false,
          isRadio: false,
          contents: recentVideos.map(videoToContent),
        }]
      : [];

    const libraryVideos = library.data ?? [];
    const librarySection: RecommendationSection[] = libraryVideos.length > 0
      ? [{
          title: t('videos.library'),
          isCategorical: false,
          isRadio: false,
          contents: libraryVideos.map(videoToContent),
        }]
      : [];

    return [...recentSection, ...chartSections, ...recSections, ...librarySection];
  }, [charts.data, recs.data, recentlyPlayed.data, library.data, t]);

  return (
    <RecommendationScreen
      sections={sections}
      isLoading={isLoading}
      error={error}
      refetch={refetch}
    />
  );
}
