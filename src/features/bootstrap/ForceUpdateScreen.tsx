import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Linking,
  Pressable,
  Image,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { AppColors } from '../../theme/colors';
import { radius, spacing } from '../../theme/layout';

interface ForceUpdateScreenProps {
  storeUrl: string;
  latestVersion: string;
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.codeScreenBackground,
      justifyContent: 'center',
      alignItems: 'center',
    },
    inner: {
      width: '100%',
      maxWidth: 520,
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
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: c.cardTitleText,
      marginBottom: spacing.sm,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.md,
      paddingHorizontal: spacing.lg,
      lineHeight: 22,
    },
    versionBadge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: c.subtleBg,
      marginBottom: spacing.xl,
    },
    versionText: {
      fontSize: 13,
      fontWeight: '600',
      color: c.textSecondary,
    },
    button: {
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
    buttonFocused: {
      backgroundColor: c.alertRed,
      borderColor: c.alertRed,
      transform: [{ scale: 1.05 }],
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '700',
      color: c.alertRed,
    },
    buttonTextFocused: {
      color: c.onDarkTextPrimary,
    },
  });
}

export const ForceUpdateScreen: React.FC<ForceUpdateScreenProps> = ({
  storeUrl,
  latestVersion,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isFocused, setIsFocused] = useState(false);

  const handleUpdate = () => {
    if (storeUrl) {
      Linking.openURL(storeUrl).catch(err =>
        console.error('[ForceUpdate] URL error:', err)
      );
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.inner}>
        <View style={styles.logoRow}>
          <View style={styles.logoIcon}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="cover"
            />
          </View>
          <Text style={styles.logoTitle}>AirTune</Text>
        </View>

        <View style={styles.glassCard}>
          <Text style={styles.title}>{t('update.title')}</Text>
          <Text style={styles.subtitle}>
            {t('update.message')}
          </Text>

          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>
              {t('update.newVersion', { version: latestVersion })}
            </Text>
          </View>

          <Pressable
            onPress={handleUpdate}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={({ pressed }) => [
              styles.button,
              isFocused && styles.buttonFocused,
              { opacity: pressed ? 0.8 : 1 },
            ]}
            focusable={true}
            hasTVPreferredFocus={true}
          >
            <Text style={[styles.buttonText, isFocused && styles.buttonTextFocused]}>
              {t('update.button')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};
