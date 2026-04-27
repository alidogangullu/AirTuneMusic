import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppStartupService } from '../appStartupService';
import { VersionCheckResult } from '../../../services/versionService';

interface AppStartupContextType {
  isInitialized: boolean;
  hasToken: boolean;
  isAppleMusicSubscriber: boolean;
  setHasToken: (value: boolean) => void;
  updateInfo: VersionCheckResult | null;
}

const AppStartupContext = createContext<AppStartupContextType | undefined>(undefined);

export function AppStartupProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isAppleMusicSubscriber, setIsAppleMusicSubscriber] = useState<boolean>(true);
  const [updateInfo, setUpdateInfo] = useState<VersionCheckResult | null>(null);

  useEffect(() => {
    let mounted = true;

    async function runStartup() {
      try {
        const data = await AppStartupService.init();
        if (mounted) {
          setHasToken(data.hasToken);
          setIsAppleMusicSubscriber(data.isAppleMusicSubscriber);
          setUpdateInfo(data.updateInfo);
          setIsInitialized(true);
        }
      } catch (error) {
        console.error('[AppStartupProvider] Fatal startup error:', error);
        // Even on error, we might want to set isInitialized to true 
        // to show some error UI instead of just loading forever
        if (mounted) setIsInitialized(true);
      }
    }

    runStartup();

    return () => {
      mounted = false;
      AppStartupService.destroy();
    };
  }, []);

  const value = React.useMemo(() => ({
    isInitialized,
    hasToken,
    isAppleMusicSubscriber,
    setHasToken,
    updateInfo,
  }), [isInitialized, hasToken, isAppleMusicSubscriber, updateInfo]);

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
