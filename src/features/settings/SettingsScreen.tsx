/**
 * SettingsScreen — Apple TV-style settings page.
 * Two-column layout: gray placeholder on the left, menu list on the right.
 * Opened as a Modal from HomeScreen.
 */

import React, { useMemo, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Alert, Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { LOGO_BASE64 } from '../../assets/images/logoBase64';

export type SettingsScreenHandle = { handleBack: () => boolean };

function buildPriceMap(products: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of products) {
    if (p.id && p.displayPrice) map[p.id] = p.displayPrice;
  }
  return map;
}
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../../locales';
import { SettingsMenuItem } from './components/SettingsMenuItem';
import { GradientBackground } from '../../components/GradientBackground';
import { useTheme } from '../../theme';
import type { AppColors } from '../../theme/colors';
import { QuotaService } from './quotaService';
import { MotionArtworkService } from './motionArtworkService';
import { AirPlayQuotaService } from '../airplay/airPlayQuotaService';
import { QuotaPeriodService } from './quotaPeriodService';
import { IapService, SKUS } from './iapService';
import { spacing, radius } from '../../theme/layout';
import { VersionCheckResult } from '../bootstrap/versionService';
import { Announcement } from '../bootstrap/announcementService';
import { useAirPlay } from '../airplay/useAirPlay';
import { CURRENT_VERSION } from '../../constants/versionInfo';
import { useMusicUserToken } from '../../api/apple-music/musicUserToken';

export type SettingsScreenProps = {
  onBack?: () => void;
  onSignOut?: () => void;
  updateInfo?: VersionCheckResult | null;
  announcements?: Announcement[];
  readAnnouncementIds?: string[];
  onAnnouncementRead?: (id: string) => void;
  initialSubMenu?: 'none' | 'language' | 'announcements' | 'subscription' | 'appPreferences' | 'about' | 'support';
};

