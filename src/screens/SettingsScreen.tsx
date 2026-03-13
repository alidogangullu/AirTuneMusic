/**
 * SettingsScreen — Apple TV-style settings page.
 * Two-column layout: gray placeholder on the left, menu list on the right.
 * Opened as a Modal from HomeScreen.
 */

import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SettingsMenuItem } from '../components/SettingsMenuItem';
import { GradientBackground } from '../components/GradientBackground';
import { useTheme } from '../theme';
import { spacing, radius } from '../theme/layout';

export type SettingsScreenProps = {
  onBack?: () => void;
  onSignOut?: () => void;
};

const MENU_ITEMS = ['Support', 'About'];

export function SettingsScreen({
  onBack,
  onSignOut,
}: Readonly<SettingsScreenProps>): React.JSX.Element {
  const { colors } = useTheme();

  const handleItemPress = (item: string) => {
    if (item === 'Sign Out') {
      onSignOut?.();
    } else if (item === 'Support') {
      Alert.alert('Support', 'Contact: gullualidogan@gmail.com');
    } else if (item === 'About') {
      Alert.alert(
        'About AirTune Music',
        'AirTune Music is a third-party Apple Music client built exclusively using the official Apple Music API. We do not store any of your personal data; all information is fetched directly from Apple\'s servers to provide a seamless music experience.',
      );
    }
  };

  return (
    <GradientBackground
      startColor={colors.gradientStart}
      endColor={colors.gradientEnd}>
      <Pressable
        style={styles.backArea}
        onPress={onBack}
        focusable={false}
        accessibilityRole="button"
        accessibilityLabel="Close settings"
      />
      <View style={styles.container}>
        {/* Header */}
        <Text style={styles.title}>Settings</Text>

        {/* Two-column layout */}
        <View style={styles.columns}>
          {/* Left — grey placeholder */}
          <View style={styles.leftColumn}>
            <View style={styles.placeholder}>
              <Text style={styles.placeholderIcon}>♫</Text>
            </View>
          </View>

          {/* Right — menu list */}
          <ScrollView
            style={styles.rightColumn}
            contentContainerStyle={styles.menuContent}
            showsVerticalScrollIndicator={false}>
            {MENU_ITEMS.map((item, index) => (
              <SettingsMenuItem
                key={item}
                label={item}
                hasTVPreferredFocus={index === 0}
                onPress={() => handleItemPress(item)}
              />
            ))}
            <View style={styles.divider} />
            <SettingsMenuItem
              label="Sign Out"
              onPress={() => handleItemPress('Sign Out')}
            />
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
  placeholderIcon: {
    fontSize: 100,
    color: 'rgba(0, 0, 0, 0.1)',
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
});
