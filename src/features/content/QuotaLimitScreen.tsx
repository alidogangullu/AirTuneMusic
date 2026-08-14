import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { radius, spacing } from '../../theme/layout';

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
  onOpenSubscription: () => void;
  onCancel: () => void;
}>;

function makeStyles() {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
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
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0,
    },
    subtitle: {
      fontSize: 15,
      color: 'rgba(255,255,255,0.75)',
      marginTop: 6,
      lineHeight: 22,
      maxWidth: 520,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: spacing.sm,
      justifyContent: 'flex-end',
    },
    actionButton: {
      minWidth: 130,
      minHeight: 44,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
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
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    actionLabelSecondary: {
      color: '#f0535b',
    },
    actionLabelFocused: {
      color: '#FFFFFF',
    },
    actionSpacer: {
      height: spacing.lg,
    },
  });
}

export function QuotaLimitScreen({ request, onOpenSubscription, onCancel }: Readonly<Props>): React.JSX.Element {
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(), []);

  return (
    <View style={styles.root}>
      <View style={styles.overlay}>
        <View style={styles.card}>
            <View style={styles.topRow}>
              <View>
                <Text style={styles.title}>{request.title}</Text>
                <Text style={styles.subtitle}>{request.message}</Text>
              </View>
            </View>

            <View style={styles.actionSpacer} />

          <View style={styles.actionRow}>
            <Pressable
              hasTVPreferredFocus={true}
              onPress={onOpenSubscription}
              style={({ focused }) => [
                styles.actionButton,
                styles.actionButtonSecondary,
                focused && styles.actionButtonFocused,
              ]}>
              {() => (
                <Text style={[styles.actionLabel, styles.actionLabelSecondary]}>
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