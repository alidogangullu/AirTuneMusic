import { useEffect } from 'react';
import { Platform } from 'react-native';
import { AndroidTvChannels } from '../../../services/androidTvChannels';
import type { RecommendationSection } from '../../recommendations/hooks/useRecommendations';

export function useSyncTvChannels(sections: RecommendationSection[] | undefined) {
  useEffect(() => {
    if (Platform.OS !== 'android' || !sections || sections.length === 0) return;

    // Run sync in background when home screen sections update
    AndroidTvChannels.syncRecommendationSections(sections).catch(err => {
      console.error('[useSyncTvChannels] Error syncing channels:', err);
    });
  }, [sections]);
}
