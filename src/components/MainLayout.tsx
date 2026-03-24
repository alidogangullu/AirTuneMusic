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
import {SearchScreen} from '../screens/SearchScreen';
import {VideosScreen} from '../screens/VideosScreen';

export type MainLayoutProps = {
  activeTab: NavTabId;
  onTabPress: (tab: NavTabId) => void;
  onAvatarPress?: () => void;
  onSearchPress?: () => void;
  onSettingsPress?: () => void;
};

const SCREENS: Record<NavTabId, React.ComponentType> = {
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
}: Readonly<MainLayoutProps>): React.JSX.Element {
  return (
    <View style={styles.root}>
      <View style={styles.contentFull}>
        {(Object.keys(SCREENS) as NavTabId[]).map((tabId) => {
          const Screen = SCREENS[tabId];
          const isVisible = activeTab === tabId;
          
          return (
            <View
              key={tabId}
              style={[
                StyleSheet.absoluteFill,
                { zIndex: isVisible ? 1 : 0, opacity: isVisible ? 1 : 0 },
              ]}
              pointerEvents={isVisible ? 'auto' : 'none'}>
              <Screen />
            </View>
          );
        })}
      </View>
      <View style={styles.topBarOverlay}>
        <TopBar
          activeTab={activeTab}
          onTabPress={onTabPress}
          onAvatarPress={onAvatarPress}
          onSearchPress={onSearchPress}
          onSettingsPress={onSettingsPress}
          transparent
          dark={activeTab !== 'now-playing'}
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
