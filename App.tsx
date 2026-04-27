/**
 * AirTune Music — Apple Music Android TV client
 * @format
 */

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './src/api/queryClient';
import {
  StatusBar,
  StyleSheet,
  View,
  Image,
  Text,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { GradientBackground } from './src/components/GradientBackground';
import { HomeScreen } from './src/features/home/HomeScreen';
import { PlayerProvider } from './src/features/player/hooks/usePlayer';
import { ThemeProvider, useTheme } from './src/theme';
import { AppleMusicAuthScreen } from './src/features/auth/AppleMusicAuthScreen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ForceUpdateScreen } from './src/features/bootstrap/ForceUpdateScreen';
import { SubscriptionRequiredScreen } from './src/features/bootstrap/SubscriptionRequiredScreen';
import { AppStartupProvider, useAppStartup } from './src/features/bootstrap/components/AppStartupProvider';
import { handleLogout } from './src/services/musicPlayer';

function AppContent(): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isInitialized, hasToken, isAppleMusicSubscriber, setHasToken, updateInfo } = useAppStartup();

  if (!isInitialized || updateInfo === null) {
    return (
      <GradientBackground
        startColor={colors.gradientStart}
        endColor={colors.gradientEnd}>
        <View style={styles.centered}>
          <Image
            source={require('./src/assets/images/logo.png')}
            style={styles.splashLogo}
            resizeMode="contain"
          />
          <Text style={styles.splashText}>{t('common.appName')}</Text>
        </View>
      </GradientBackground>
    );
  }

  // Zorunlu güncelleme kontrolü
  if (updateInfo.status === 'force_update') {
    return (
      <ForceUpdateScreen
        storeUrl={updateInfo.storeUrl}
        latestVersion={updateInfo.latestVersion}
      />
    );
  }

  return (
    <GradientBackground
      startColor={colors.gradientStart}
      endColor={colors.gradientEnd}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" />
      <SafeAreaProvider>
        <SafeAreaView style={styles.container}>
          {hasToken ? (
            isAppleMusicSubscriber ? (
              <HomeScreen
                onSignOut={async () => {
                  await handleLogout();
                  queryClient.clear();
                  setHasToken(false);
                }}
              />
            ) : (
              <SubscriptionRequiredScreen
                onSignOut={async () => {
                  await handleLogout();
                  queryClient.clear();
                  setHasToken(false);
                }}
              />
            )
          ) : (
            <AppleMusicAuthScreen
              onAuthSuccess={() => setHasToken(true)}
              onSignOut={async () => {
                await handleLogout();
                queryClient.clear();
                setHasToken(false);
              }}
            />
          )}
        </SafeAreaView>
      </SafeAreaProvider>
    </GradientBackground>
  );
}



function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppStartupProvider>
          <PlayerProvider>
            <AppContent />
          </PlayerProvider>
        </AppStartupProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  splashLogo: {
    width: 180,
    height: 180,
    borderRadius: 36,
  },
  splashText: {
    marginTop: 24,
    fontSize: 28,
    fontWeight: '700',
    color: '#f0535b',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
});

export default App;
