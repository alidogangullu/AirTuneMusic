import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import {
  loadMusicUserToken,
  setMusicUserToken,
  getDeveloperToken,
} from '../api/apple-music';
import * as TVLinkServer from '../services/tvLinkServer';
import type { AppColors } from '../theme/colors';
import { useTheme } from '../theme';
import { radius, spacing, buttonMinHeight } from '../theme/layout';
import * as musicPlayer from '../services/musicPlayer';


import { DEV_SERVER } from '../config/devServer';
const TV_LINK_SERVER = DEV_SERVER;
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

type Status = 'idle' | 'success' | 'error';

const LOCAL_SERVER_PORT = 8080;

function startPolling(
  code: string,
  pollRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>,
  setTokenPreview: (s: string) => void,
  setPairingMode: (b: boolean) => void,
  setStatus: (s: Status) => void,
  setMessage: (s: string) => void,
  t: any,
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
        const data = (await res.json()) as { musicUserToken?: string };
        if (data.musicUserToken) {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setMusicUserToken(data.musicUserToken);
          // Sync new token to native player immediately
          musicPlayer.syncTokens();

          setTokenPreview(
            data.musicUserToken.length > 20
              ? `${data.musicUserToken.slice(0, 20)}...`
              : data.musicUserToken,
          );
          setPairingMode(false);
          setStatus('success');
          setMessage(t('auth.linkedMessage'));
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
    scroll: { flex: 1, backgroundColor: c.screenBackground },
    container: { padding: spacing.xl, paddingTop: spacing.xxxl },
    codeScreenRoot: {
      flex: 1,
      backgroundColor: c.codeScreenBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    codeScreenInner: {
      width: '100%',
      maxWidth: 700,
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
    buttonSecondary: { backgroundColor: c.buttonSecondaryBg },
    buttonOutline: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: c.borderMuted,
    },
    buttonFocused: { opacity: 0.9, transform: [{ scale: 1.02 }] },
    buttonText: { color: c.textOnDark, fontSize: 18, fontWeight: '600' },
    buttonTextSecondary: { color: c.textOnDark, fontSize: 16 },
    buttonTextOutline: { color: c.textMuted, fontSize: 16 },
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
    messageText: { color: c.textOnDark, fontSize: 14 },
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    logoIcon: {
      width: 65,
      height: 65,
      borderRadius: radius.lg,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoImage: {
      width: 65,
      height: 65,
      borderRadius: radius.lg,
    },
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
    visitBlock: { marginBottom: spacing.md, alignItems: 'center' },
    visitLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: c.textSecondary,
      letterSpacing: 1,
      marginBottom: spacing.xs,
    },
    visitUrl: {
      fontSize: 14,
      fontWeight: '500',
      color: c.textSecondary,
      letterSpacing: -0.2,
      opacity: 0.8,
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
      backgroundColor: '#f0535b',
      borderColor: '#f0535b',
      transform: [{ scale: 1.05 }],
    },

    getNewCodeBtnText: { fontSize: 16, fontWeight: '700', color: '#f0535b' },
    getNewCodeBtnTextFocused: { color: '#FFFFFF' },
    qrContainer: {
      backgroundColor: '#FFFFFF',
      padding: spacing.sm, // Reduced from md
      borderRadius: radius.md,
      marginBottom: spacing.lg, // Reduced from xl
    },
    authContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg, // Reduced from xl
      marginTop: spacing.md,
    },
    textColumns: {
      flex: 1,
      alignItems: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.9)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      width: '80%',
      backgroundColor: '#2a2a2a',
      borderRadius: radius.lg,
      padding: spacing.xl,
      borderWidth: 1,
      borderColor: '#444',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: '#fff',
      marginBottom: spacing.lg,
    },
    textInput: {
      backgroundColor: '#1a1a1a',
      color: '#fff',
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: 14,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: spacing.xl,
      borderWidth: 1,
      borderColor: '#444',
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: spacing.md,
    },
    modalButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      minWidth: 100,
      alignItems: 'center',
    },
    subscriptionNote: {
      fontSize: 12,
      color: '#f0535b',
      fontWeight: '600',
      marginBottom: spacing.md,
      opacity: 0.9,
    },
  });
}

