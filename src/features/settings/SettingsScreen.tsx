/**
 * SettingsScreen — Apple TV-style settings page.
 * Two-column layout: gray placeholder on the left, menu list on the right.
 * Opened as a Modal from HomeScreen.
 */

import React, { useMemo } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../i18n';
import { SettingsMenuItem } from './components/SettingsMenuItem';
import { GradientBackground } from '../../components/GradientBackground';
import { useTheme } from '../../theme';
import type { AppColors } from '../../theme/colors';
import { QuotaService } from '../../services/quotaService';
import { AdSettingsService } from '../../services/adSettingsService';
import { AirPlayQuotaService } from '../../services/airPlayQuotaService';
import { QuotaPeriodService } from '../../services/quotaPeriodService';
import { IapService } from './iapService';
import { spacing, radius } from '../../theme/layout';
import { VersionCheckResult } from '../../services/versionService';
import { Announcement } from '../../services/announcementService';
import { useAirPlay } from '../airplay/useAirPlay';

export type SettingsScreenProps = {
  onBack?: () => void;
  onSignOut?: () => void;
  updateInfo?: VersionCheckResult | null;
  announcements?: Announcement[];
  readAnnouncementIds?: string[];
  onAnnouncementRead?: (id: string) => void;
};

export function SettingsScreen({
  onBack,
  onSignOut,
  updateInfo,
  announcements = [],
  readAnnouncementIds = [],
  onAnnouncementRead,
}: Readonly<SettingsScreenProps>): React.JSX.Element {
  const { colors, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t, i18n } = useTranslation();
  const [currentSubMenu, setCurrentSubMenu] = React.useState<'none' | 'language' | 'announcements' | 'adSettings'>('none');
  const [autoStartAd, setAutoStartAd] = React.useState(() => AdSettingsService.getAutoStartAd());
  const { enabled: airPlayEnabled, setEnabled: setAirPlayEnabled } = useAirPlay();

  const hasOptionalUpdate = updateInfo?.status === 'optional_update';
  const hasUnreadAnnouncements = announcements.some(a => !readAnnouncementIds.includes(a.id));

  const MENU_ITEMS = [
    ...(hasOptionalUpdate ? [{ id: 'Update', label: t('settings.update') }] : []),
    { id: 'Subscription', label: t('settings.subscription') },
    { id: 'Language', label: t('settings.language.title') },
    { id: 'DarkMode', label: t('settings.theme') + ': ' + (themeMode === 'dark' ? t('settings.themeDark') : t('settings.themeLight')) },
    { id: 'AirPlay', label: 'AirPlay: ' + (airPlayEnabled ? t('common.on', 'Açık') : t('common.off', 'Kapalı')) },
    { id: 'AdSettings', label: t('settings.adSettings.title') },
    { id: 'Announcements', label: t('settings.announcements') },
    { id: 'Support', label: t('settings.support') },
    { id: 'About', label: t('settings.about') },
  ];

  const LANGUAGES = [
    { id: 'en', label: t('settings.language.english') },
    { id: 'tr', label: t('settings.language.turkish') },
    { id: 'de', label: t('settings.language.german') },
    { id: 'es', label: t('settings.language.spanish') },
    { id: 'fr', label: t('settings.language.french') },
  ];

  const handleSubscriptionPress = async () => {
    const isPro = QuotaService.isProUser();

    if (isPro) {
      Alert.alert(t('settings.pro.title'), t('settings.pro.activeMessage'));
      return;
    }

    const usage = QuotaService.getUsageInfo();
    const airPlayUsage = AirPlayQuotaService.getUsageInfo();
    const remaining = QuotaPeriodService.getRemainingFormatted() || t('common.availableNow');

    Alert.alert(
      t('settings.pro.title'),
      t('settings.pro.upgradeMessage', {
        used: usage.used,
        total: usage.total,
        airPlayUsed: Math.ceil(airPlayUsage.used / 60),
        airPlayTotal: Math.round(airPlayUsage.total / 60),
        remaining,
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
    if (item === 'Update') {
      if (updateInfo?.storeUrl) {
        Linking.openURL(updateInfo.storeUrl);
      }
    } else if (item === 'AdSettings') {
      setCurrentSubMenu('adSettings');
    } else if (item === 'Announcements') {
      setCurrentSubMenu('announcements');
    } else if (item === 'Sign Out') {
      onSignOut?.();
    } else if (item === 'Subscription') {
      handleSubscriptionPress();
    } else if (item === 'Language') {
      setCurrentSubMenu('language');
    } else if (item === 'AirPlay') {
      setAirPlayEnabled(!airPlayEnabled);
    } else if (item === 'Support') {
      Alert.alert(t('settings.support'), 'gullualidogan@gmail.com');
    } else if (item === 'DarkMode') {
      setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
    } else if (item === 'About') {
      Alert.alert(
        t('settings.aboutInfo.title'),
        t('settings.aboutInfo.message'),
      );
    }
  };

  const handleBack = () => {
    if (currentSubMenu === 'none') {
      onBack?.();
    } else {
      setCurrentSubMenu('none');
    }
  };

  const renderSubMenu = () => {
    if (currentSubMenu === 'none') {
      return (
        <>
          {MENU_ITEMS.map((item, index) => (
            <SettingsMenuItem
              key={item.id}
              label={item.label}
              hasTVPreferredFocus={index === 0}
              onPress={() => handleItemPress(item.id)}
              labelColor={
                item.id === 'Update' || (item.id === 'Announcements' && hasUnreadAnnouncements)
                  ? colors.alertRed
                  : undefined
              }
            />
          ))}
          <View style={styles.divider} />
          <SettingsMenuItem
            label={t('settings.signOut')}
            onPress={() => handleItemPress('Sign Out')}
          />
        </>
      );
    }

    if (currentSubMenu === 'language') {
      return (
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
      );
    }

    if (currentSubMenu === 'adSettings') {
      return (
        <>
          <SettingsMenuItem
            label={"← " + t('common.back')}
            hasTVPreferredFocus
            onPress={() => setCurrentSubMenu('none')}
          />
          <View style={styles.divider} />
          <SettingsMenuItem
            label={t('settings.adSettings.autoStartAd') + ': ' + (autoStartAd ? t('common.on', 'Açık') : t('common.off', 'Kapalı'))}
            onPress={() => {
              const next = !autoStartAd;
              AdSettingsService.setAutoStartAd(next);
              setAutoStartAd(next);
            }}
          />
        </>
      );
    }

    return (
      <>
        <SettingsMenuItem
          label={"← " + t('common.back')}
          hasTVPreferredFocus
          onPress={() => setCurrentSubMenu('none')}
        />
        <View style={styles.divider} />
        {announcements.length === 0 && (
          <Text style={styles.noAnnouncementsText}>{t('settings.noAnnouncements')}</Text>
        )}
        {announcements.map((ann) => {
          const isUnread = !readAnnouncementIds.includes(ann.id);
          return (
            <SettingsMenuItem
              key={ann.id}
              label={ann.title}
              labelColor={isUnread ? colors.alertRed : undefined}
              onPress={() => {
                onAnnouncementRead?.(ann.id);
                Alert.alert(ann.title, ann.body);
              }}
            />
          );
        })}
      </>
    );
  };

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
        <Text style={styles.title}>
          {getSubMenuTitle(currentSubMenu, t)}
        </Text>

        <View style={styles.columns}>
          <View style={styles.leftColumn}>
            <View style={styles.placeholder}>
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.placeholderImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.appNameText}>AirTune Music</Text>
          </View>

          <ScrollView
            style={styles.rightColumn}
            contentContainerStyle={styles.menuContent}
            showsVerticalScrollIndicator={false}>
            {renderSubMenu()}
          </ScrollView>
        </View>
      </View>
    </GradientBackground>
  );
}

function getSubMenuTitle(
  subMenu: 'none' | 'language' | 'announcements' | 'adSettings',
  t: (key: string) => string,
): string {
  if (subMenu === 'language') return t('settings.language.title');
  if (subMenu === 'announcements') return t('settings.announcements');
  if (subMenu === 'adSettings') return t('settings.adSettings.title');
  return t('settings.title');
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
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
      color: c.textOnDark,
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
      backgroundColor: c.subtleBg,
      borderRadius: radius.xl,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: c.glassBorderSubtle,
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
      color: c.alertRed,
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
      color: c.settingsTextHint,
      textTransform: 'uppercase',
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      marginLeft: 24,
    },
    noAnnouncementsText: {
      fontSize: 15,
      color: c.settingsTextHint,
      marginLeft: 24,
      marginTop: spacing.sm,
    },
  });
}
