/**
 * AirTune Music — Apple Music Android TV client
 * @format
 */

import React, {useEffect, useState} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  StyleSheet,
} from 'react-native';
import {clearMusicUserToken, loadMusicUserToken} from './src/api/apple-music';
import {GradientBackground} from './src/components/GradientBackground';
import {AppleMusicAuthTestScreen} from './src/screens/AppleMusicAuthTestScreen';
import {HomeScreen} from './src/screens/HomeScreen';
import {ThemeProvider, useTheme} from './src/theme';

function AppContent(): React.JSX.Element {
  const {colors} = useTheme();
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  useEffect(() => {
    loadMusicUserToken().then(token =>
      setHasToken(token !== null && token.length > 0),
    );
  }, []);

  if (hasToken === null) {
    return (
      <GradientBackground
        startColor={colors.appleMusicLowPink}
        endColor={colors.appleMusicWhite}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" />
        <SafeAreaView style={[styles.container, styles.centered]}>
          <ActivityIndicator size="large" color={colors.accent} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground
      startColor={colors.appleMusicLowPink}
      endColor={colors.appleMusicWhite}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" />
      <SafeAreaView style={styles.container}>
        {hasToken ? (
          <HomeScreen
            onSignOut={() => {
              clearMusicUserToken();
              setHasToken(false);
            }}
          />
        ) : (
          <AppleMusicAuthTestScreen
            onAuthSuccess={() => setHasToken(true)}
            onSignOut={() => {
              clearMusicUserToken();
              setHasToken(false);
            }}
          />
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const queryClient = new QueryClient();

function App(): React.JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  centered: {justifyContent: 'center', alignItems: 'center'},
});

export default App;
