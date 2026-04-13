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

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const LINE_HEIGHT = 70; // Estimated height for local calculation
const LIST_PADDING_TOP = 70; // Give it one line of breathing room from the top

interface LyricsViewProps {
  lyrics: LyricLine[];
  currentLineIndex: number;
  isLoading?: boolean;
}

interface LyricLineItemProps {
  line: LyricLine;
  isActive: boolean;
}

const LyricLineItem = React.memo(({ line, isActive }: LyricLineItemProps) => {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isActive ? 1 : 0.4,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [isActive, opacity]);

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
      // Removed numberOfLines={1} to allow wrapping
      >
        {line.text}
      </Text>
    </Animated.View>
  );
});

export function LyricsView({
  lyrics,
  currentLineIndex,
  isLoading,
}: LyricsViewProps): React.JSX.Element {
  const { t } = useTranslation();
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (lyrics.length > 0 && currentLineIndex >= 0 && flatListRef.current) {
      flatListRef.current.scrollToIndex({
        index: currentLineIndex,
        animated: true,
        viewPosition: 0.12, // Positions the active line slightly below the top (around 2nd row)
      });
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
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={lyrics}
        renderItem={renderItem}
        keyExtractor={(item, index) => `${item.time}-${index}`}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        getItemLayout={(_, index) => ({
          length: LINE_HEIGHT + (spacing.sm * 2),
          offset: (LINE_HEIGHT + (spacing.sm * 2)) * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
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
    paddingHorizontal: spacing.xl,
  },
  lineWrapper: {
    height: LINE_HEIGHT,
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  lineText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.8,
  },
  activeLineText: {
    fontSize: 28, // Previously 28/40
    fontWeight: '800',
    color: '#fff',
    opacity: 1,
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
