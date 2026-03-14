/**
 * AirTune Music — Apple Music Android TV client
 * @format
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  StatusBar,
  StyleSheet,
  View,
  Image,
  Text,
} from 'react-native';
import { GradientBackground } from './src/components/GradientBackground';
import { HomeScreen } from './src/screens/HomeScreen';
import { PlayerProvider } from './src/hooks/usePlayer';
import { ThemeProvider, useTheme } from './src/theme';
import { AppleMusicAuthScreen } from './src/screens/AppleMusicAuthScreen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { ForceUpdateScreen } from './src/screens/ForceUpdateScreen';
import { AppStartupProvider, useAppStartup } from './src/components/AppStartupProvider';

function AppContent(): React.JSX.Element {
  const { colors } = useTheme();
  const { isInitialized, hasToken, setHasToken, updateInfo } = useAppStartup();

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
          <Text style={styles.splashText}>AirTune Music</Text>
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
            <HomeScreen
              onSignOut={async () => {
                const { handleLogout } = await import('./src/services/musicPlayer');
                await handleLogout();
                queryClient.clear();
                setHasToken(false);
              }}
            />
          ) : (
            <AppleMusicAuthScreen
              onAuthSuccess={() => setHasToken(true)}
              onSignOut={async () => {
                const { handleLogout } = await import('./src/services/musicPlayer');
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

const queryClient = new QueryClient();

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
