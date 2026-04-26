/**
 * Home screen — MainLayout with TopBar + tab-based content.
 * TopBar and avatar stay visible; content switches by tab.
 * Provides ContentNavigationContext so child screens can push detail views.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, StyleSheet, View, BackHandler, ToastAndroid } from 'react-native';
import { GradientBackground } from '../components/GradientBackground';
import { MainLayout } from '../components/MainLayout';
import { ContentNavigationContext } from '../navigation';
import { ArtistDetailScreen } from './ArtistDetailScreen';
import { ContentDetailScreen } from './ContentDetailScreen';
import { NowPlayingScreen } from './NowPlayingScreen';
import { SettingsScreen } from './SettingsScreen';
import type { NavTabId } from '../components/TopBar';
import type { RecommendationContent } from '../types/recommendations';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { usePlayer } from '../hooks/usePlayer';
import { useAppStartup } from '../components/AppStartupProvider';
import { useLibraryMembershipSnapshot } from '../hooks/useLibraryMembership';

export type HomeScreenProps = {
  onSignOut?: () => void;
};

export function HomeScreen({
  onSignOut,
}: Readonly<HomeScreenProps>): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { updateInfo } = useAppStartup();
  const [activeTab, setActiveTab] = useState<NavTabId>('listen-now');
  const [selectedContent, setSelectedContent] =
    useState<RecommendationContent | null>(null);
  const [nowPlayingFullscreen, setNowPlayingFullscreen] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [lastOpened, setLastOpened] = useState<'detail' | 'now-playing' | null>(null);

  // When player hook triggers settings (quota reached), show it
  const { showSettings: playerWantsSettings, setShowSettings } = usePlayer();
  useLibraryMembershipSnapshot();
  const isDetailOpen = selectedContent !== null;
  const [lastBackPressed, setLastBackPressed] = useState(0);

  // Handle back button for tab navigation and double-back exit
  React.useEffect(() => {
    const onBackPress = () => {
      // If any modal is open, let the modal's onRequestClose handle it
      if (settingsVisible || isDetailOpen || nowPlayingFullscreen) {
        return false;
      }

      // If not on the main tab, go back to the main tab
      if (activeTab !== 'listen-now') {
        setActiveTab('listen-now');
        return true;
      }

      // If on the main tab, check for double-back exit
      const now = Date.now();
      if (lastBackPressed && now - lastBackPressed < 2000) {
        // Exit app
        return false;
      }

      setLastBackPressed(now);
      ToastAndroid.show(t('common.exitPressAgain'), ToastAndroid.SHORT);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => backHandler.remove();
  }, [activeTab, settingsVisible, isDetailOpen, nowPlayingFullscreen, lastBackPressed, t]);

  React.useEffect(() => {
    if (playerWantsSettings) {
      setSettingsVisible(true);
      // Reset the request after showing
      setShowSettings(false);
    }
  }, [playerWantsSettings, setShowSettings]);

  const pushContent = useCallback((content: RecommendationContent) => {
    setSelectedContent(content);
    setLastOpened('detail');
  }, []);

  const popContent = useCallback(() => {
    setSelectedContent(null);
  }, []);

  const openNowPlayingFullscreen = useCallback(() => {
    setNowPlayingFullscreen(true);
    setLastOpened('now-playing');
  }, []);

  const closeNowPlayingFullscreen = useCallback(() => {
    setNowPlayingFullscreen(false);
  }, []);

  const ctxValue = useMemo(
    () => ({ pushContent, openNowPlayingFullscreen }),
    [pushContent, openNowPlayingFullscreen],
  );

  const handleSignOut = useCallback(() => {
    Alert.alert(
      t('home.signOutTitle'),
      t('home.signOutMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('home.signOutConfirm'),
          style: 'destructive',
          onPress: onSignOut,
        },
      ],
      { cancelable: true },
    );
  }, [onSignOut, t]);

  return (
    <ContentNavigationContext.Provider value={ctxValue}>
      <View style={styles.root}>
        <MainLayout
          activeTab={activeTab}
          onTabPress={setActiveTab}
          onAvatarPress={handleSignOut}
          onSearchPress={() => setActiveTab('search')}
          onSettingsPress={() => setSettingsVisible(true)}
          hasUpdate={updateInfo?.status === 'optional_update'}
        />

        {/* Modal ensures OS-level focus trapping — Android creates a new Window,
            so D-pad key events never reach the MainLayout behind it. */}
        {/* Fullscreen Now Playing — opened when a track is played */}
        <Modal
          visible={nowPlayingFullscreen && (lastOpened === 'now-playing' || !isDetailOpen)}
          animationType="none"
          onRequestClose={closeNowPlayingFullscreen}>
          <NowPlayingScreen onBack={closeNowPlayingFullscreen} />
        </Modal>

        {/* Modal ensures OS-level focus trapping — Android creates a new Window,
            so D-pad key events never reach the MainLayout behind it. */}
        <Modal
          visible={isDetailOpen && (lastOpened === 'detail' || !nowPlayingFullscreen)}
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
            updateInfo={updateInfo}
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