export type AppleMusicAuthScreenProps = {
  onAuthSuccess?: () => void;
  onSignOut?: () => void;
};

export function AppleMusicAuthScreen({
  onAuthSuccess,
  onSignOut,
}: AppleMusicAuthScreenProps = {}): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [status, setStatus] = useState<Status>('idle');

  const [message, setMessage] = useState<string>('');
  const [tokenPreview, setTokenPreview] = useState<string>('');
  const [pairingMode, setPairingMode] = useState(true);
  const [linkCode, setLinkCode] = useState<string>(() => generateLinkCode());
  const [restoring, setRestoring] = useState(true);
  const [newCodeBtnFocused, setNewCodeBtnFocused] = useState(false);
  const [localServerIp, setLocalServerIp] = useState<string>('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualToken, setManualToken] = useState('');

  useEffect(() => {
    let cancelled = false;

    const initServer = async () => {
      try {
        const devToken = await getDeveloperToken();
        const ip = await TVLinkServer.startLocalServer(devToken, LOCAL_SERVER_PORT);
        if (!cancelled) setLocalServerIp(ip);
      } catch (err) {
        console.error('Failed to start local server:', err);
      }
    };

    const unsubscribe = TVLinkServer.onTokenReceived((event) => {
      if (event.code === linkCode) {
        setMusicUserToken(event.musicUserToken);
        musicPlayer.release(); // Force recreation of player with new token
        musicPlayer.syncTokens();
        setTokenPreview(
          event.musicUserToken.length > 20
            ? `${event.musicUserToken.slice(0, 20)}...`
            : event.musicUserToken,
        );
        setPairingMode(false);
        setStatus('success');
        setMessage(t('auth.linkedMessage'));
        onAuthSuccess?.();
      }
    });

    (async () => {
      await initServer();
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
      // Start polling as fallback
      startPolling(
        linkCode,
        pollRef,
        setTokenPreview,
        setPairingMode,
        setStatus,
        setMessage,
        t,
        onAuthSuccess,
      );
    })();
    return () => {
      cancelled = true;
      unsubscribe();
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      // We don't stop the server here to allow re-entry, 
      // but we could stop it in componentWillUnmount if desired.
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
      t,
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

  const handleSignOut = () => {
    setRestoring(true);
    setTimeout(async () => {
      await musicPlayer.handleLogout();
      onSignOut?.();
      setMessage('');
      setTokenPreview('');
      startTvLink();
      // startTvLink will set pairingMode(true), which keeps the loading screen visible 
      // until startPolling/initServer settle.
      // But we need to ensure restoring is false at the end if we want to see the QR.
      // startPolling usually doesn't set restoring(false), initServer does on mount.
      // Let's manually set restoring(false) after a short delay for the visual.
      setRestoring(false);
    }, 800);
  };

  const isCodeScreen = restoring || pairingMode;

  if (isCodeScreen) {
    return (
      <View style={styles.codeScreenRoot} focusable={false}>
        <View style={styles.codeScreenInner} focusable={false}>
          <Pressable
            onPress={() => setShowManualInput(true)}
            focusable={false}
            style={styles.logoRow}>
            <View style={styles.logoIcon} focusable={false}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.logoTitle}>AirTune</Text>
          </Pressable>
          <View style={styles.glassCard} focusable={false}>
            {restoring ? (
              <>
                <ActivityIndicator size="large" color={colors.accent} />
                <Text style={styles.glassCardHint}>{t('common.loading')}</Text>
              </>
            ) : (
              <>
                <Text style={styles.glassCardTitle}>
                  {t('auth.connectTitle')}
                </Text>
                <Text style={styles.glassCardSubtitle}>
                  <Text style={{ color: '#f0535b', fontWeight: 'bold' }}>{t('auth.scanQR')}</Text> {t('auth.orVisitURL')}
                </Text>
                <Text style={styles.subscriptionNote}>{t('auth.paidSubscriptionRequired')}</Text>
                <View style={styles.authContainer} focusable={false}>
                  <View style={styles.qrContainer} focusable={false}>
                    <QRCode
                      value={`http://${localServerIp || '127.0.0.1'}:${LOCAL_SERVER_PORT}/tv?code=${linkCode}`}
                      size={160}
                      backgroundColor="white"
                      color="black"
                    />
                  </View>

                  <View style={styles.textColumns} focusable={false}>
                    <View style={styles.codeDisplayBox} focusable={false}>
                      <Text
                        style={styles.codeDisplayText}
                        selectable={false}
                        numberOfLines={1}>
                        {formatCodeForDisplay(linkCode)}
                      </Text>
                    </View>
                    <View style={styles.visitBlock} focusable={false}>
                      <Text style={styles.visitLabel}>{t('auth.visitURL')}</Text>
                      <Text style={styles.visitUrl} selectable={false}>
                        {localServerIp ? `http://${localServerIp}:${LOCAL_SERVER_PORT}/tv` : TV_LINK_DISPLAY}
                      </Text>
                    </View>
                  </View>
                </View>
                <Pressable
                  style={({ focused }) => [
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
                      styles.getNewCodeBtnText,
                      newCodeBtnFocused && styles.getNewCodeBtnTextFocused,
                    ]}>
                    {t('auth.getNewCode')}
                  </Text>
                </Pressable>


              </>
            )}
          </View>
        </View>
        <Modal
          visible={showManualInput}
          transparent
          animationType="fade"
          onRequestClose={() => setShowManualInput(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {t('auth.manualEntryTitle')}
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder={t('auth.manualEntryPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={manualToken}
                onChangeText={setManualToken}
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: '#444' }]}
                  onPress={() => setShowManualInput(false)}>
                  <Text style={{ color: '#fff' }}>{t('common.cancel')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalButton, { backgroundColor: '#f0535b' }]}
                  onPress={() => {
                    if (manualToken.trim()) {
                      setMusicUserToken(manualToken.trim());
                      musicPlayer.syncTokens();
                      onAuthSuccess?.();
                    }
                  }}>
                  <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('auth.connect')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      style={styles.scroll}
      contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.title}>{t('auth.appleMusicAuth')}</Text>
      <Text style={styles.subtitle}>
        {t('auth.androidTvSignIn')}
      </Text>

      {(status === 'success' || tokenPreview.length > 0) && (
        <>
          <Text style={styles.mono} numberOfLines={1}>
            {tokenPreview}
          </Text>

          <Pressable
            style={({ focused }) => [
              styles.button,
              styles.buttonOutline,
              focused && styles.buttonFocused,
            ]}
            onPress={handleSignOut}
            focusable={true}>
            <Text style={styles.buttonTextOutline}>{t('auth.signOut')}</Text>
          </Pressable>
        </>
      )}

      {message.length > 0 ? (
        <View
          style={[
            styles.messageBox,
            status === 'error' ? styles.messageError : styles.messageOk,
          ]}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      <Modal
        visible={showManualInput}
        transparent
        animationType="fade"
        onRequestClose={() => setShowManualInput(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {t('auth.manualEntryTitle')}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={t('auth.manualEntryPlaceholder')}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={manualToken}
              onChangeText={setManualToken}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, { backgroundColor: '#444' }]}
                onPress={() => setShowManualInput(false)}>
                <Text style={{ color: '#fff' }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, { backgroundColor: '#f0535b' }]}
                onPress={() => {
                  if (manualToken.trim()) {
                    setMusicUserToken(manualToken.trim());
                    musicPlayer.syncTokens();
                    onAuthSuccess?.();
                  }
                }}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{t('auth.connect')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
