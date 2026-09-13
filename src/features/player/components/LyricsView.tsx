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
import { spacing } from '../../../theme/layout';
import { lightColors as C } from '../../../theme/colors';

import { useLyrics } from '../hooks/useLyrics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const LINE_HEIGHT = 70; // Estimated height for local calculation
const LIST_PADDING_TOP = 70; // Give it one line of breathing room from the top

interface LyricLineItemProps {
  line: LyricLine;
  isActive: boolean;
}

const LyricLineItem = React.memo(({ line, isActive }: LyricLineItemProps) => {
  const animValue = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: isActive ? 1 : 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [isActive, animValue]);

  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.03],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12], // Expands and nudges softly to the right, never creeps left
  });

  return (
    <Animated.View
      style={[
        styles.lineWrapper,
        {
          opacity,
          transform: [{ scale }, { translateX }],
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

export function LyricsView({
  showControls = true,
  isTabView = false,
}: Readonly<{
  showControls?: boolean;
  isTabView?: boolean;
}>): React.JSX.Element {
  const { t } = useTranslation();
  const { lyrics, currentLineIndex, isLoading } = useLyrics(true);
  const flatListRef = useRef<FlatList>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lyricsRef = useRef(lyrics);
  lyricsRef.current = lyrics;

  // Fixed at 0.33 when viewed from topbar (tabView), dynamically adjusted (0.33 vs 0.38) in fullscreen modal
  let viewPosition = 0.33;
  if (!isTabView && !showControls) {
    viewPosition = 0.38;
  }

  // Clear any pending scroll retry whenever lyrics change (new song loaded)
  useEffect(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = null;
    }
  }, [lyrics]);

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
          viewPosition,
        });
      } catch (error) {
        console.warn('[LyricsView] Scroll failed:', error);
      }
    }
  }, [currentLineIndex, lyrics.length, viewPosition]);

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
            const currentLyrics = lyricsRef.current;
            if (flatListRef.current && info.index >= 0 && info.index < currentLyrics.length) {
              try {
                flatListRef.current.scrollToIndex({ index: info.index, animated: true, viewPosition });
              } catch (e) {
                console.warn('[LyricsView] Retry scroll failed:', e);
              }
            }
          }, 300);
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
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  lineText: {
    fontSize: 22,
    fontWeight: '700',
    color: C.onDarkTextPrimary,
    opacity: 0.85,
    textAlign: 'left',
    textAlignVertical: 'center',
    letterSpacing: -0.3,
  },
  activeLineText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    opacity: 1,
    textAlign: 'left',
    textAlignVertical: 'center',
    letterSpacing: -0.5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    color: C.onDarkTextDim,
  },
});
