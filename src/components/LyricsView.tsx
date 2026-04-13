import React, { useCallback, useEffect, useRef } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  View,
  Dimensions,
  Animated,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LyricLine } from '../utils/lrcParser';
import { spacing } from '../theme/layout';

import { useLyrics } from '../hooks/useLyrics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const LINE_HEIGHT = 70; // Estimated height for local calculation
const LIST_PADDING_TOP = 70; // Give it one line of breathing room from the top

interface LyricLineItemProps {
  line: LyricLine;
  isActive: boolean;
}

const LyricLineItem = React.memo(({ line, isActive }: LyricLineItemProps) => {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isActive ? 1 : 0.4,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [isActive]);

  return (
    <Animated.View
      style={[
        styles.lineWrapper,
        {
          opacity,
        },
      ]}>
      <Text
        style={[styles.lineText, isActive && styles.activeLineText]}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.7}
        allowFontScaling={true}
      >
        {line.text}
      </Text>
    </Animated.View>
  );
});

export function LyricsView(): React.JSX.Element {
  const { t } = useTranslation();
  const { lyrics, currentLineIndex, isLoading } = useLyrics(true);
  const flatListRef = useRef<FlatList>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up the timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (lyrics.length > 0 && currentLineIndex >= 0 && currentLineIndex < lyrics.length && flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({
          index: currentLineIndex,
          animated: true,
          viewPosition: 0.28, // Positions the active line further down to show previous lines
        });
      } catch (error) {
        console.warn('[LyricsView] Scroll failed:', error);
      }
    }
  }, [currentLineIndex, lyrics.length]);

  const renderItem = useCallback(
    ({ item, index }: { item: LyricLine; index: number }) => (
      <LyricLineItem line={item} isActive={index === currentLineIndex} />
    ),
    [currentLineIndex],
  );

  if (isLoading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('lyrics.loading')}</Text>
      </View>
    );
  }

  if (lyrics.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('lyrics.notFound')}</Text>
      </View>
    );
  }

  return (
    <View 
      style={styles.container} 
      {...({ descendantFocusability: 'blocksDescendants' } as any)} 
      focusable={false} 
      pointerEvents="none"
    >
      <FlatList
        ref={flatListRef}
        data={lyrics}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.time}-${index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        onScrollToIndexFailed={(info) => {
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current);
          }
          scrollTimeoutRef.current = setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
          }, 500);
        }}
        // On TV, focus is handled elsewhere, so we just want a passive scrollable list
        focusable={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  listContent: {
    paddingTop: LIST_PADDING_TOP,
    paddingBottom: SCREEN_HEIGHT / 2,
    paddingHorizontal: spacing.lg,
  },
  lineWrapper: {
    minHeight: LINE_HEIGHT,
    justifyContent: 'center',
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  lineText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.8,
    textAlign: 'left',
    textAlignVertical: 'center',
  },
  activeLineText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    opacity: 1,
    textAlign: 'left',
    textAlignVertical: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.4)',
  },
});
