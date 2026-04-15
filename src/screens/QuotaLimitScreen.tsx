import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { GradientBackground } from '../components/GradientBackground';
import { useTheme } from '../theme';
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
    },
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.xxl,
      paddingVertical: spacing.xxxl,
    },
    card: {
      width: '100%',
      maxWidth: 980,
      borderRadius: radius.xl,
      padding: spacing.xxl,
      backgroundColor: 'rgba(9, 12, 18, 0.82)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      marginBottom: spacing.lg,
    },
    iconWrap: {
      width: 74,
      height: 74,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    icon: {
      width: 54,
      height: 54,
      borderRadius: radius.md,
    },
    titleWrap: {
      flex: 1,
    },
    title: {
      fontSize: 34,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 16,
      color: 'rgba(255,255,255,0.82)',
      marginTop: spacing.xs,
      lineHeight: 24,
      maxWidth: 760,
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
      flexWrap: 'wrap',
    },
    statChip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: 9999,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    statText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 14,
    },
    divider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.12)',
      marginVertical: spacing.xl,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
      flexWrap: 'wrap',
    },
    actionButton: {
      minWidth: 220,
      minHeight: 66,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderWidth: 1,
    },
    actionButtonPrimary: {
      backgroundColor: '#f0535b',
      borderColor: '#f0535b',
    },
    actionButtonSecondary: {
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderColor: 'rgba(255,255,255,0.12)',
    },
    actionButtonDanger: {
      backgroundColor: 'transparent',
      borderColor: 'rgba(255,255,255,0.18)',
    },
    actionButtonFocused: {
      transform: [{ scale: 1.04 }],
      borderColor: '#FFFFFF',
    },
    actionLabel: {
      fontSize: 16,
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
      gap: spacing.lg,
      marginTop: spacing.lg,
      flexWrap: 'wrap',
    },
    countdown: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
      opacity: 0.9,
    },
    errorText: {
      color: '#ff8a8f',
      fontSize: 14,
      marginTop: spacing.md,
      lineHeight: 20,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    loadingText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '700',
    },
  });
}

export function QuotaLimitScreen({ request, onWatchAd, onOpenSubscription, onCancel }: Readonly<Props>): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
    <GradientBackground startColor={colors.gradientStart} endColor={colors.gradientEnd}>
      <View style={styles.root}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.iconWrap}>
                <Image source={require('../assets/images/logo.png')} style={styles.icon} resizeMode="cover" />
              </View>
              <View style={styles.titleWrap}>
                <Text style={styles.title}>{request.title}</Text>
                <Text style={styles.subtitle}>{request.message}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statText}>{t('quotaLimit.remainingLabel', { remaining: request.remaining })}</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statText}>{t('quotaLimit.limitLabel', { used: request.used, total: request.total })}</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statText}>{t('quotaLimit.rewardLabel', { bonus: request.bonusPlays })}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.actionRow}>
              <Pressable
                hasTVPreferredFocus
                onPress={handleWatchAd}
                disabled={isStartingAd}
                style={({ focused }) => [
                  styles.actionButton,
                  styles.actionButtonPrimary,
                  focused && styles.actionButtonFocused,
                  isStartingAd && { opacity: 0.8 },
                ]}>
                {({ focused }) => (
                  <Text style={[styles.actionLabel, focused && styles.actionLabelFocused]}>
                    {isStartingAd ? t('quotaLimit.preparingAd') : t('quotaLimit.watchAd')}
                  </Text>
                )}
              </Pressable>

              <Pressable
                onPress={onOpenSubscription}
                style={({ focused }) => [
                  styles.actionButton,
                  styles.actionButtonSecondary,
                  focused && styles.actionButtonFocused,
                ]}>
                {({ focused }) => (
                  <Text style={[styles.actionLabel, styles.actionLabelSecondary, focused && styles.actionLabelFocused]}>
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

            <View style={styles.helperRow}>
              <Text style={styles.countdown}>{t('quotaLimit.autoStartCount', { count: secondsLeft })}</Text>
              {isStartingAd ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text style={styles.loadingText}>{t('quotaLimit.adStarting')}</Text>
                </View>
              ) : null}
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          </View>
        </View>
      </View>
    </GradientBackground>
  );
}