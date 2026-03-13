/**
 * AirTune Music — Apple Music Android TV client
 * @format
 */

import React, {useEffect, useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {
  StatusBar,
  StyleSheet,
} from 'react-native';
import {clearMusicUserToken, loadMusicUserToken} from './src/api/apple-music';
import {GradientBackground} from './src/components/GradientBackground';
import {HomeScreen} from './src/screens/HomeScreen';
import {PlayerProvider} from './src/hooks/usePlayer';
import {ThemeProvider, useTheme} from './src/theme';
import { AppleMusicAuthScreen } from './src/screens/AppleMusicAuthScreen';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

function AppContent(): React.JSX.Element {
  const {colors} = useTheme();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    // Token kontrolü
    loadMusicUserToken().then(token =>
      setHasToken(token !== null && token.length > 0),
    );

    // MusicPlayer konfigürasyonunu başlat
    import('./src/services/musicPlayer').then(mp => {
      mp?.ensureConfigured?.().catch(e => {
        console.warn('[App] MusicPlayer konfigürasyon hatası:', e);
      });
    });
  }, []);

  if (hasToken === null) {
    const LoadingIndicator = require('./src/components/LoadingIndicator').LoadingIndicator;
    return <LoadingIndicator />;
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
              const {handleLogout} = await import('./src/services/musicPlayer');
              await handleLogout();
              queryClient.clear();
              setHasToken(false);
            }}
          />
        ) : (
          <AppleMusicAuthScreen
            onAuthSuccess={() => setHasToken(true)}
            onSignOut={async () => {
              const {handleLogout} = await import('./src/services/musicPlayer');
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
        <PlayerProvider>
          <AppContent />
        </PlayerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  centered: {justifyContent: 'center', alignItems: 'center'},
});

export default App;
