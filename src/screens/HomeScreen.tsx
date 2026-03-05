/**
 * Home screen — MainLayout with TopBar + tab-based content.
 * TopBar and avatar stay visible; content switches by tab.
 */

import React, {useState} from 'react';
import {MainLayout} from '../components/MainLayout';
import type {NavTabId} from '../components/TopBar';

export type HomeScreenProps = {
  onSignOut?: () => void;
};

export function HomeScreen({
  onSignOut,
}: Readonly<HomeScreenProps>): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<NavTabId>('listen-now');

  return (
    <MainLayout
      activeTab={activeTab}
      onTabPress={setActiveTab}
      onAvatarPress={onSignOut}
      onSearchPress={() => {}}
    />
  );
}
