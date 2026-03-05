/**
 * Test screen for Apple Music user sign-in (Music User Token).
 * Use this to verify startAppleMusicAuth() and /me/ API calls on Android TV.
 * On TV: use "Link with phone/computer" to see the code and open the link page on another device.
 */

import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  appleMusicApi,
  clearMusicUserToken,
  getMusicUserToken,
  loadMusicUserToken,
  setMusicUserToken,
} from '../api/apple-music';
import type {AppColors} from '../theme/colors';
import {useTheme} from '../theme';
import {radius, spacing, buttonMinHeight} from '../theme/layout';

const TV_LINK_SERVER = 'http://10.0.2.2:8080';
const TV_LINK_DISPLAY = 'airtune.music/tv';
const POLL_INTERVAL_MS = 2500;

function generateLinkCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function formatCodeForDisplay(code: string): string {
  if (code.length >= 6) {
    return `${code.slice(0, 3)}-${code.slice(3, 6)}`;
  }
  return code;
}

type Status =
  | 'idle'
  | 'success'
  | 'error'
  | 'library_loading'
  | 'library_ok'
  | 'library_error';

function startPolling(
  code: string,
  pollRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
  setTokenPreview: (s: string) => void,
  setPairingMode: (b: boolean) => void,
  setStatus: (s: Status) => void,
  setMessage: (s: string) => void,
  onAuthSuccess?: () => void,
): void {
  if (pollRef.current) {
    clearInterval(pollRef.current);
  }
  pollRef.current = setInterval(async () => {
    try {
      const res = await fetch(
        `${TV_LINK_SERVER}/api/tv-link?code=${encodeURIComponent(code)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as {musicUserToken?: string};
        if (data.musicUserToken) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setMusicUserToken(data.musicUserToken);
          // For development: log full Music User Token so it can be copied
          // to Postman or other tools. Remove before production if needed.
          console.log('Music User Token received:', data.musicUserToken);
          setTokenPreview(
            data.musicUserToken.length > 20
              ? `${data.musicUserToken.slice(0, 20)}...`
              : data.musicUserToken,
          );
          setPairingMode(false);
          setStatus('success');
          setMessage('Linked! Token received. You can test /me/ below.');
          onAuthSuccess?.();
        }
      }
    } catch {
      // keep polling
    }
  }, POLL_INTERVAL_MS);
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    scroll: {flex: 1, backgroundColor: c.screenBackground},
    container: {padding: spacing.xl, paddingTop: spacing.xxxl},
    codeScreenRoot: {
      flex: 1,
      backgroundColor: c.codeScreenBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    codeScreenInner: {
      width: '100%',
      maxWidth: 520,
      flexShrink: 1,
      alignItems: 'center',
      paddingHorizontal: spacing.xxl,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: c.textOnDark,
      marginBottom: spacing.sm,
    },
    subtitle: {
      fontSize: 14,
      color: c.textMuted,
      marginBottom: spacing.xxl,
    },
    button: {
      backgroundColor: c.buttonPrimary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: buttonMinHeight,
      marginBottom: spacing.lg,
    },
    buttonSecondary: {backgroundColor: c.buttonSecondaryBg},
    buttonOutline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: c.borderMuted,
    },
    buttonFocused: {opacity: 0.9, transform: [{scale: 1.02}]},
    buttonText: {color: c.textOnDark, fontSize: 18, fontWeight: '600'},
    buttonTextSecondary: {color: c.textOnDark, fontSize: 16},
    buttonTextOutline: {color: c.textMuted, fontSize: 16},
    label: {
      fontSize: 12,
      color: c.textSubtle,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    mono: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      color: c.textMono,
      marginBottom: spacing.lg,
    },
    messageBox: {
      marginTop: spacing.xl,
      padding: spacing.lg,
      borderRadius: radius.sm,
    },
    messageOk: {
      backgroundColor: c.messageSuccessBg,
      borderWidth: 1,
      borderColor: c.messageSuccessBorder,
    },
    messageError: {
      backgroundColor: c.messageErrorBg,
      borderWidth: 1,
      borderColor: c.messageErrorBorder,
    },
    messageText: {color: c.textOnDark, fontSize: 14},
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.xxl,
    },
    logoIcon: {
      width: 48,
      height: 48,
      borderRadius: radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoEmoji: {fontSize: 26, color: c.textOnDark},
    logoTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: c.cardTitleText,
      letterSpacing: -0.5,
    },
    glassCard: {
      width: '100%',
      backgroundColor: c.glassBg,
      borderRadius: radius.lg,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.xxl,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.glassBorder,
    },
    glassCardTitle: {
      fontSize: 24,
      fontWeight: '700',
      color: c.cardTitleText,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    glassCardSubtitle: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      lineHeight: 22,
    },
    glassCardHint: {
      fontSize: 14,
      color: c.textSecondary,
      marginTop: spacing.md,
    },
    codeDisplayBox: {
      backgroundColor: c.glassCodeBg,
      borderRadius: radius.md,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xxl,
      marginBottom: spacing.md,
      borderWidth: 1,
      borderColor: c.glassBorder,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    codeDisplayText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 42,
      fontWeight: '700',
      color: c.cardTitleText,
      letterSpacing: 10,
    },
    visitBlock: {marginBottom: spacing.md, alignItems: 'center'},
    visitLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textSecondary,
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    visitUrl: {
      fontSize: 20,
      fontWeight: '700',
      color: c.accent,
      letterSpacing: -0.5,
    },
    getNewCodeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.glassButtonBg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.glassButtonBorder,
      gap: spacing.sm,
      minWidth: 200,
    },
    getNewCodeBtnFocused: {
      backgroundColor: c.accent,
      borderColor: c.accent,
      transform: [{scale: 1.05}],
    },
    getNewCodeBtnIcon: {fontSize: 20, color: c.accent},
    getNewCodeBtnIconFocused: {color: c.textOnDark},
    getNewCodeBtnText: {fontSize: 16, fontWeight: '700', color: c.accent},
    getNewCodeBtnTextFocused: {color: c.textOnDark},
  });
}

export type AppleMusicAuthTestScreenProps = {
  onAuthSuccess?: () => void;
  onSignOut?: () => void;
};

export function AppleMusicAuthTestScreen({
  onAuthSuccess,
  onSignOut,
}: AppleMusicAuthTestScreenProps = {}): React.JSX.Element {
  const {colors} = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string>('');
  const [tokenPreview, setTokenPreview] = useState<string>('');
  const [pairingMode, setPairingMode] = useState(true);
  const [linkCode, setLinkCode] = useState<string>(() => generateLinkCode());
  const [restoring, setRestoring] = useState(true);
  const [newCodeBtnFocused, setNewCodeBtnFocused] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadMusicUserToken();
      if (cancelled) {
        return;
      }
      setRestoring(false);
      if (saved) {
        setPairingMode(false);
        setStatus('success');
        setTokenPreview(saved.length > 20 ? `${saved.slice(0, 20)}...` : saved);
        setMessage('');
        return;
      }
      startPolling(
        linkCode,
        pollRef,
        setTokenPreview,
        setPairingMode,
        setStatus,
        setMessage,
        onAuthSuccess,
      );
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
    // Only run once on mount: restore saved token or start code polling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startTvLink = () => {
    const code = generateLinkCode();
    setLinkCode(code);
    setPairingMode(true);
    setMessage('');
    startPolling(
      code,
      pollRef,
      setTokenPreview,
      setPairingMode,
      setStatus,
      setMessage,
      onAuthSuccess,
    );
  };

  const cancelTvLink = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    startTvLink();
  };

  const handleFetchLibrary = async () => {
    if (!getMusicUserToken()) {
      setStatus('error');
      setMessage('Sign in first.');
      return;
    }
    setStatus('library_loading');
    setMessage('');
    try {
      const {data} = await appleMusicApi.get<{data?: unknown[]}>(
        '/me/library/songs',
        {
          params: {limit: 5},
        },
      );
      const count = Array.isArray(data?.data) ? data.data.length : 0;
      setStatus('library_ok');
      setMessage(`Fetched ${count} song(s) from your library. Token works.`);
    } catch (e) {
      setStatus('library_error');
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };

  const handleSignOut = () => {
    clearMusicUserToken();
    onSignOut?.();
    setMessage('');
    setTokenPreview('');
    startTvLink();
  };

  const isCodeScreen = restoring || pairingMode;

  if (isCodeScreen) {
    return (
      <View style={styles.codeScreenRoot} focusable={false}>
        <View style={styles.codeScreenInner} focusable={false}>
          <View style={styles.logoRow} focusable={false}>
            <View style={styles.logoIcon} focusable={false}>
              <Text style={styles.logoEmoji}>♪</Text>
            </View>
            <Text style={styles.logoTitle}>AirTune</Text>
          </View>
          <View style={styles.glassCard} focusable={false}>
            {restoring ? (
              <>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.glassCardHint}>Loading…</Text>
              </>
            ) : (
              <>
                <Text style={styles.glassCardTitle}>
                  Connect to Apple Music
                </Text>
                <Text style={styles.glassCardSubtitle}>
                  Open the URL on your phone or computer and enter the code
                  below
                </Text>
                <View style={styles.codeDisplayBox} focusable={false}>
                  <Text
                    style={styles.codeDisplayText}
                    selectable={false}
                    numberOfLines={1}>
                    {formatCodeForDisplay(linkCode)}
                  </Text>
                </View>
                <View style={styles.visitBlock} focusable={false}>
                  <Text style={styles.visitLabel}>Visit</Text>
                  <Text style={styles.visitUrl} selectable={false}>
                    {TV_LINK_DISPLAY}
                  </Text>
                </View>
                <Pressable
                  style={({focused}) => [
                    styles.getNewCodeBtn,
                    focused && styles.getNewCodeBtnFocused,
                  ]}
                  onPress={cancelTvLink}
                  onFocus={() => setNewCodeBtnFocused(true)}
                  onBlur={() => setNewCodeBtnFocused(false)}
                  focusable={true}
                  hasTVPreferredFocus={true}>
                  <Text
                    style={[
                      styles.getNewCodeBtnIcon,
                      newCodeBtnFocused && styles.getNewCodeBtnIconFocused,
                    ]}>
                    ↻
                  </Text>
                  <Text
                    style={[
                      styles.getNewCodeBtnText,
                      newCodeBtnFocused && styles.getNewCodeBtnTextFocused,
                    ]}>
                    Get New Code
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={styles.scroll}
      contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.title}>Apple Music Auth Test</Text>
      <Text style={styles.subtitle}>
        Android TV – sign in and test /me/ API
      </Text>

      {(status === 'success' || tokenPreview.length > 0) && (
        <>
          <Text style={styles.label}>Token (preview):</Text>
          <Text style={styles.mono} numberOfLines={1}>
            {tokenPreview}
          </Text>
          <Pressable
            style={({focused}) => [
              styles.button,
              styles.buttonSecondary,
              focused && styles.buttonFocused,
            ]}
            onPress={handleFetchLibrary}
            disabled={status === 'library_loading'}
            focusable={true}>
            {status === 'library_loading' ? (
              <ActivityIndicator color={colors.buttonSecondaryBg} />
            ) : (
              <Text style={styles.buttonTextSecondary}>
                Fetch my library (first 5 songs)
              </Text>
            )}
          </Pressable>
          <Pressable
            style={({focused}) => [
              styles.button,
              styles.buttonOutline,
              focused && styles.buttonFocused,
            ]}
            onPress={handleSignOut}
            focusable={true}>
            <Text style={styles.buttonTextOutline}>Clear token (sign out)</Text>
          </Pressable>
        </>
      )}

      {message.length > 0 ? (
        <View
          style={[
            styles.messageBox,
            status === 'error' || status === 'library_error'
              ? styles.messageError
              : styles.messageOk,
          ]}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
