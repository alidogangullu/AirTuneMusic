import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../theme';
import type { AppColors } from '../../../theme/colors';

export type SettingsMenuItemProps = {
  label: string;
  onPress?: () => void;
  hasTVPreferredFocus?: boolean;
  labelColor?: string;
};

export function SettingsMenuItem({
  label,
  onPress,
  hasTVPreferredFocus = false,
  labelColor,
}: Readonly<SettingsMenuItemProps>): React.JSX.Element {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View>
      <Pressable
        style={({ focused }) => [
          styles.row,
          focused ? styles.rowFocused : styles.rowUnfocused,
        ]}
        onPress={onPress}
        focusable={true}
        hasTVPreferredFocus={hasTVPreferredFocus}
        accessibilityLabel={label}
        accessibilityRole="button">
        {({ focused }) => (
          <>
            <Text
              style={[
                styles.label,
                focused ? styles.labelFocused : styles.labelUnfocused,
                labelColor ? { color: labelColor } : undefined,
              ]}>
              {label}
            </Text>
            <Text
              style={[
                styles.chevron,
                focused ? styles.chevronFocused : styles.chevronUnfocused,
              ]}>
              ›
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const ROW_HEIGHT = 52;

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: ROW_HEIGHT,
      paddingHorizontal: 24,
      borderRadius: 12,
      overflow: 'visible',
    },
    rowFocused: {
      backgroundColor: c.settingsCardBg,
      transform: [{ scale: 1.03 }],
    },
    rowUnfocused: {
      backgroundColor: 'transparent',
    },
    label: {
      fontSize: 17,
      fontWeight: '500',
    },
    labelFocused: {
      color: c.textOnDark,
    },
    labelUnfocused: {
      color: c.settingsTextSubdued,
    },
    chevron: {
      fontSize: 22,
      fontWeight: '400',
    },
    chevronFocused: {
      color: c.settingsTextHint,
    },
    chevronUnfocused: {
      color: c.settingsTextDisabled,
    },
  });
}
