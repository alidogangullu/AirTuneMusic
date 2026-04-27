/**
 * Main layout — TopBar + avatar always visible, content area switches by tab.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TopBar, type NavTabId } from './TopBar';
import { useTheme } from '../../theme';
import { BrowseScreen } from '../browse/BrowseScreen';
import { LibraryScreen } from '../library/LibraryScreen';
import { ListenNowScreen } from '../listen-now/ListenNowScreen';
import { NowPlayingScreen } from '../now-playing/NowPlayingScreen';
import { RadioScreen } from '../radio/RadioScreen';
import { SearchScreen } from '../search/SearchScreen';
import { VideosScreen } from '../videos/VideosScreen';

export type MainLayoutProps = {
  activeTab: NavTabId;
  onTabPress: (tab: NavTabId) => void;
  onAvatarPress?: () => void;
  onSearchPress?: () => void;
  onSettingsPress?: () => void;
  hasUpdate?: boolean;
};

const SCREENS: Record<NavTabId, React.ComponentType<{ isTabView?: boolean }>> = {
  'listen-now': ListenNowScreen,
  browse: BrowseScreen,
  videos: VideosScreen,
  radio: RadioScreen,
  library: LibraryScreen,
  'now-playing': NowPlayingScreen,
  search: SearchScreen,
};

export function MainLayout({
  activeTab,
  onTabPress,
  onAvatarPress,
  onSearchPress,
  onSettingsPress,
  hasUpdate = false,
}: Readonly<MainLayoutProps>): React.JSX.Element {
  const { themeMode } = useTheme();
  const Screen = SCREENS[activeTab];

  return (
    <View style={styles.root}>
      <View style={styles.contentFull}>
        <Screen isTabView={activeTab === 'now-playing'} />
      </View>
      <View style={styles.topBarOverlay}>
        <TopBar
          activeTab={activeTab}
          onTabPress={onTabPress}
          onAvatarPress={onAvatarPress}
          onSearchPress={onSearchPress}
          onSettingsPress={onSettingsPress}
          hasUpdate={hasUpdate}
          transparent
          dark={themeMode === 'dark' ? activeTab === 'now-playing' : activeTab !== 'now-playing'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  contentFull: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
