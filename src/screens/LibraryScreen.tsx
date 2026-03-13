/**
 * Library screen — Apple TV Music style.
 * Left sidebar: category list (Recently Added, Playlists, Artists, Albums, Songs).
 * Right content: 4-column grid of library items with artwork + title + subtitle.
 * D-pad navigable: sidebar ↔ grid focus management.
 */

import React, {useCallback, useState} from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {LoadingIndicator} from '../components/LoadingIndicator';
import {useTheme} from '../theme';
import type {AppColors} from '../theme/colors';
import {radius, spacing} from '../theme/layout';
import {getArtworkUrl} from '../api/apple-music/recommendations';
import {getMusicUserToken} from '../api/apple-music/musicUserToken';
import {useContentNavigation} from '../navigation';
import type {LibraryCategoryId, LibraryItem} from '../types/library';
import {useLibraryInfiniteItems} from '../hooks/useLibraryItems';

// ── Sidebar categories ───────────────────────────────────────────
type SidebarCategory = {
  id: LibraryCategoryId;
  label: string;
};

const CATEGORIES: SidebarCategory[] = [
  {id: 'recently-added', label: 'Recently Added'},
  {id: 'playlists', label: 'Playlists'},
  {id: 'artists', label: 'Artists'},
  {id: 'albums', label: 'Albums'},
  {id: 'songs', label: 'Songs'},
];

const GRID_COLUMNS = 4;
const ARTWORK_SIZE = 150;

// ── Grid item ────────────────────────────────────────────────────

function LibraryGridItem({
  item,
  styles,
  onPress,
}: Readonly<{
  item: LibraryItem;
  styles: ReturnType<typeof useStyles>;
  onPress: (item: LibraryItem) => void;
}>) {
  // Merge item attributes with its catalog counterpart (if included)
  const catalogItem = item.relationships?.catalog?.data?.[0];
  const itemArtworkUrl = item.attributes?.artwork?.url ?? catalogItem?.attributes?.artwork?.url;

  const artworkUrl = getArtworkUrl(
    itemArtworkUrl,
    ARTWORK_SIZE * 2,
    ARTWORK_SIZE * 2,
  );
  const name = item.attributes?.name ?? 'Unknown';
  const subtitle =
    item.attributes?.artistName ?? item.attributes?.albumName ?? '';
  const isArtist = item.type === 'library-artists';

  return (
    <Pressable
      style={({focused}) => [
        styles.gridItem,
        focused && styles.gridItemFocused,
      ]}
      onPress={() => onPress(item)}
      focusable>
      {artworkUrl ? (
        <Image
          source={{uri: artworkUrl}}
          style={[
            styles.artwork,
            isArtist && styles.artworkRound,
          ]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.artworkPlaceholder, isArtist && styles.artworkRound]}>
          <Text style={styles.artworkPlaceholderIcon}>♫</Text>
        </View>
      )}
      <Text style={styles.itemTitle} numberOfLines={1}>
        {name}
      </Text>
      {subtitle ? (
        <Text style={styles.itemSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

// ── Main component ───────────────────────────────────────────────

export function LibraryScreen(): React.JSX.Element {
  const {colors} = useTheme();
  const styles = useStyles(colors);
  const {pushContent} = useContentNavigation();

  const [activeCategory, setActiveCategory] =
    useState<LibraryCategoryId>('recently-added');
  
  const hasUserToken = !!getMusicUserToken();
  const {
    data,
    isLoading,
    isFetchingNextPage,
    error,
    fetchNextPage,
    hasNextPage,
  } = useLibraryInfiniteItems(activeCategory);

  const items = data?.pages.flatMap((page: any) => page.data) ?? [];
  const loading = isLoading && items.length === 0;

  // Load more (pagination)
  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleItemPress = useCallback(
    (item: LibraryItem) => {
      const typeMap: Record<string, string> = {
        'library-albums': 'albums',
        'library-playlists': 'playlists',
        'library-artists': 'artists',
        'library-songs': 'songs',
        'library-music-videos': 'music-videos',
      };
      const catalogItem = item.relationships?.catalog?.data?.[0];
      const catalogId = item.attributes?.playParams?.catalogId ?? catalogItem?.id ?? item.id;
      const artworkObj = item.attributes?.artwork ?? catalogItem?.attributes?.artwork;
      
      pushContent({
        id: catalogId,
        type: (typeMap[item.type] ?? 'albums') as any,
        attributes: {
          name: item.attributes?.name,
          artistName: item.attributes?.artistName,
          artwork: artworkObj
            ? {url: artworkObj.url}
            : undefined,
        },
      });
    },
    [pushContent],
  );

  const handleCategoryPress = useCallback((id: LibraryCategoryId) => {
    setActiveCategory(id);
  }, []);

  const renderGridItem = useCallback(
    (info: {item: LibraryItem}) => (
      <LibraryGridItem item={info.item} styles={styles} onPress={handleItemPress} />
    ),
    [styles, handleItemPress],
  );

  const keyExtractor = useCallback((item: LibraryItem) => item.id, []);

  const renderContent = useCallback(() => {
    if (loading) {
      return <LoadingIndicator />;
    }
    if (!hasUserToken) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Sign in to Apple Music to see your library.</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Could not load library.</Text>
        </View>
      );
    }
    if (items.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No items</Text>
        </View>
      );
    }
    return (
      <FlatList
        data={items}
        renderItem={renderGridItem}
        keyExtractor={keyExtractor}
        numColumns={GRID_COLUMNS}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.gridRow}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />
    );
  }, [loading, hasUserToken, error, items, styles, renderGridItem, keyExtractor, handleLoadMore]);

  return (
    <View style={styles.root}>
      {/* ── Left sidebar ───────────────────────────── */}
      <View style={styles.sidebar}>
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat.id}
            style={({focused}) => [
              styles.sidebarItem,
              activeCategory === cat.id && styles.sidebarItemActive,
              focused && styles.sidebarItemFocused,
            ]}
            onPress={() => handleCategoryPress(cat.id)}
            focusable>
            {({focused}) => (
              <Text
                style={[
                  styles.sidebarText,
                  activeCategory === cat.id && styles.sidebarTextActive,
                  focused && styles.sidebarTextFocused,
                ]}>
                {cat.label}
              </Text>
            )}
          </Pressable>
        ))}
      </View>

      {/* ── Right content grid ─────────────────────── */}
      <View style={styles.content}>
        {renderContent()}
      </View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────

