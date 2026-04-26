/**
 * TVActionSheet — reusable Apple TV style action sheet.
 * Accepts an item list from outside and handles focus + animation internally.
 */

import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

export type TVActionSheetItem = {
  key: string;
  label: string;
  onPress: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  items: TVActionSheetItem[];
  busyKey?: string | null;
  feedback?: string | null;
};

export function TVActionSheet({ visible, onClose, items, busyKey, feedback }: Readonly<Props>) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.94)).current;
  const { height: windowHeight } = useWindowDimensions();
  const maxListHeight = windowHeight * 0.75;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 140, useNativeDriver: true }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.94);
    }
  }, [visible, fadeAnim, scaleAnim]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Animated.View style={[styles.menu, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          {feedback ? (
            <View style={styles.feedbackRow}>
              <Text style={styles.feedbackText}>{feedback}</Text>
            </View>
          ) : null}
          <ScrollView
            style={{ maxHeight: maxListHeight }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {items.map((item, index) => (
              <Pressable
                key={item.key}
                style={({ focused }) => [
                  styles.item,
                  focused && !item.disabled && styles.itemFocused,
                  item.disabled && styles.itemDisabled,
                ]}
                focusable={!item.disabled}
                hasTVPreferredFocus={index === 0}
                onPress={async () => { if (!item.disabled) { await item.onPress(); } }}>
                {({ focused }) => busyKey === item.key ? (
                  <ActivityIndicator size="small" color={focused ? '#1c1c1e' : '#ffffff'} />
                ) : (
                  <Text style={[
                    styles.itemText,
                    focused && !item.disabled && styles.itemTextFocused,
                    item.destructive && styles.itemTextDestructive,
                    item.destructive && focused && styles.itemTextDestructiveFocused,
                    item.disabled && styles.itemTextDisabled,
                  ]}>
                    {item.label}
                  </Text>
                )}
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const ITEM_WIDTH = 286;
const ITEM_HEIGHT = 46;
const ITEM_RADIUS = 10;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menu: {
    width: ITEM_WIDTH,
    alignItems: 'stretch',
    gap: 5,
  },
  listContent: {
    gap: 5,
  },
  feedbackRow: {
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  feedbackText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  item: {
    height: ITEM_HEIGHT,
    borderRadius: ITEM_RADIUS,
    backgroundColor: '#2c2c2e',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  itemFocused: {
    backgroundColor: '#ffffff',
  },
  itemText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '400',
  },
  itemTextFocused: {
    color: '#1c1c1e',
    fontWeight: '500',
  },
  itemTextDestructive: {
    color: '#ff453a',
  },
  itemTextDestructiveFocused: {
    color: '#ff453a',
  },
  itemDisabled: {
    opacity: 0.45,
  },
  itemTextDisabled: {
    color: '#8e8e93',
  },
});
