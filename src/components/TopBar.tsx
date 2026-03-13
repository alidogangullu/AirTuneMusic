/**
 * Top navigation bar — Apple Music style.
 * Avatar (left, outside card) + Card (tabs + search together).
 * TV-friendly: focusable, D-pad navigable.
 *
 * Android TV: D-pad is the primary input. Press feedback uses onPress-triggered
 * animation (not `pressed` state) because `pressed` does not fire for D-pad select.
 */

import React, {useCallback, useRef} from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useTheme} from '../theme';
import {spacing} from '../theme/layout';

/** TopBar row height — avatar and card align to this. */
const TOP_BAR_HEIGHT = 38;

const PRESS_DURATION_MS = 80;

function usePressFeedback() {
  const scale = useRef(new Animated.Value(1)).current;
  const trigger = useCallback(() => {
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.94,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: PRESS_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale]);
  return {scale, trigger};
}

function NavPressable({
  onPress,
  children,
  style,
  ...rest
}: React.ComponentProps<typeof Pressable>) {
  const {scale, trigger} = usePressFeedback();
  const handlePress = useCallback(
    (e: unknown) => {
      trigger();
      (onPress as (e?: unknown) => void)?.(e);
    },
    [trigger, onPress],
  );
  return (
    <Animated.View style={{transform: [{scale}]}}>
      <Pressable {...rest} style={style} onPress={handlePress}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

export type NavTabId =
  | 'listen-now'
  | 'browse'
  | 'videos'
  | 'radio'
  | 'library'
  | 'now-playing'
  | 'search';

const NAV_TABS: {id: NavTabId; label: string}[] = [
  {id: 'listen-now', label: 'Listen Now'},
  {id: 'browse', label: 'Browse'},
  {id: 'videos', label: 'Videos'},
  {id: 'radio', label: 'Radio'},
  {id: 'library', label: 'Library'},
  {id: 'now-playing', label: 'Now Playing'},
];

export type TopBarProps = {
  activeTab: NavTabId;
  onTabPress: (tab: NavTabId) => void;
  onAvatarPress?: () => void;
  onSearchPress?: () => void;
  onSettingsPress?: () => void;
  transparent?: boolean;
  dark?: boolean;
};

export function TopBar({
  activeTab,
  onTabPress,
  onAvatarPress,
  onSearchPress,
  onSettingsPress,
  transparent = false,
  dark = false,
}: Readonly<TopBarProps>): React.JSX.Element {
  const {colors} = useTheme();
  const styles = useStyles(colors, transparent, dark);

  return (
    <View style={styles.wrap} focusable={false}>
      <NavPressable
        style={({focused}) => [styles.avatar, focused && styles.avatarFocused]}
        onPress={onAvatarPress}
        focusable={true}
        hasTVPreferredFocus={false}
        accessibilityLabel="Profile"
        accessibilityRole="button">
        <View style={styles.silhouetteContainer}>
          <View style={styles.silhouetteHead} />
          <View style={styles.silhouetteBody} />
        </View>
      </NavPressable>

      <View style={styles.spacer} focusable={false} />
      <View style={styles.card} focusable={false}>
        {NAV_TABS.map(tab => (
          <NavPressable
            key={tab.id}
            style={({focused}) => [
              styles.tabPill,
              focused && styles.tabPillFocused,
            ]}
            onPress={() => onTabPress(tab.id)}
            focusable={true}
            hasTVPreferredFocus={tab.id === activeTab}
            accessibilityLabel={tab.label}
            accessibilityRole="tab">
            {({focused}) => (
              <Text style={[styles.tabText, focused && styles.tabTextFocused]}>
                {tab.label}
              </Text>
            )}
          </NavPressable>
        ))}
        <NavPressable
          style={({focused}) => [
            styles.searchPill,
            focused && styles.searchPillFocused,
          ]}
          onPress={onSearchPress}
          focusable={true}
          hasTVPreferredFocus={false}
          accessibilityLabel="Search"
          accessibilityRole="button">
          {({focused}) => (
            <Text style={[styles.searchIcon, focused && styles.tabTextFocused]}>
              ⌕
            </Text>
          )}
        </NavPressable>
      </View>
      <View style={styles.spacer} focusable={false} />
      <NavPressable
        style={({focused}) => [styles.avatar, focused && styles.avatarFocused]}
        onPress={onSettingsPress}
        focusable={true}
        hasTVPreferredFocus={false}
        accessibilityLabel="Settings"
        accessibilityRole="button">
        {({focused}) => (
          <Text style={[styles.settingsIcon, focused && styles.settingsIconFocused]}>
            ⚙
          </Text>
        )}
      </NavPressable>
    </View>
  );
}

function useStyles(c: {
  navBarCardBg: string;
  navTabFocusedBg: string;
  navTabText: string;
  navTabTextFocused: string;
  navAvatarBg: string;
}, transparent: boolean, dark: boolean) {
  const cardBg = transparent
    ? dark
      ? 'rgba(0,0,0,0.35)'
      : 'rgba(255,255,255,0.12)'
    : c.navBarCardBg;
  const avatarBg = transparent
    ? dark
      ? 'rgba(0,0,0,0.3)'
      : 'rgba(255,255,255,0.15)'
    : c.navAvatarBg;
  const avatarFocusBg = transparent
    ? dark
      ? 'rgba(0,0,0,0.5)'
      : 'rgba(255,255,255,0.3)'
    : c.navTabFocusedBg;
  const textColor = transparent ? 'rgba(255,255,255,0.7)' : c.navTabText;
  const avatarTextColor = transparent ? 'rgba(255,255,255,0.8)' : c.navTabText;

  const tabFocusedShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: {width: 0, height: 1},
          shadowOpacity: 0.1,
          shadowRadius: 4,
        }
      : {elevation: 2};

  return StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      gap: spacing.md,
      overflow: 'visible',
    },
    spacer: {
      flex: 1,
    },
    avatar: {
      width: TOP_BAR_HEIGHT,
      height: TOP_BAR_HEIGHT,
      borderRadius: TOP_BAR_HEIGHT / 2,
      backgroundColor: avatarBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFocused: {
      backgroundColor: avatarFocusBg,
      transform: [{scale: 1.05}],
    },
    silhouetteContainer: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderRadius: TOP_BAR_HEIGHT / 2,
    },
    silhouetteHead: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: avatarTextColor,
      marginTop: 4,
    },
    silhouetteBody: {
      width: 22,
      height: 18,
      borderRadius: 10,
      backgroundColor: avatarTextColor,
      marginTop: 2,
    },
    tabPill: {
      paddingHorizontal: spacing.md,
      paddingVertical: 4,
      justifyContent: 'center',
      borderRadius: 999,
    },
    tabPillFocused: {
      backgroundColor: c.navTabFocusedBg,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      transform: [{scale: 1.18}],
      borderRadius: 999,
      ...tabFocusedShadow,
    },
    tabText: {
      fontSize: 15,
      fontWeight: '500',
      color: textColor,
    },
    tabTextFocused: {
      color: c.navTabTextFocused,
      fontWeight: '600',
    },
    searchPill: {
      paddingHorizontal: spacing.lg,
      paddingVertical: 4,
      justifyContent: 'center',
      borderRadius: 999,
    },
    searchPillFocused: {
      backgroundColor: c.navTabFocusedBg,
      paddingHorizontal: spacing.lg,
      transform: [{scale: 1.18}],
      ...tabFocusedShadow,
    },
    searchIcon: {
      fontSize: 20,
      color: textColor,
      fontWeight: '600',
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      borderRadius: 999,
      backgroundColor: cardBg,
      paddingHorizontal: 0,
      paddingVertical: 0,
      minHeight: TOP_BAR_HEIGHT,
      gap: spacing.xs,
      justifyContent: 'center',
      overflow: 'visible',
    },
    settingsIcon: {
      fontSize: 20,
      color: avatarTextColor,
      fontWeight: '600',
    },
    settingsIconFocused: {
      color: '#FFFFFF',
    },
  });
}
