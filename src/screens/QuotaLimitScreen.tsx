import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, spacing } from '../theme/layout';

export type QuotaRecoveryRequest = {
  title: string;
  message: string;
  bonusPlays: number;
  autoWatchAfterMs: number;
  limit: number;
  used: number;
  total: number;
  remaining: string;
};

type Props = Readonly<{
  request: QuotaRecoveryRequest;
  onWatchAd: () => Promise<void>;
  onOpenSubscription: () => void;
  onCancel: () => void;
}>;

function makeStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: 'rgba(10, 10, 12, 0.62)',
    },
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    card: {
      width: '100%',
      maxWidth: 560,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      paddingBottom: spacing.lg,
      backgroundColor: '#1C1C1E',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    topRow: {
      marginBottom: spacing.xs,
    },
    titleWrap: {
      flex: 1,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.1,
    },
    subtitle: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.82)',
      marginTop: 2,
      lineHeight: 19,
      maxWidth: 520,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: spacing.xs,
      justifyContent: 'flex-end',
    },
    actionButton: {
      minWidth: 120,
      minHeight: 40,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderWidth: 1,
    },
    actionButtonPrimary: {
      backgroundColor: '#f0535b',
      borderColor: '#f0535b',
    },
    actionButtonSecondary: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderColor: 'rgba(255,255,255,0.10)',
    },
    actionButtonDanger: {
      backgroundColor: 'transparent',
      borderColor: 'rgba(255,255,255,0.14)',
    },
    actionButtonFocused: {
      transform: [{ scale: 1.02 }],
      borderColor: '#FFFFFF',
    },
    actionLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    actionLabelSecondary: {
      color: '#f0535b',
    },
    actionLabelFocused: {
      color: '#FFFFFF',
    },
    helperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      marginTop: 2,
      flexWrap: 'wrap',
    },
    actionSpacer: {
      height: spacing.lg,
    },
    countdown: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
      opacity: 0.9,
    },
    errorText: {
      color: '#ff8a8f',
      fontSize: 13,
      marginTop: 2,
      lineHeight: 15,
    },
    errorSlot: {
      minHeight: 17,
      marginTop: 2,
    },
    skipNote: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: 14,
      marginTop: 2,
      lineHeight: 17,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
      justifyContent: 'flex-end',
    },
    loadingText: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
  });
}

export function QuotaLimitScreen({ request, onWatchAd, onOpenSubscription, onCancel }: Readonly<Props>): React.JSX.Element {
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(), []);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(request.autoWatchAfterMs / 1000));
  const [isStartingAd, setIsStartingAd] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const autoTriggeredRef = useRef(false);
  const adStartInFlightRef = useRef(false);
  const onWatchAdRef = useRef(onWatchAd);

  useEffect(() => {
    onWatchAdRef.current = onWatchAd;
  }, [onWatchAd]);

  const handleWatchAd = useCallback(async () => {
    if (adStartInFlightRef.current) return;

    adStartInFlightRef.current = true;
    setIsStartingAd(true);
    setErrorMessage(null);

    try {
      await onWatchAdRef.current();
    } catch (error) {
      const errorCode =
        typeof error === 'object' && error !== null && 'code' in error && typeof (error as {code?: unknown}).code === 'string'
          ? (error as {code: string}).code
          : '';

      if (errorCode === 'AD_SKIPPED') {
        Alert.alert(t('quotaLimit.skipAlertTitle'), t('quotaLimit.skipNoReward'));
        setIsStartingAd(false);
        return;
      }

      const message = error instanceof Error ? error.message : t('quotaLimit.adErrorFallback');
      setErrorMessage(message);
      setIsStartingAd(false);
    } finally {
      adStartInFlightRef.current = false;
    }
  }, [t]);

  useEffect(() => {
    autoTriggeredRef.current = false;
    adStartInFlightRef.current = false;
    setSecondsLeft(Math.max(1, Math.ceil(request.autoWatchAfterMs / 1000)));
    setErrorMessage(null);
    setIsStartingAd(false);

    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, request.autoWatchAfterMs - elapsed);
      setSecondsLeft(Math.max(0, Math.ceil(remaining / 1000)));

      if (remaining <= 0 && !autoTriggeredRef.current) {
        autoTriggeredRef.current = true;
        clearInterval(interval);
        handleWatchAd();
      }
    }, 250);

    return () => clearInterval(interval);
  }, [handleWatchAd, request.autoWatchAfterMs]);

  return (
    <View style={styles.root}>
      <View style={styles.overlay}>
        <View style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{request.title}</Text>
                <Text style={styles.subtitle}>{request.message}</Text>
              </View>
            </View>

            <View style={styles.helperRow}>
              <Text style={styles.countdown}>{t('quotaLimit.autoStartCount', { count: secondsLeft })}</Text>
            </View>

            <Text style={styles.skipNote}>{t('quotaLimit.skipNoReward')}</Text>

            <View style={styles.errorSlot}>
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            </View>

            <View style={styles.actionSpacer} />

          <View style={styles.actionRow}>
            <Pressable
              hasTVPreferredFocus
              onPress={handleWatchAd}
              disabled={isStartingAd}
              style={({ focused }) => [
                styles.actionButton,
                styles.actionButtonSecondary,
                focused && { borderColor: '#f0535b' },
                isStartingAd && { opacity: 0.8 },
              ]}>
              {() => (
                <View style={styles.buttonContent}>
                  <Text style={[styles.actionLabel, styles.actionLabelSecondary]}>
                    {isStartingAd ? t('quotaLimit.preparingAd') : t('quotaLimit.watchAd')}
                  </Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={onOpenSubscription}
              style={({ focused }) => [
                styles.actionButton,
                styles.actionButtonPrimary,
                focused && styles.actionButtonFocused,
              ]}>
              {({ focused }) => (
                <Text style={[styles.actionLabel, focused && styles.actionLabelFocused]}>
                  {t('quotaLimit.subscription')}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={onCancel}
              style={({ focused }) => [
                styles.actionButton,
                styles.actionButtonDanger,
                focused && styles.actionButtonFocused,
              ]}>
              {({ focused }) => (
                <Text style={[styles.actionLabel, focused && styles.actionLabelFocused]}>
                  {t('common.cancel')}
                </Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}