function useStyles(c: AppColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      flexDirection: 'row',
      paddingTop: 80,
    },
    // ── Sidebar ───────────────────────────────────
    sidebar: {
      width: 260,
      paddingLeft: spacing.xl,
      paddingRight: spacing.lg,
      paddingTop: spacing.lg,
    },
    sidebarItem: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      marginBottom: 2,
    },
    sidebarItemActive: {},
    sidebarItemFocused: {
      backgroundColor: 'rgba(255,255,255,0.85)',
      transform: [{scale: 1.02}],
    },
    sidebarText: {
      fontSize: 18,
      fontWeight: '500',
      color: c.textMuted,
    },
    sidebarTextActive: {
      fontWeight: '700',
      color: c.textOnDark,
    },
    sidebarTextFocused: {
      color: '#000000',
      fontWeight: '700',
    },
    // ── Content grid ──────────────────────────────
    content: {
      flex: 1,
      paddingRight: spacing.xl,
    },
    gridContent: {
      paddingBottom: spacing.xxl,
      paddingTop: spacing.sm,
    },
    gridRow: {
      gap: spacing.sm,
      marginBottom: spacing.xl,
    },
    gridItem: {
      flex: 1,
      maxWidth: `${100 / GRID_COLUMNS}%` as any,
      alignItems: 'center',
    },
    gridItemFocused: {
      transform: [{scale: 1.08}],
    },
    artwork: {
      width: ARTWORK_SIZE,
      height: ARTWORK_SIZE,
      borderRadius: 4,
      backgroundColor: 'rgba(0,0,0,0.05)',
    },
    artworkRound: {
      borderRadius: ARTWORK_SIZE / 2,
    },
    artworkPlaceholder: {
      width: ARTWORK_SIZE,
      height: ARTWORK_SIZE,
      borderRadius: radius.sm,
      backgroundColor: 'rgba(0,0,0,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    artworkPlaceholderIcon: {
      fontSize: 48,
      color: 'rgba(0,0,0,0.2)',
    },
    itemTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: c.textOnDark,
      marginTop: spacing.xs,
      textAlign: 'center',
      width: ARTWORK_SIZE,
    },
    itemSubtitle: {
      fontSize: 13,
      color: c.textMuted,
      textAlign: 'center',
      width: ARTWORK_SIZE,
      marginTop: 1,
    },
    // ── States ────────────────────────────────────
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      fontSize: 16,
      color: c.textMuted,
    },
    emptyText: {
      fontSize: 16,
      color: c.textMuted,
    },
  });
}
