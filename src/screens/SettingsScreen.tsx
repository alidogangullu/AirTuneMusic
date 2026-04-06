/**
 * SettingsScreen — Apple TV-style settings page.
 * Two-column layout: gray placeholder on the left, menu list on the right.
 * Opened as a Modal from HomeScreen.
 */

import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import { SettingsMenuItem } from '../components/SettingsMenuItem';
import { GradientBackground } from '../components/GradientBackground';
import { useTheme } from '../theme';
import { QuotaService } from '../services/quotaService';
import { IapService } from '../services/iapService';
import { spacing, radius } from '../theme/layout';

export type SettingsScreenProps = {
  onBack?: () => void;
  onSignOut?: () => void;
};

export function SettingsScreen({
  onBack,
  onSignOut,
}: Readonly<SettingsScreenProps>): React.JSX.Element {
  const { colors } = useTheme();
  const { t, i18n } = useTranslation();
  const [currentSubMenu, setCurrentSubMenu] = React.useState<'none' | 'language'>('none');

  const MENU_ITEMS = [
    { id: 'Subscription', label: t('settings.subscription') },
    { id: 'Support', label: t('settings.support') },
    { id: 'About', label: t('settings.about') },
  ];

  const handleSubscriptionPress = async () => {
    const isPro = QuotaService.isProUser();

    if (isPro) {
      Alert.alert(t('settings.pro.title'), t('settings.pro.activeMessage'));
      return;
    }

    const usage = QuotaService.getUsageInfo();
    const remaining = QuotaService.getRemainingTimeFormatted();

    Alert.alert(
      t('settings.pro.title'),
      t('settings.pro.upgradeMessage', {
        limit: QuotaService.HOURLY_LIMIT,
        used: usage.used,
        total: usage.total,
        remaining: remaining,
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.pro.restorePurchases'),
          onPress: () => IapService.restorePurchases()
        },
        {
          text: t('settings.pro.getProMonthly'),
          onPress: async () => {
            try {
              await IapService.subscribe('pro_monthly');
              // The purchaseUpdatedListener in HomeScreen will catch the success and update the status
            } catch (err: any) {
              if (err.code !== 'E_USER_CANCELLED' && err.code !== 'user-cancelled') {
                Alert.alert(t('common.error'), t('iap.errorMessage'));
              }
            }
          }
        },
      ]
    );
  };

  const handleItemPress = (item: string) => {
    if (item === 'Sign Out') {
      onSignOut?.();
    } else if (item === 'Subscription') {
      handleSubscriptionPress();
    } else if (item === 'Language') {
      setCurrentSubMenu('language');
    } else if (item === 'Support') {
      Alert.alert(t('settings.support'), 'gullualidogan@gmail.com');
    } else if (item === 'About') {
      Alert.alert(
        t('settings.aboutInfo.title'),
        t('settings.aboutInfo.message'),
      );
    }
  };

  const handleBack = () => {
    if (currentSubMenu !== 'none') {
      setCurrentSubMenu('none');
    } else {
      onBack?.();
    }
  };

  const LANGUAGES = [
    { id: 'en', label: t('settings.language.english') },
    { id: 'tr', label: t('settings.language.turkish') },
    { id: 'de', label: t('settings.language.german') },
    { id: 'es', label: t('settings.language.spanish') },
    { id: 'fr', label: t('settings.language.french') },
  ];

  return (
    <GradientBackground
      startColor={colors.gradientStart}
      endColor={colors.gradientEnd}>
      <Pressable
        style={styles.backArea}
        onPress={handleBack}
        focusable={false}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      />
      <View style={styles.container}>
        {/* Header */}
        <Text style={styles.title}>
          {currentSubMenu === 'language' ? t('settings.language.title') : t('settings.title')}
        </Text>

        {/* Two-column layout */}
        <View style={styles.columns}>
          {/* Left — grey placeholder */}
          <View style={styles.leftColumn}>
            <View style={styles.placeholder}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.placeholderImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.appNameText}>AirTune Music</Text>
          </View>

          {/* Right — menu list */}
          <ScrollView
            style={styles.rightColumn}
            contentContainerStyle={styles.menuContent}
            showsVerticalScrollIndicator={false}>
            {currentSubMenu === 'none' ? (
              <>
                {MENU_ITEMS.map((item, index) => (
                  <SettingsMenuItem
                    key={item.id}
                    label={item.label}
                    hasTVPreferredFocus={index === 0}
                    onPress={() => handleItemPress(item.id)}
                  />
                ))}
                <SettingsMenuItem
                  label={t('settings.language.title')}
                  onPress={() => handleItemPress('Language')}
                />
                
                <View style={styles.divider} />
                <SettingsMenuItem
                  label={t('settings.signOut')}
                  onPress={() => handleItemPress('Sign Out')}
                />
              </>
            ) : (
              <>
                <SettingsMenuItem
                  label={"← " + t('common.cancel')}
                  hasTVPreferredFocus
                  onPress={() => setCurrentSubMenu('none')}
                />
                <View style={styles.divider} />
                {LANGUAGES.map((lang) => (
                  <SettingsMenuItem
                    key={lang.id}
                    label={lang.label + (i18n.language === lang.id ? ' ✓' : '')}
                    onPress={() => {
                      changeLanguage(lang.id as any);
                      setCurrentSubMenu('none');
                    }}
                  />
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  backArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    flex: 1,
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xxxl,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  columns: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xxxl,
  },
  leftColumn: {
    flex: 0.42,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  placeholder: {
    width: '90%',
    aspectRatio: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    borderRadius: radius.xl,
  },
  appNameText: {
    marginTop: spacing.md,
    fontSize: 24,
    fontWeight: '700',
    color: '#f0535b',
    textAlign: 'center',
  },
  rightColumn: {
    flex: 0.58,
  },
  menuContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.md,
    gap: 2,
    overflow: 'visible',
  },
  divider: {
    height: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.4)',
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    marginLeft: 24,
  },
});
