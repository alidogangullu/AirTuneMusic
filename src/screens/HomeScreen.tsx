/**
 * Home screen — MainLayout with TopBar + tab-based content.
 * TopBar and avatar stay visible; content switches by tab.
 * Provides ContentNavigationContext so child screens can push detail views.
 */

import React, {useCallback, useMemo, useState} from 'react';
import {Modal, StyleSheet, View} from 'react-native';
import {GradientBackground} from '../components/GradientBackground';
import {MainLayout} from '../components/MainLayout';
import {ContentNavigationContext} from '../navigation';
import {ContentDetailScreen} from './ContentDetailScreen';
import type {NavTabId} from '../components/TopBar';
import type {RecommendationContent} from '../types/recommendations';
import {useTheme} from '../theme';

export type HomeScreenProps = {
  onSignOut?: () => void;
};

export function HomeScreen({
  onSignOut,
}: Readonly<HomeScreenProps>): React.JSX.Element {
  const {colors} = useTheme();
  const [activeTab, setActiveTab] = useState<NavTabId>('listen-now');
  const [selectedContent, setSelectedContent] =
    useState<RecommendationContent | null>(null);

  const pushContent = useCallback((content: RecommendationContent) => {
    setSelectedContent(content);
  }, []);

  const popContent = useCallback(() => {
    setSelectedContent(null);
  }, []);

  const ctxValue = useMemo(() => ({pushContent}), [pushContent]);

  const isDetailOpen = selectedContent !== null;

  return (
    <ContentNavigationContext.Provider value={ctxValue}>
      <View style={styles.root}>
        <MainLayout
          activeTab={activeTab}
          onTabPress={setActiveTab}
          onAvatarPress={onSignOut}
          onSearchPress={() => {}}
        />

        {/* Modal ensures OS-level focus trapping — Android creates a new Window,
            so D-pad key events never reach the MainLayout behind it. */}
        <Modal
          visible={isDetailOpen}
          animationType="none"
          onRequestClose={popContent}>
          {selectedContent !== null && (
            <GradientBackground
              startColor={colors.appleMusicLowPink}
              endColor={colors.appleMusicWhite}>
              <ContentDetailScreen
                contentId={selectedContent.id}
                contentType={selectedContent.type}
                onBack={popContent}
              />
            </GradientBackground>
          )}
        </Modal>
      </View>
    </ContentNavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

