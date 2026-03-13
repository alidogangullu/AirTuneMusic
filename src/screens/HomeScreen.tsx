/**
 * Home screen — MainLayout with TopBar + tab-based content.
 * TopBar and avatar stay visible; content switches by tab.
 * Provides ContentNavigationContext so child screens can push detail views.
 */

import React, {useCallback, useMemo, useState} from 'react';
import {Alert, Modal, StyleSheet, View} from 'react-native';
import {GradientBackground} from '../components/GradientBackground';
import {MainLayout} from '../components/MainLayout';
import {ContentNavigationContext} from '../navigation';
import {ArtistDetailScreen} from './ArtistDetailScreen';
import {ContentDetailScreen} from './ContentDetailScreen';
import {NowPlayingScreen} from './NowPlayingScreen';
import {SettingsScreen} from './SettingsScreen';
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
  const [nowPlayingFullscreen, setNowPlayingFullscreen] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

  const pushContent = useCallback((content: RecommendationContent) => {
    setSelectedContent(content);
  }, []);

  const popContent = useCallback(() => {
    setSelectedContent(null);
  }, []);

  const openNowPlayingFullscreen = useCallback(() => {
    setNowPlayingFullscreen(true);
  }, []);

  const closeNowPlayingFullscreen = useCallback(() => {
    setNowPlayingFullscreen(false);
  }, []);

  const ctxValue = useMemo(
    () => ({pushContent, openNowPlayingFullscreen}),
    [pushContent, openNowPlayingFullscreen],
  );

  const isDetailOpen = selectedContent !== null;

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: onSignOut,
        },
      ],
      {cancelable: true},
    );
  }, [onSignOut]);

  return (
    <ContentNavigationContext.Provider value={ctxValue}>
      <View style={styles.root}>
        <MainLayout
          activeTab={activeTab}
          onTabPress={setActiveTab}
          onAvatarPress={handleSignOut}
          onSearchPress={() => setActiveTab('search')}
          onSettingsPress={() => setSettingsVisible(true)}
        />

        {/* Modal ensures OS-level focus trapping — Android creates a new Window,
            so D-pad key events never reach the MainLayout behind it. */}
        <Modal
          visible={isDetailOpen}
          animationType="none"
          onRequestClose={popContent}>
          {selectedContent !== null && (
            <GradientBackground
              startColor={colors.gradientStart}
              endColor={colors.gradientEnd}>
              {selectedContent.type === 'artists' ? (
                <ArtistDetailScreen
                  artistId={selectedContent.id}
                  onBack={popContent}
                />
              ) : (
                <ContentDetailScreen
                  contentId={selectedContent.id}
                  contentType={selectedContent.type}
                  onBack={popContent}
                />
              )}
            </GradientBackground>
          )}
        </Modal>

        {/* Fullscreen Now Playing — opened when a track is played */}
        <Modal
          visible={nowPlayingFullscreen}
          animationType="none"
          onRequestClose={closeNowPlayingFullscreen}>
          <NowPlayingScreen onBack={closeNowPlayingFullscreen} />
        </Modal>

        {/* Settings screen */}
        <Modal
          visible={settingsVisible}
          animationType="none"
          onRequestClose={() => setSettingsVisible(false)}>
          <SettingsScreen
            onBack={() => setSettingsVisible(false)}
            onSignOut={() => {
              setSettingsVisible(false);
              handleSignOut();
            }}
          />
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

