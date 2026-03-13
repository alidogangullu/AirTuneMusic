import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type SettingsMenuItemProps = {
  label: string;
  onPress?: () => void;
  hasTVPreferredFocus?: boolean;
};

export function SettingsMenuItem({
  label,
  onPress,
  hasTVPreferredFocus = false,
}: Readonly<SettingsMenuItemProps>): React.JSX.Element {
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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
    color: '#111111',
  },
  labelUnfocused: {
    color: 'rgba(0, 0, 0, 0.7)',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '400',
  },
  chevronFocused: {
    color: 'rgba(0, 0, 0, 0.35)',
  },
  chevronUnfocused: {
    color: 'rgba(0, 0, 0, 0.25)',
  },
});
