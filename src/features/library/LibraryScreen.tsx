/**
 * Library screen — Apple TV Music style.
 * Left sidebar: category list (Recently Added, Playlists, Artists, Albums, Songs).
 * Right content: 4-column grid of library items with artwork + title + subtitle.
 * D-pad navigable: sidebar ↔ grid focus management.
 */

import React, { useMemo, useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { useTheme } from '../../theme';
import type { AppColors } from '../../theme/colors';
import { radius, spacing } from '../../theme/layout';
import { getArtworkUrl } from '../recommendations/api/recommendations';
import { getMusicUserToken } from '../../api/apple-music/musicUserToken';
import { usePlayer } from '../player/hooks/usePlayer';
import { formatDuration } from '../content/utils/dateUtils';
import type { TrackInfo } from '../player/musicPlayer';
import { useContentNavigation } from '../home/navigation';
import type { LibraryCategoryId, LibraryItem } from '../../types/library';
import { MotionArtworkCover } from '../../components/MotionArtworkCover';
import { useLibraryInfiniteItems } from './hooks/useLibraryItems';
import { fetchAllLibrarySongs } from './api/library';

// ── Sidebar categories ───────────────────────────────────────────

const CATEGORIES_CONFIG: { id: LibraryCategoryId; labelKey: string }[] = [
  { id: 'recently-added', labelKey: 'library.recentlyAdded' },
  { id: 'playlists', labelKey: 'library.playlists' },
  { id: 'artists', labelKey: 'library.artists' },
  { id: 'albums', labelKey: 'library.albums' },
  { id: 'songs', labelKey: 'library.songs' },
  { id: 'music-videos', labelKey: 'library.musicVideos' },
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
  const { t } = useTranslation();
  const isMusicVideo = item.type === 'library-music-videos';
  const name = (isMusicVideo ? catalogItem?.attributes?.name : undefined)
    ?? item.attributes?.name
    ?? t('common.unknown');
  const subtitle =
    item.attributes?.artistName ?? catalogItem?.attributes?.artistName ?? item.attributes?.albumName ?? '';
  const isArtist = item.type === 'library-artists';

  // Motion artwork needs the catalog id (amp-api); library ids won't resolve.
  // Library albums/playlists carry their catalog counterpart via include=catalog.
  const catalogId: string | undefined =
    catalogItem?.id ?? item.attributes?.playParams?.catalogId;
  const MOTION_TYPE: Record<string, 'playlists' | 'albums'> = {
    'library-playlists': 'playlists',
    'library-albums': 'albums',
  };
  const motionType = MOTION_TYPE[item.type];
  const supportsMotion = !!motionType && !!catalogId;

  const renderArtwork = (focused: boolean) => {
    if (supportsMotion && motionType && catalogId) {
      return (
        <MotionArtworkCover
          contentType={motionType}
          contentId={catalogId}
          artworkUrl={artworkUrl ?? undefined}
          focused={focused}
          width={ARTWORK_SIZE}
          height={ARTWORK_SIZE}
          borderRadius={4}
        />
      );
    }
    if (artworkUrl) {
      return (
        <Image
          source={{ uri: artworkUrl }}
          style={[styles.artwork, isArtist && styles.artworkRound]}
          resizeMode="cover"
        />
      );
    }
    return (
      <View style={[styles.artworkPlaceholder, isArtist && styles.artworkRound]}>
        <Text style={styles.artworkPlaceholderIcon}>♫</Text>
      </View>
    );
  };

  return (
    <Pressable
      style={({ focused }) => [
        styles.gridItem,
        focused && styles.gridItemFocused,
      ]}
      onPress={() => onPress(item)}
      focusable>
      {({ focused }) => (
        <>
          {renderArtwork(focused)}
          <Text style={styles.itemTitle} numberOfLines={1}>
            {name}
          </Text>
          {subtitle ? (
            <Text style={styles.itemSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}


function libraryItemToTrackInfo(item: LibraryItem, index: number): TrackInfo {
  const catalogItem = item.relationships?.catalog?.data?.[0];
  const catalogId = item.attributes?.playParams?.catalogId ?? catalogItem?.id ?? item.id;
  const attrs = item.attributes;
  const artworkObj = attrs?.artwork ?? catalogItem?.attributes?.artwork;
  
  return {
    id: catalogId,
    title: attrs?.name ?? catalogItem?.attributes?.name ?? null,
    artistName: attrs?.artistName ?? catalogItem?.attributes?.artistName ?? null,
    albumTitle: attrs?.albumName ?? catalogItem?.attributes?.albumName ?? null,
    artworkUrl: getArtworkUrl(artworkObj?.url, 200, 200) ?? null,
    duration: attrs?.durationInMillis ?? 0,
    trackIndex: index,
  };
}

const LibraryTrackRow = React.memo(function LibraryTrackRow({
  item,
  index,
  onPress,
  isNowPlaying,
  styles,
}: {
  item: LibraryItem;
  index: number;
  onPress: (index: number) => void;
  isNowPlaying: boolean;
  styles: ReturnType<typeof useStyles>;
}) {
  const [focused, setFocused] = useState(false);
  const THUMB = 52;
  const catalogItem = item.relationships?.catalog?.data?.[0];
  const artworkObj = item.attributes?.artwork ?? catalogItem?.attributes?.artwork;
  const thumbUrl = getArtworkUrl(artworkObj?.url, THUMB, THUMB);
  const duration = item.attributes?.durationInMillis
    ? formatDuration(item.attributes.durationInMillis)
    : '';


  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() => onPress(index)}
      style={[styles.trackRow, focused && styles.trackRowFocused]}
      focusable>
      <View style={styles.trackThumbContainer}>
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.trackThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.trackThumb, styles.trackThumbPlaceholder]} />
        )}
      </View>
      <View style={styles.trackInfo}>
        <Text
          style={[
            styles.trackName,
            focused && styles.trackNameFocused,
            isNowPlaying && styles.trackNamePlaying,
          ]}
          numberOfLines={1}>
          {item.attributes?.name ?? ''}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {item.attributes?.artistName ?? ''}
        </Text>
      </View>
      <Text style={[styles.trackDuration, focused && styles.trackDurationFocused]}>
        {duration}
      </Text>
    </Pressable>
  );
});

function LibrarySongsHeader({
  onPlay,
  onShuffle,
  styles,
}: Readonly<{
  onPlay: () => void;
  onShuffle: () => void;
  styles: ReturnType<typeof useStyles>;
}>) {
  const { t } = useTranslation();
  const [playFocused, setPlayFocused] = useState(false);
  const [shuffleFocused, setShuffleFocused] = useState(false);

  return (
    <View style={styles.listHeader}>
      <Pressable
        style={[styles.headerButton, playFocused && styles.headerButtonFocused]}
        onFocus={() => setPlayFocused(true)}
        onBlur={() => setPlayFocused(false)}
        onPress={onPlay}
        focusable>
        <Text style={[styles.headerButtonText, playFocused && styles.headerButtonTextFocused]}>
          ▶  {t('detail.play')}
        </Text>
      </Pressable>
      <Pressable
        style={[styles.headerButton, shuffleFocused && styles.headerButtonFocused]}
        onFocus={() => setShuffleFocused(true)}
        onBlur={() => setShuffleFocused(false)}
        onPress={onShuffle}
        focusable>
        <Text style={[styles.headerButtonText, shuffleFocused && styles.headerButtonTextFocused]}>
          ⇌  {t('detail.shuffle')}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Main component ───────────────────────────────────────────────

export function LibraryScreen(): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const { pushContent, openNowPlayingFullscreen } = useContentNavigation();
  const { playTracks, state: playerState } = usePlayer();

  const [activeCategory, setActiveCategory] =
    useState<LibraryCategoryId>('recently-added');

  const hasUserToken = !!getMusicUserToken();
  const limit = activeCategory === 'songs' ? 100 : 25;
  const {
    data,
    isLoading,
    isFetchingNextPage,
    error,
    fetchNextPage,
    hasNextPage,
  } = useLibraryInfiniteItems(activeCategory, limit);

  const items = React.useMemo(() => {
    const allItems = data?.pages.flatMap((page: any) => page.data) ?? [];
    const seen = new Set<string>();
    return allItems.filter((item: LibraryItem) => {
      const catalogItem = item.relationships?.catalog?.data?.[0];
      const catalogId = item.attributes?.playParams?.catalogId ?? catalogItem?.id ?? item.id;
      if (seen.has(catalogId)) return false;
      seen.add(catalogId);
      return true;
    });
  }, [data]);
  const loading = isLoading && items.length === 0;

  // Load more (pagination)
  const handleLoadMore = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleItemPress = useCallback(
    (item: LibraryItem) => {
      if (item.type === 'library-music-videos') {
        const catalogItem = item.relationships?.catalog?.data?.[0];
        const catalogId = item.attributes?.playParams?.catalogId ?? catalogItem?.id ?? item.id;
        const artworkObj = item.attributes?.artwork ?? catalogItem?.attributes?.artwork;
        pushContent({
          id: catalogId,
          type: 'music-videos',
          attributes: {
            name: item.attributes?.name,
            artistName: item.attributes?.artistName,
            artwork: artworkObj ? { url: artworkObj.url } : undefined,
          },
        });
        return;
      }

      const typeMap: Record<string, string> = {
        'library-albums': 'albums',
        'library-playlists': 'playlists',
        'library-artists': 'artists',
        'library-songs': 'songs',
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
          artwork: artworkObj ? { url: artworkObj.url } : undefined,
        },
      });
    },
    [pushContent],
  );

  const handleCategoryPress = useCallback((id: LibraryCategoryId) => {
    setActiveCategory(id);
  }, []);

  const renderGridItem = useCallback(
    (info: { item: LibraryItem }) => (
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
          <Text style={styles.errorText}>{t('library.signInPrompt')}</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{t('library.loadError')}</Text>
        </View>
      );
    }
    if (items.length === 0) {
      return (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>{t('common.noItems')}</Text>
        </View>
      );
    }
    if (activeCategory === 'songs') {
      const handlePlayList = async (shuffle: boolean, itemIndex?: number) => {
        let source;
        try {
          source = await fetchAllLibrarySongs();
          source = source.filter(item =>
            item.type !== 'library-music-videos' &&
            item.attributes?.name !== 'Unknown Album'
          );
        } catch {
          source = items;
        }

        const seen = new Set<string>();
        let validSource = source.filter(item => {
          const catalogItem = item.relationships?.catalog?.data?.[0];
          const catalogId = item.attributes?.playParams?.catalogId ?? catalogItem?.id ?? item.id;
          if (!catalogId || catalogId.startsWith('i.') || seen.has(catalogId)) return false;
          seen.add(catalogId);
          return true;
        });
        if (validSource.length === 0) validSource = source;

        let tracksToPlay: TrackInfo[] = [];
        let finalStartIndex = 0;
        const MAX_QUEUE = 500;

        if (shuffle) {
          const shuffled = [...validSource];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          tracksToPlay = shuffled.slice(0, MAX_QUEUE).map((it, idx) => libraryItemToTrackInfo(it, idx));
        } else {
          let startIndex = 0;
          if (itemIndex !== undefined && items[itemIndex]) {
            const clickedItem = items[itemIndex];
            startIndex = validSource.findIndex((it: LibraryItem) => it.id === clickedItem.id);
            if (startIndex === -1) startIndex = 0;
          }
          const sliced = validSource.slice(startIndex, startIndex + MAX_QUEUE);
          tracksToPlay = sliced.map((it, idx) => libraryItemToTrackInfo(it, startIndex + idx));
        }

        const success = await playTracks(tracksToPlay, finalStartIndex, shuffle);
        if (success) openNowPlayingFullscreen();
      };

      const renderTrackRow = ({ item, index }: { item: LibraryItem; index: number }) => {
        const catalogItem = item.relationships?.catalog?.data?.[0];
        const catalogId = item.attributes?.playParams?.catalogId ?? catalogItem?.id ?? item.id;
        const isNowPlaying = playerState.track?.id === catalogId;
        return (
          <LibraryTrackRow
            item={item}
            index={index}
            onPress={(idx) => {
              if (isNowPlaying) {
                openNowPlayingFullscreen();
              } else {
                handlePlayList(false, idx);
              }
            }}
            isNowPlaying={isNowPlaying}
            styles={styles}
          />
        );
      };

      return (
        <FlatList
          key={activeCategory}
          data={items}
          renderItem={renderTrackRow}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <LibrarySongsHeader
              onPlay={() => handlePlayList(false)}
              onShuffle={() => handlePlayList(true)}
              styles={styles}
            />
          }
        />
      );
    }

    return (
      <FlatList
        key={activeCategory}
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
  }, [loading, hasUserToken, error, items, styles, renderGridItem, keyExtractor, handleLoadMore, t, activeCategory, openNowPlayingFullscreen, playTracks, playerState.track?.id]);

  return (
    <View style={styles.root}>
      {/* ── Left sidebar ───────────────────────────── */}
      <View style={styles.sidebar}>
        {CATEGORIES_CONFIG.map(cat => (
          <Pressable
            key={cat.id}
            style={({ focused }) => [
              styles.sidebarItem,
              activeCategory === cat.id && styles.sidebarItemActive,
              focused && styles.sidebarItemFocused,
            ]}
            onPress={() => handleCategoryPress(cat.id)}
            focusable>
            {({ focused }) => (
              <Text
                style={[
                  styles.sidebarText,
                  activeCategory === cat.id && styles.sidebarTextActive,
                  focused && styles.sidebarTextFocused,
                ]}>
                {t(cat.labelKey)}
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
  return useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
      flexDirection: 'row',
      paddingTop: 100,
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
      backgroundColor: c.buttonFocusedBg,
      transform: [{ scale: 1.02 }],
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
      color: c.textOnDark,
      fontWeight: '700',
    },
    // ── List (Songs) ──────────────────────────────
    listContent: {
      paddingBottom: spacing.xxl,
      paddingTop: spacing.sm,
    },
    listHeader: {
      flexDirection: 'row',
      marginBottom: spacing.lg,
      gap: spacing.md,
    },
    headerButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: c.glassBg,
    },
    headerButtonFocused: {
      backgroundColor: c.buttonFocusedBg,
      transform: [{ scale: 1.05 }],
    },
    headerButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textOnDark,
    },
    headerButtonTextFocused: {},
    trackThumbContainer: {
      width: 52,
      height: 52,
      borderRadius: radius.sm,
      overflow: 'hidden',
      flexShrink: 0,
    },
    trackThumb: {
      width: '100%',
      height: '100%',
    },
    trackThumbPlaceholder: {
      backgroundColor: c.navBarCardBg,
    },
    trackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      gap: spacing.md,
    },
    trackRowFocused: {
      backgroundColor: c.glassCardBgStrong,
    },
    trackPrefix: {
      width: 40,
      fontSize: 15,
      color: c.textMuted,
      textAlign: 'center',
    },
    trackPrefixFocused: {
      color: c.textOnDark,
    },
    trackPrefixBars: {
      width: 40,
      alignItems: 'center',
    },
    trackInfo: {
      flex: 1,
      justifyContent: 'center',
    },
    trackName: {
      fontSize: 15,
      fontWeight: '500',
      color: c.textOnDark,
    },
    trackNameFocused: {
      fontWeight: '700',
    },
    trackNamePlaying: {
      color: c.accent,
    },
    trackArtist: {
      fontSize: 13,
      color: c.textMuted,
    },
    trackDuration: {
      fontSize: 14,
      color: c.textMuted,
      width: 60,
      textAlign: 'right',
    },
    trackDurationFocused: {
      color: c.textOnDark,
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
      marginBottom: spacing.xl,
      justifyContent: 'flex-start',
    },
    gridItem: {
      width: `${100 / GRID_COLUMNS}%` as any,
      paddingRight: spacing.sm,
      alignItems: 'center',
    },
    gridItemFocused: {
      transform: [{ scale: 1.08 }],
    },
    artwork: {
      width: ARTWORK_SIZE,
      height: ARTWORK_SIZE,
      borderRadius: 4,
      backgroundColor: c.subtleBg,
    },
    artworkRound: {
      borderRadius: ARTWORK_SIZE / 2,
    },
    artworkPlaceholder: {
      width: ARTWORK_SIZE,
      height: ARTWORK_SIZE,
      borderRadius: radius.sm,
      backgroundColor: c.navBarGreyBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    artworkPlaceholderIcon: {
      fontSize: 48,
      color: c.settingsTextDisabled,
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
  }), [c]);
}
