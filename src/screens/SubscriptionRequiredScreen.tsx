import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { radius, spacing } from '../theme/layout';
import type { AppColors } from '../theme/colors';

interface Props {
  onSignOut: () => void;
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
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
    logoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.xxl,
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
    warningIcon: {
      fontSize: 64,
      marginBottom: spacing.md,
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
      marginBottom: spacing.xl,
      paddingHorizontal: spacing.lg,
      lineHeight: 22,
    },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.glassButtonBg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.alertRed,
      gap: spacing.sm,
      minWidth: 200,
    },
    signOutBtnFocused: {
      backgroundColor: c.alertRed,
      borderColor: c.alertRed,
      transform: [{ scale: 1.05 }],
    },
    signOutBtnText: {
      fontSize: 16,
      fontWeight: '700',
      color: c.alertRed,
    },
    signOutBtnTextFocused: {
      color: c.onDarkTextPrimary,
    },
  });
}

export function SubscriptionRequiredScreen({ onSignOut }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.codeScreenRoot} focusable={false}>
      <View style={styles.codeScreenInner} focusable={false}>
        {/* Logo row — same as auth screen */}
        <View style={styles.logoRow} focusable={false}>
          <View style={styles.logoIcon} focusable={false}>
            <Image
              source={require('../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.logoTitle}>AirTune</Text>
        </View>

        {/* Glass card — same shape as auth screen */}
        <View style={styles.glassCard} focusable={false}>
          <Text style={styles.warningIcon}>🚫</Text>

          <Text style={styles.glassCardTitle}>
            {t('subscriptionRequired.title')}
          </Text>

          <Text style={styles.glassCardSubtitle}>
            {t('subscriptionRequired.message')}
          </Text>

          <Pressable
            onPress={onSignOut}
            hasTVPreferredFocus>
            {({ focused }) => (
              <>
                <View
                  style={[
                    styles.signOutBtn,
                    focused && styles.signOutBtnFocused,
                  ]}
                  pointerEvents="none">
                  <Text
                    style={[
                      styles.signOutBtnText,
                      focused && styles.signOutBtnTextFocused,
                    ]}>
                    {t('subscriptionRequired.signOut')}
                  </Text>
                </View>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
