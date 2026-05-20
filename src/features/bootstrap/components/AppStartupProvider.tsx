import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppStartupService } from '../appStartupService';
import { VersionCheckResult } from '../../../services/versionService';
import { Announcement, AnnouncementService } from '../../../services/announcementService';
import { initializeUnityAds } from '../../../services/unityAds';

interface AppStartupContextType {
  isInitialized: boolean;
  hasToken: boolean;
  isAppleMusicSubscriber: boolean;
  setHasToken: (value: boolean) => void;
  updateInfo: VersionCheckResult | null;
  announcements: Announcement[];
  readAnnouncementIds: string[];
  hasUnreadAnnouncements: boolean;
  markAnnouncementRead: (id: string) => void;
}

const AppStartupContext = createContext<AppStartupContextType | undefined>(undefined);

export function AppStartupProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isAppleMusicSubscriber, setIsAppleMusicSubscriber] = useState<boolean>(true);
  const [updateInfo, setUpdateInfo] = useState<VersionCheckResult | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;

    async function runStartup() {
      try {
        initializeUnityAds().catch(error => {
          console.error('[AppStartupProvider] Unity Ads init error:', error);
        });

        const data = await AppStartupService.init();
        if (mounted) {
          setHasToken(data.hasToken);
          setIsAppleMusicSubscriber(data.isAppleMusicSubscriber);
          setUpdateInfo(data.updateInfo);
          setAnnouncements(data.announcements);
          setReadAnnouncementIds(AnnouncementService.getReadIds());
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('[AppStartupProvider] Fatal startup error:', error);
        if (mounted) setIsInitialized(true);
      }
    }

    runStartup();

    return () => {
      mounted = false;
      AppStartupService.destroy();
    };
  }, []);

  const markAnnouncementRead = React.useCallback((id: string) => {
    AnnouncementService.markAsRead(id);
    setReadAnnouncementIds(prev => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  const hasUnreadAnnouncements = announcements.some(a => !readAnnouncementIds.includes(a.id));

  const value = React.useMemo(() => ({
    isInitialized,
    hasToken,
    isAppleMusicSubscriber,
    setHasToken,
    updateInfo,
    announcements,
    readAnnouncementIds,
    hasUnreadAnnouncements,
    markAnnouncementRead,
  }), [isInitialized, hasToken, isAppleMusicSubscriber, updateInfo, announcements, readAnnouncementIds, hasUnreadAnnouncements, markAnnouncementRead]);

  return (
    <AppStartupContext.Provider value={value}>
      {children}
    </AppStartupContext.Provider>
  );
}

export function useAppStartup() {
  const context = useContext(AppStartupContext);
  if (context === undefined) {
    throw new Error('useAppStartup must be used within an AppStartupProvider');
  }
  return context;
}
