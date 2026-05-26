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
  initialSubMenu?: 'none' | 'language' | 'announcements' | 'adSettings' | 'subscription';
};

export function SettingsScreen({
  onBack,
  onSignOut,
  updateInfo,
  announcements = [],
  readAnnouncementIds = [],
  onAnnouncementRead,
  initialSubMenu = 'none',
}: Readonly<SettingsScreenProps>): React.JSX.Element {
  const { colors, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors, themeMode), [colors, themeMode]);
  const { t, i18n } = useTranslation();
  const [currentSubMenu, setCurrentSubMenu] = React.useState<'none' | 'language' | 'announcements' | 'adSettings' | 'subscription'>(initialSubMenu);
  const [autoStartAd, setAutoStartAd] = React.useState(() => AdSettingsService.getAutoStartAd());
  const [proPrice, setProPrice] = React.useState<string | null>(null);
  const { enabled: airPlayEnabled, setEnabled: setAirPlayEnabled } = useAirPlay();

  React.useEffect(() => {
    if (currentSubMenu !== 'subscription' || QuotaService.isProUser()) return;
    IapService.getProducts().then(products => {
      if (!products) return;
      const product = products.find((p: any) => p.id === 'pro_monthly') as any;
      if (product?.displayPrice) setProPrice(product.displayPrice);
    });
  }, [currentSubMenu]);

  const hasOptionalUpdate = updateInfo?.status === 'optional_update';
  const hasUnreadAnnouncements = announcements.some(a => !readAnnouncementIds.includes(a.id));

  const MENU_ITEMS = [
    ...(hasOptionalUpdate ? [{ id: 'Update', label: t('settings.update') }] : []),
    { id: 'Subscription', label: t('settings.subscription') },
    { id: 'Language', label: t('settings.language.title') },
    { id: 'DarkMode', label: t('settings.theme') + ': ' + (themeMode === 'dark' ? t('settings.themeDark') : t('settings.themeLight')) },
    { id: 'AirPlay', label: 'AirPlay: ' + (airPlayEnabled ? t('common.on', 'On') : t('common.off', 'Off')) },
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
      setCurrentSubMenu('subscription');
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

    if (currentSubMenu === 'subscription') {
      const isPro = QuotaService.isProUser();
      const usage = QuotaService.getUsageInfo();
      const airPlayUsage = AirPlayQuotaService.getUsageInfo();
      const remaining = QuotaPeriodService.getRemainingFormatted() || t('common.availableNow');
      const musicPct = Math.min(usage.used / usage.total, 1);
      const airPlayUsedMin = Math.ceil(airPlayUsage.used / 60);
      const airPlayTotalMin = Math.round(airPlayUsage.total / 60);
      const airPlayPct = Math.min(airPlayUsage.used / airPlayUsage.total, 1);

      return (
        <>
          <SettingsMenuItem
            label={"← " + t('common.back')}
            onPress={() => setCurrentSubMenu('none')}
          />
          <View style={styles.divider} />

          {isPro ? (
            <View style={styles.proActiveCard}>
              <Text style={styles.proActiveBadge}>✦ PRO</Text>
              <Text style={styles.proActiveTitle}>{t('settings.pro.title')}</Text>
              <Text style={styles.proActiveSubtitle}>{t('settings.pro.activeMessage')}</Text>
            </View>
          ) : (
            <>
              <SettingsMenuItem
                label={t('settings.pro.getProMonthly')}
                sublabel={proPrice ? `${proPrice}${t('iap.perMonth')}` : undefined}
                hasTVPreferredFocus
                onPress={async () => {
                  try {
                    await IapService.subscribe('pro_monthly');
                  } catch (err: any) {
                    if (err.code !== 'E_USER_CANCELLED' && err.code !== 'user-cancelled') {
                      Alert.alert(t('common.error'), t('iap.errorMessage'));
                    }
                  }
                }}
              />

              <View style={[styles.adHintContainer, styles.adHintContainerFirst]}>
                <Text style={styles.adHintTitle}>{t('settings.pro.featuresTitle')}</Text>
                {([
                  t('settings.pro.featureMusic'),
                  t('settings.pro.featureAirPlay'),
                  t('settings.pro.featureAdFree'),
                ] as string[]).map((feat) => (
                  <Text key={feat} style={styles.adHintText}>{feat}</Text>
                ))}
              </View>

              <View style={[styles.adHintContainer, styles.adHintContainerNoTop]}>
                <Text style={styles.adHintTitle}>{t('settings.pro.usageTitle')}</Text>
                <View style={styles.usageRow}>
                  <Text style={styles.adHintText}>{t('settings.pro.usageMusic')}</Text>
                  <Text style={styles.adHintText}>{usage.used} / {usage.total}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${musicPct * 100}%` }]} />
                </View>
                <View style={[styles.usageRow, { marginTop: spacing.md }]}>
                  <Text style={styles.adHintText}>AirPlay</Text>
                  <Text style={styles.adHintText}>{airPlayUsedMin} / {airPlayTotalMin} min</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${airPlayPct * 100}%` }]} />
                </View>
                <Text style={[styles.adHintText, { marginTop: spacing.md }]}>{t('settings.pro.resetsIn', { remaining })}</Text>
              </View>

              <View style={styles.divider} />
              <SettingsMenuItem
                label={t('settings.pro.restorePurchases')}
                onPress={() => IapService.restorePurchases()}
              />
            </>
          )}
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
            label={t('settings.adSettings.autoStartAd') + ': ' + (autoStartAd ? t('common.on', 'On') : t('common.off', 'Off'))}
            onPress={() => {
              const next = !autoStartAd;
              AdSettingsService.setAutoStartAd(next);
              setAutoStartAd(next);
            }}
          />
          <View style={styles.adHintContainer}>
            <Text style={styles.adHintTitle}>{t('settings.adSettings.adHintTitle')}</Text>
            <Text style={styles.adHintText}>{t('settings.adSettings.adHint')}</Text>
          </View>
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
  subMenu: 'none' | 'language' | 'announcements' | 'adSettings' | 'subscription',
  t: (key: string) => string,
): string {
  if (subMenu === 'language') return t('settings.language.title');
  if (subMenu === 'announcements') return t('settings.announcements');
  if (subMenu === 'adSettings') return t('settings.adSettings.title');
  if (subMenu === 'subscription') return t('settings.subscription');
  return t('settings.title');
}

function makeStyles(c: AppColors, themeMode: 'light' | 'dark') {
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
    adHintContainer: {
      marginTop: spacing.sm,
      marginHorizontal: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
    },
    adHintContainerNoTop: {
      marginTop: 0,
    },
    adHintContainerFirst: {
      marginTop: -4,
    },
    adHintTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: c.settingsTextSubdued,
      marginBottom: spacing.sm,
    },
    adHintText: {
      fontSize: 14,
      lineHeight: 22,
      color: c.settingsTextSubdued,
    },
    // ── Subscription sub-menu ─────────────────────────────────────────────────
    proActiveCard: {
      marginHorizontal: spacing.md,
      marginBottom: spacing.md,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.sm,
    },
    proActiveBadge: {
      fontSize: 13,
      fontWeight: '800',
      letterSpacing: 2,
      color: c.alertRed,
      textTransform: 'uppercase',
    },
    proActiveTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: c.textOnDark,
      textAlign: 'center',
    },
    proActiveSubtitle: {
      fontSize: 14,
      color: c.settingsTextSubdued,
      textAlign: 'center',
      lineHeight: 20,
    },
    usageRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: themeMode === 'dark' ? c.buttonFocusedBg : c.overlayLight,
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.alertRed,
    },
  });
}
