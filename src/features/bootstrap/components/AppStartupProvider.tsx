import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppStartupService } from '../appStartupService';
import { VersionCheckResult } from '../versionService';
import { Announcement, AnnouncementService } from '../announcementService';
import { initializeYandexAds } from '../yandexAds';
import { QuotaService } from '../../settings/quotaService';
import { IapService } from '../../settings/iapService';
import { ADS_TEMPORARILY_DISABLED } from '../../settings/adSettingsService';
import { RewardAdService } from '../../player/rewardAdService';
import * as Updates from 'expo-updates';

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
  needsCancelSubscription: boolean;
}

const AppStartupContext = createContext<AppStartupContextType | undefined>(undefined);

export function AppStartupProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isAppleMusicSubscriber, setIsAppleMusicSubscriber] = useState<boolean>(true);
  const [updateInfo, setUpdateInfo] = useState<VersionCheckResult | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [readAnnouncementIds, setReadAnnouncementIds] = useState<string[]>([]);
  const [needsCancelSubscription, setNeedsCancelSubscription] = useState(() => QuotaService.needsCancelSubscription());

  // Auto-reload app as soon as an OTA update finishes downloading
  const { isUpdatePending } = Updates.useUpdates();
  useEffect(() => {
    if (isUpdatePending) {
      console.log('[AppStartupProvider] OTA update downloaded and pending. Reloading app immediately...');
      Updates.reloadAsync().catch(err => {
        console.error('[AppStartupProvider] Auto reload error:', err);
      });
    }
  }, [isUpdatePending]);

  useEffect(() => {
    let mounted = true;

    async function runStartup() {
      try {
        const initAndPreloadAds = async () => {
          try {
            if (ADS_TEMPORARILY_DISABLED) {
              return;
            }
            await initializeYandexAds();
            if (!QuotaService.isProUser()) {
              try {
                await RewardAdService.preloadRewardedAd();
              } catch (err) {
                console.error('[AppStartupProvider] Ad preload error:', err);
              }
            }
          } catch (error) {
            console.error('[AppStartupProvider] Yandex Ads init error:', error);
          }
        };
        initAndPreloadAds();

        const data = await AppStartupService.init();
        if (mounted) {
          setHasToken(data.hasToken);
          setIsAppleMusicSubscriber(data.isAppleMusicSubscriber);
          setUpdateInfo(data.updateInfo);
          setAnnouncements(data.announcements);
          setReadAnnouncementIds(AnnouncementService.getReadIds());
          setNeedsCancelSubscription(QuotaService.needsCancelSubscription());
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

  useEffect(() => {
    const refresh = () => setNeedsCancelSubscription(QuotaService.needsCancelSubscription());
    const unsubPurchase = IapService.addPurchaseSuccessListener(refresh);
    const unsubStatus = IapService.addSubscriptionStatusListener(refresh);
    return () => { unsubPurchase(); unsubStatus(); };
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
    needsCancelSubscription,
  }), [isInitialized, hasToken, isAppleMusicSubscriber, updateInfo, announcements, readAnnouncementIds, hasUnreadAnnouncements, markAnnouncementRead, needsCancelSubscription]);

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