export const SettingsScreen = forwardRef<SettingsScreenHandle, SettingsScreenProps>(function SettingsScreen({
  onBack,
  onSignOut,
  updateInfo,
  announcements = [],
  readAnnouncementIds = [],
  onAnnouncementRead,
  initialSubMenu = 'none',
}, ref) {
  const { colors, themeMode, setThemeMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors, themeMode), [colors, themeMode]);
  const { t, i18n } = useTranslation();
  const [currentSubMenu, setCurrentSubMenu] = React.useState<'none' | 'language' | 'announcements' | 'subscription' | 'appPreferences' | 'about' | 'support'>(initialSubMenu);
  const [prices, setPrices] = React.useState<Record<string, string>>({});
  const [quotaIndicatorHidden, setQuotaIndicatorHidden] = React.useState(() => QuotaService.isQuotaIndicatorHidden());
  const [motionArtworkEnabled, setMotionArtworkEnabled] = React.useState(() => MotionArtworkService.getEnabled());
  const [activeSubSku, setActiveSubSku] = React.useState(() => QuotaService.getActiveSubSku());
  const [isPro, setIsPro] = React.useState(() => QuotaService.isProUser());
  const [needsCancel, setNeedsCancel] = React.useState(() => QuotaService.needsCancelSubscription());
  const [showCancelHint, setShowCancelHint] = React.useState(false);
  const [hasLifetime, setHasLifetime] = React.useState(() => QuotaService.hasLifetimePurchase());
  const { enabled: airPlayEnabled, setEnabled: setAirPlayEnabled } = useAirPlay();
  const userToken = useMusicUserToken();

  const refreshSubscriptionState = React.useCallback(() => {
    setActiveSubSku(QuotaService.getActiveSubSku());
    setIsPro(QuotaService.isProUser());
    setNeedsCancel(QuotaService.needsCancelSubscription());
    setHasLifetime(QuotaService.hasLifetimePurchase());
  }, []);

  React.useEffect(() => {
    return IapService.addPurchaseSuccessListener(refreshSubscriptionState);
  }, [refreshSubscriptionState]);

  React.useEffect(() => {
    if (currentSubMenu !== 'subscription') return;
    setShowCancelHint(false);
    IapService.checkSubscriptionStatus().then(refreshSubscriptionState);
    IapService.getProducts().then(products => {
      setPrices(buildPriceMap(products));
    });
  }, [currentSubMenu, refreshSubscriptionState]);

  const hasOptionalUpdate = updateInfo?.status === 'optional_update';
  const hasUnreadAnnouncements = announcements.some(a => !readAnnouncementIds.includes(a.id));

  const MENU_ITEMS = [
    ...(hasOptionalUpdate ? [{ id: 'Update', label: t('settings.update') }] : []),
    { id: 'Subscription', label: t('settings.subscription') },
    { id: 'AirPlay', label: 'AirPlay: ' + (airPlayEnabled ? t('common.on', 'On') : t('common.off', 'Off')) },
    { id: 'AppPreferences', label: t('settings.appPreferences') },
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
      setCurrentSubMenu('support');
    } else if (item === 'DarkMode') {
      setThemeMode(themeMode === 'dark' ? 'light' : 'dark');
    } else if (item === 'About') {
      setCurrentSubMenu('about');
    } else if (item === 'AppPreferences') {
      setCurrentSubMenu('appPreferences');
    }
  };

  const handlePlanPress = useCallback((sku: string) => {
    (async () => {
      try {
        // Ensure we have the latest subscription state before attempting purchase
        await IapService.checkSubscriptionStatus();
        refreshSubscriptionState();

        const result = await IapService.subscribe(sku);
        if (result === 'cancel_required') {
          setShowCancelHint(true);
        }
      } catch (err: any) {
        if (err.code !== 'E_USER_CANCELLED' && err.code !== 'user-cancelled') {
          Alert.alert(t('common.error'), t('iap.errorMessage'));
        }
      }
    })();
  }, [t, refreshSubscriptionState]);

  const handleBack = useCallback(() => {
    if (currentSubMenu === 'none') {
      onBack?.();
      return false;
    } else {
      setCurrentSubMenu('none');
      return true;
    }
  }, [currentSubMenu, onBack]);

  useImperativeHandle(ref, () => ({ handleBack }), [handleBack]);

  const renderMainMenu = () => (
    <>
      {MENU_ITEMS.map((item, index) => (
        <SettingsMenuItem
          key={item.id}
          label={item.label}
          hasTVPreferredFocus={index === 0}
          onPress={() => handleItemPress(item.id)}
          labelColor={
            item.id === 'Update' ||
              (item.id === 'Announcements' && hasUnreadAnnouncements) ||
              (item.id === 'Subscription' && needsCancel)
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

  const renderLanguageMenu = () => (
    <>
      <SettingsMenuItem
        prefix="‹"
        label={t('common.cancel')}
        hasTVPreferredFocus
        onPress={() => setCurrentSubMenu('appPreferences')}
      />
      <View style={styles.divider} />
      {LANGUAGES.map((lang) => (
        <SettingsMenuItem
          key={lang.id}
          label={lang.label + (i18n.language === lang.id ? ' ✓' : '')}
          onPress={() => {
            changeLanguage(lang.id as any);
            setCurrentSubMenu('appPreferences');
          }}
        />
      ))}
    </>
  );

  const renderSubscriptionMenu = () => {
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
          prefix="‹"
          label={t('common.back')}
          hasTVPreferredFocus={activeSubSku === SKUS.LIFETIME || (!activeSubSku && isPro)}
          onPress={() => setCurrentSubMenu('none')}
        />
        <View style={styles.divider} />

        <>
          {isPro && (() => {
            const isLifetimeOnly = hasLifetime && !needsCancel;
            const planKey = activeSubSku === SKUS.MONTHLY ? 'settings.pro.planMonthly' : 'settings.pro.planYearly';
            const subtitle = isLifetimeOnly
              ? t('settings.pro.lifetimeMessage')
              : t('settings.pro.activeMessage', { plan: t(planKey).toLowerCase() });
            return (
              <View style={styles.proActiveCard}>
                <Text style={styles.proActiveBadge}>✦ PRO</Text>
                <Text style={styles.proActiveTitle}>{t('settings.pro.title')}</Text>
                <Text style={styles.proActiveSubtitle}>{subtitle}</Text>
              </View>
            );
          })()}

          {!isPro && (
            <View style={[styles.adHintContainer, styles.adHintContainerFirst, { flexDirection: 'row', alignItems: 'center', gap: spacing.lg }]}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={[styles.adHintTitle, styles.featuresTitleAccent, styles.textCenter]}>{t('settings.pro.featuresTitle')}</Text>
                {([
                  t('settings.pro.featureMusic'),
                  t('settings.pro.featureAirPlay'),
                  t('settings.pro.featureSupport'),
                ] as string[]).map((feat) => (
                  <Text key={feat} style={[styles.adHintText, styles.textCenter]}>{feat}</Text>
                ))}
              </View>
              <View style={{ flex: 1, paddingLeft: spacing.md, marginTop: 4 }}>
                <Text style={[styles.adHintText, { fontSize: 11, lineHeight: 15, fontStyle: 'italic', textAlign: 'center' }]}>
                  {(t('settings.pro.disclaimer') || "AirTune is an independent Apple Music client, not an official Apple app. Upgrading to Pro removes AirTune's playback and streaming limits and supports development. This purchase is separate from your Apple Music subscription.").replace(/\n/g, ' ')}
                </Text>
              </View>
            </View>
          )}

          {!hasLifetime && (<View style={styles.pricingRow}>
            {([
              { sku: SKUS.MONTHLY, name: t('settings.pro.planMonthly'), sub: prices[SKUS.MONTHLY] ? `${prices[SKUS.MONTHLY]}${t('iap.perMonth')}` : '—', first: activeSubSku === SKUS.YEARLY },
              { sku: SKUS.YEARLY, name: t('settings.pro.planYearly'), sub: prices[SKUS.YEARLY] ? `${prices[SKUS.YEARLY]}${t('iap.perYear')}` : '—', first: !activeSubSku || activeSubSku === SKUS.MONTHLY },
              { sku: SKUS.LIFETIME, name: t('settings.pro.planLifetime'), sub: prices[SKUS.LIFETIME] ?? '—', first: false },
            ] as const).map((plan) => {
              const isLifetimeUser = false;
              const isCurrent = plan.sku === activeSubSku;
              return (
                <Pressable
                  key={plan.sku}
                  style={({ focused }) => [
                    styles.pricingCard,
                    isCurrent ? styles.pricingCardCurrent : (focused && styles.pricingCardFocused),
                  ]}
                  hasTVPreferredFocus={plan.first}
                  focusable={!isCurrent && !isLifetimeUser}
                  onPress={() => { if (!isCurrent && !isLifetimeUser) handlePlanPress(plan.sku); }}>
                  {({ focused }) => (<>
                    {isCurrent && <Text style={styles.currentPlanLabel}>{t('settings.pro.currentPlan')}</Text>}
                    <View style={plan.sku === SKUS.YEARLY ? styles.pricingNameRow : undefined}>
                      <Text style={[styles.pricingName, !isCurrent && focused && styles.pricingFocusedText]} numberOfLines={1} adjustsFontSizeToFit>{plan.name}</Text>
                      {plan.sku === SKUS.YEARLY && <View style={styles.discountBadge}><Text style={styles.discountBadgeText}>-17%</Text></View>}
                    </View>
                    <Text style={[styles.pricingPrice, !isCurrent && focused && styles.pricingFocusedText]} numberOfLines={1} adjustsFontSizeToFit>{plan.sub}</Text>
                  </>)}
                </Pressable>
              );
            })}
          </View>)}

          {(needsCancel || showCancelHint) && (
            <View style={styles.cancelCard}>
              <QRCode
                value="https://play.google.com/store/account/subscriptions"
                size={90}
                backgroundColor="transparent"
                color={colors.textOnDark}
              />
              <View style={styles.cancelTextBlock}>
                <Text style={styles.cancelTitle}>{t('settings.pro.cancelTitle')}</Text>
                {needsCancel && <Text style={styles.cancelBodyBold}>{t('settings.pro.cancelBodyAccess')}</Text>}
                <Text style={styles.cancelBody}>{t('settings.pro.cancelBody', {
                  plan: activeSubSku === SKUS.MONTHLY ? t('settings.pro.planMonthly') : t('settings.pro.planYearly'),
                })}</Text>
              </View>
            </View>
          )}

          {!isPro && (
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
          )}

          {!isPro && (
            <>
              <View style={styles.divider} />
              <SettingsMenuItem
                label={t('settings.pro.restorePurchases')}
                onPress={() => IapService.restorePurchases()}
              />
            </>
          )}
        </>
      </>
    );
  };

  const renderAppPreferencesMenu = () => (
    <>
      <SettingsMenuItem
        prefix="‹"
        label={t('common.back')}
        hasTVPreferredFocus
        onPress={() => setCurrentSubMenu('none')}
      />
      <View style={styles.divider} />
      <SettingsMenuItem
        label={t('settings.language.title')}
        onPress={() => setCurrentSubMenu('language')}
      />
      <SettingsMenuItem
        label={t('settings.theme') + ': ' + (themeMode === 'dark' ? t('settings.themeDark') : t('settings.themeLight'))}
        onPress={() => handleItemPress('DarkMode')}
      />
      {!QuotaService.isProUser() && (
        <SettingsMenuItem
          label={t('settings.quotaIndicator', { state: quotaIndicatorHidden ? t('common.off', 'Off') : t('common.on', 'On') })}
          onPress={() => {
            const next = !quotaIndicatorHidden;
            QuotaService.setQuotaIndicatorHidden(next);
            setQuotaIndicatorHidden(next);
          }}
        />
      )}
      <SettingsMenuItem
        label={t('settings.motionArtwork', { state: motionArtworkEnabled ? t('common.on', 'On') : t('common.off', 'Off') })}
        onPress={() => {
          const next = !motionArtworkEnabled;
          MotionArtworkService.setEnabled(next);
          setMotionArtworkEnabled(next);
        }}
      />
    </>
  );

  const renderSubMenu = () => {
    if (currentSubMenu === 'none') return renderMainMenu();
    if (currentSubMenu === 'language') return renderLanguageMenu();
    if (currentSubMenu === 'subscription') return renderSubscriptionMenu();
    if (currentSubMenu === 'appPreferences') return renderAppPreferencesMenu();

    const renderHighlightedText = (text: string, baseStyle: any, containerStyle?: any) => {
      if (!text) return null;
      const parts = text.split(/(support@adgn\.me|adgn\.me)/g);
      return (
        <Text style={[baseStyle, containerStyle]}>
          {parts.map((part, index) =>
            part === 'adgn.me' || part === 'support@adgn.me' ? (
              <Text key={index} style={{ color: colors.alertRed }}>
                {part}
              </Text>
            ) : (
              part
            )
          )}
        </Text>
      );
    };

    if (currentSubMenu === 'about') {
      return (
        <>
          <SettingsMenuItem
            prefix="‹"
            label={t('common.back')}
            hasTVPreferredFocus
            onPress={() => setCurrentSubMenu('none')}
          />
          <View style={styles.divider} />
          <View style={styles.adHintContainer}>
            <Text style={styles.adHintTitle}>{t('settings.aboutInfo.title')}</Text>
            <Text style={styles.adHintText}>{t('settings.aboutInfo.message')}</Text>
            {t('settings.aboutInfo.website') ? (
              renderHighlightedText(t('settings.aboutInfo.website'), styles.adHintText, { marginTop: spacing.lg })
            ) : null}

            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.adHintText}>App: {CURRENT_VERSION} (OTA v0)</Text>
            </View>
          </View>
        </>
      );
    }

    if (currentSubMenu === 'support') {
      return (
        <>
          <SettingsMenuItem
            prefix="‹"
            label={t('common.back')}
            hasTVPreferredFocus
            onPress={() => setCurrentSubMenu('none')}
          />
          <View style={styles.divider} />
          <View style={styles.adHintContainer}>
            <Text style={styles.adHintTitle}>{t('settings.supportInfo.contactTitle')}</Text>
            <Text style={styles.adHintText}>{t('settings.supportInfo.contactDescription')}</Text>
            {renderHighlightedText(t('settings.supportInfo.email'), styles.adHintText, { marginTop: spacing.lg })}
            {t('settings.supportInfo.website') ? (
              renderHighlightedText(t('settings.supportInfo.website'), styles.adHintText, { marginTop: spacing.xs })
            ) : null}

            {userToken && (
              <View style={styles.userTokenSection}>
                <Text style={[styles.adHintTitle, styles.userTokenTitle]}>{t('settings.supportInfo.userTokenTitle')}</Text>
                <Text style={[styles.adHintText, styles.userTokenDescription]}>
                  {t('settings.supportInfo.userTokenDescription')}
                </Text>
                <View style={styles.userTokenCard}>
                  <Text style={[styles.adHintText, styles.userTokenText]} selectable={true}>
                    {userToken}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </>
      );
    }

    return (
      <>
        <SettingsMenuItem
          prefix="‹"
          label={t('common.back')}
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
                source={{ uri: LOGO_BASE64 }}
                style={[styles.placeholderImage]}
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
});

function getSubMenuTitle(
  subMenu: 'none' | 'language' | 'announcements' | 'subscription' | 'appPreferences' | 'about' | 'support',
  t: (key: string) => string,
): string {
  if (subMenu === 'language') return t('settings.language.title');
  if (subMenu === 'announcements') return t('settings.announcements');
  if (subMenu === 'subscription') return t('settings.subscription');
  if (subMenu === 'about') return t('settings.about');
  if (subMenu === 'support') return t('settings.support');
  if (subMenu === 'appPreferences') return t('settings.appPreferences');
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
    pricingRow: {
      flexDirection: 'row' as const,
      marginHorizontal: spacing.xs,
      gap: spacing.sm,
      marginTop: spacing.xs,
      marginBottom: spacing.md,
    },
    pricingItem: {
      flex: 1,
    },
    pricingCard: {
      flex: 1,
      minWidth: 0,
      alignItems: 'center' as const,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: 'transparent',
    },
    pricingCardCurrent: {},
    pricingCardFocused: {
      backgroundColor: c.settingsCardBg,
      transform: [{ scale: 1.05 }],
    },
    currentPlanLabel: {
      position: 'absolute' as const,
      top: 0,
      alignSelf: 'center' as const,
      fontSize: 10,
      fontWeight: '700' as const,
      color: c.alertRed,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.8,
    },
    pricingName: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: c.settingsTextSubdued,
    },
    pricingPrice: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: c.settingsTextSubdued,
      marginTop: 2,
    },
    pricingUnit: {
      fontSize: 11,
      color: c.settingsTextSubdued,
      marginTop: 1,
    },
    pricingFocusedText: {
      color: c.textOnDark,
    },
    pricingNameRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
    },
    discountBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 20,
      backgroundColor: c.discountGreen,
    },
    discountBadgeText: {
      fontSize: 11,
      fontWeight: '700' as const,
      color: '#ffffff',
      letterSpacing: 0.3,
    },
    adHintContainer: {
      marginTop: spacing.xs,
      marginHorizontal: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
    },
    adHintContainerNoTop: {
      marginTop: 0,
    },
    adHintContainerFirst: {
      marginTop: -spacing.lg,
    },
    textCenter: {
      textAlign: 'center' as const,
    },
    adHintTitle: {
      fontSize: 15,
      fontWeight: '600',
      color: c.settingsTextSubdued,
      marginBottom: spacing.xs,
    },
    featuresTitleAccent: {
      fontSize: 18,
      fontWeight: '700' as const,
      color: c.accent,
    },
    adHintText: {
      fontSize: 14,
      lineHeight: 22,
      color: c.settingsTextSubdued,
    },
    // ── Subscription sub-menu ─────────────────────────────────────────────────
    proActiveCard: {
      marginHorizontal: spacing.md,
      marginTop: -spacing.xs,
      marginBottom: spacing.lg,
      paddingVertical: spacing.sm,
      alignItems: 'center',
      gap: spacing.xs,
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
    cancelCard: {
      marginHorizontal: spacing.md,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: c.alertRed,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: spacing.md,
    },
    cancelTextBlock: {
      flex: 1,
      gap: spacing.xs,
    },
    cancelTitle: {
      fontSize: 14,
      fontWeight: '700' as const,
      color: c.alertRed,
    },
    cancelBodyBold: {
      fontSize: 13,
      fontWeight: '700' as const,
      color: c.settingsTextSubdued,
    },
    cancelBody: {
      fontSize: 13,
      color: c.settingsTextSubdued,
      lineHeight: 20,
    },
    userTokenSection: {
      marginTop: spacing.xl,
    },
    userTokenCard: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      padding: spacing.md,
      borderRadius: 8,
    },
    userTokenTitle: {
      marginBottom: spacing.xs,
    },
    userTokenDescription: {
      fontSize: 13,
      marginBottom: spacing.md,
      opacity: 0.8,
    },
    userTokenText: {
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      opacity: 0.7,
      fontSize: 11,
    },
  });
}
