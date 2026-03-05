/**
 * Main layout — TopBar + avatar always visible, content area switches by tab.
 */

import React from 'react';
import {StyleSheet, View} from 'react-native';
import {TopBar, type NavTabId} from './TopBar';
import {BrowseScreen} from '../screens/BrowseScreen';
import {LibraryScreen} from '../screens/LibraryScreen';
import {ListenNowScreen} from '../screens/ListenNowScreen';
import {NowPlayingScreen} from '../screens/NowPlayingScreen';
import {RadioScreen} from '../screens/RadioScreen';
import {VideosScreen} from '../screens/VideosScreen';

export type MainLayoutProps = {
  activeTab: NavTabId;
  onTabPress: (tab: NavTabId) => void;
  onAvatarPress?: () => void;
  onSearchPress?: () => void;
};

const SCREENS: Record<NavTabId, React.ComponentType> = {
  'listen-now': ListenNowScreen,
  browse: BrowseScreen,
  videos: VideosScreen,
  radio: RadioScreen,
  library: LibraryScreen,
  'now-playing': NowPlayingScreen,
};

export function MainLayout({
  activeTab,
  onTabPress,
  onAvatarPress,
  onSearchPress,
}: Readonly<MainLayoutProps>): React.JSX.Element {
  const Screen = SCREENS[activeTab];

  return (
    <View style={styles.root}>
      <TopBar
        activeTab={activeTab}
        onTabPress={onTabPress}
        onAvatarPress={onAvatarPress}
        onSearchPress={onSearchPress}
      />
      <View style={styles.content}>
        <Screen />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
