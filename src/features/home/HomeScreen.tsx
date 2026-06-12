/**
 * Home screen — MainLayout with TopBar + tab-based content.
 * TopBar and avatar stay visible; content switches by tab.
 * Provides ContentNavigationContext so child screens can push detail views.
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, View, BackHandler, ToastAndroid } from 'react-native';
import { GradientBackground } from '../../components/GradientBackground';
import { MotionSuspenseProvider } from '../../components/MotionSuspenseContext';
import { MainLayout } from './MainLayout';
import { ContentNavigationContext } from './navigation';
import { ArtistDetailScreen } from '../content/ArtistDetailScreen';
import { ContentDetailScreen } from '../content/ContentDetailScreen';
import { QuotaLimitScreen } from '../content/QuotaLimitScreen';
import { NowPlayingScreen } from '../now-playing/NowPlayingScreen';
import { SettingsScreen, SettingsScreenHandle } from '../settings/SettingsScreen';
import type { NavTabId } from './TopBar';
import type { RecommendationContent } from '../../types/recommendations';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { usePlayer } from '../player/hooks/usePlayer';
import { useAppStartup } from '../bootstrap/components/AppStartupProvider';
import { useLibraryMembershipSnapshot } from '../library/hooks/useLibraryMembership';

export type HomeScreenProps = {
  onSignOut?: () => void;
};

export function HomeScreen({
  onSignOut,
}: Readonly<HomeScreenProps>): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { updateInfo, announcements, readAnnouncementIds, hasUnreadAnnouncements, markAnnouncementRead, needsCancelSubscription } = useAppStartup();
  const [activeTab, setActiveTab] = useState<NavTabId>('listen-now');
  const [contentStack, setContentStack] =
    useState<RecommendationContent[]>([]);
  const selectedContent = contentStack.at(-1) ?? null;
  const [nowPlayingFullscreen, setNowPlayingFullscreen] = useState(false);
  const settingsRef = useRef<SettingsScreenHandle>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [settingsInitialSubMenu, setSettingsInitialSubMenu] = useState<'none' | 'subscription'>('none');
  const [lastOpened, setLastOpened] = useState<'detail' | 'now-playing' | null>(null);

  // When player hook triggers settings (quota reached), show it
  const {
    showSettings: playerWantsSettings,
    setShowSettings,
    quotaRecoveryRequest,
    dismissQuotaRecovery,
    startQuotaRewardAd,
    adInFlight,
  } = usePlayer();
  useLibraryMembershipSnapshot();
  const isDetailOpen = contentStack.length > 0;
  // Any overlay window covering the base layer — motion artwork covers under
  // it must release their video players (see MotionSuspenseContext).
  const overlayActive =
    isDetailOpen || nowPlayingFullscreen || settingsVisible || Boolean(quotaRecoveryRequest);
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
    setContentStack(prev => [...prev, content]);
    setLastOpened('detail');
  }, []);

  const popContent = useCallback(() => {
    setContentStack(prev => prev.slice(0, -1));
    if (nowPlayingFullscreen) {
      setLastOpened('now-playing');
    }
  }, [nowPlayingFullscreen]);

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

  const handleSearchPress = useCallback(() => setActiveTab('search'), []);
  const handleSettingsPress = useCallback(() => setSettingsVisible(true), []);

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
        {/* Wraps ONLY the base layer: the Modals below are JSX siblings, so
            their contents see the context default (not suspended) and their
            own motion covers keep playing. */}
        <MotionSuspenseProvider suspended={overlayActive}>
          <MainLayout
            activeTab={activeTab}
            onTabPress={setActiveTab}
            onAvatarPress={handleSignOut}
            onSearchPress={handleSearchPress}
            onSettingsPress={handleSettingsPress}
            hasUpdate={updateInfo?.status === 'optional_update'}
            hasUnreadAnnouncements={hasUnreadAnnouncements}
            needsCancelSubscription={needsCancelSubscription}
          />
        </MotionSuspenseProvider>

        {/* Modal ensures OS-level focus trapping — Android creates a new Window,
            so D-pad key events never reach the MainLayout behind it. */}
        {/* Fullscreen Now Playing — opened when a track is played */}
        <Modal
          visible={nowPlayingFullscreen && (lastOpened === 'now-playing' || !isDetailOpen)}
          animationType="none"
          onRequestClose={() => { if (!adInFlight) closeNowPlayingFullscreen(); }}>
          <NowPlayingScreen
            onBack={closeNowPlayingFullscreen}
            onOpenSubscription={() => {
              closeNowPlayingFullscreen();
              setSettingsInitialSubMenu('subscription');
              setSettingsVisible(true);
            }}
          />
        </Modal>

        {/* Modal ensures OS-level focus trapping — Android creates a new Window,
            so D-pad key events never reach the MainLayout behind it. */}
        <Modal
          visible={isDetailOpen && (lastOpened === 'detail' || !nowPlayingFullscreen)}
          animationType="none"
          onRequestClose={() => { if (!adInFlight) popContent(); }}>
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
          onRequestClose={() => { settingsRef.current?.handleBack(); }}>
          {settingsVisible && (
            <SettingsScreen
              ref={settingsRef}
              initialSubMenu={settingsInitialSubMenu}
              onBack={() => { setSettingsVisible(false); setSettingsInitialSubMenu('none'); }}
              onSignOut={() => {
                setSettingsVisible(false);
                handleSignOut();
              }}
              updateInfo={updateInfo}
              announcements={announcements}
              readAnnouncementIds={readAnnouncementIds}
              onAnnouncementRead={markAnnouncementRead}
            />
          )}
        </Modal>

        <Modal
          visible={Boolean(quotaRecoveryRequest)}
          transparent
          animationType="fade"
          onRequestClose={dismissQuotaRecovery}>
          {quotaRecoveryRequest ? (
            <QuotaLimitScreen
              request={quotaRecoveryRequest}
              onWatchAd={async () => {
                await startQuotaRewardAd();
              }}
              onOpenSubscription={() => {
                dismissQuotaRecovery();
                setSettingsInitialSubMenu('subscription');
                setSettingsVisible(true);
              }}
              onCancel={dismissQuotaRecovery}
            />
          ) : null}
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

