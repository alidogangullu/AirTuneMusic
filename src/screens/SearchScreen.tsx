/**
 * Search screen — Apple TV Music style.
 * Top: search bar with magnifying glass icon + placeholder.
 * Middle: TV-friendly virtual letter keyboard row.
 * Bottom: Search results grid (3-column).
 * When user types, shows search results instead of categories.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { useTheme } from '../theme';
import { radius, spacing } from '../theme/layout';
import { searchCatalog } from '../api/apple-music/search';
import { getArtworkUrl } from '../api/apple-music/recommendations';
import { useContentNavigation } from '../navigation';
import { useRecentSearches } from '../hooks/useRecentSearches';
import type { SearchResultItem } from '../types/search';

// ── Keyboard layout ──────────────────────────────────────────────
const ALPHA_KEYS = 'abcdefghijklmnopqrstuvwxyz'.split('');
const SPECIAL_KEYS = [{ id: '123', label: '123' }, { id: 'SPACE', label: 'SPACE' }];

// ── Main component ───────────────────────────────────────────────

export function SearchScreen(): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const { pushContent } = useContentNavigation();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { recentSearches, addRecentSearch, clearRecentSearches } =
    useRecentSearches();

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchCatalog(searchTerm, 'tr', 25)
        .then(res => {
          const results: SearchResultItem[] = [];
          const r = res.results;
          if (r.artists?.data) { results.push(...r.artists.data); }
          if (r.songs?.data) { results.push(...r.songs.data); }
          if (r.albums?.data) { results.push(...r.albums.data); }
          if (r.playlists?.data) { results.push(...r.playlists.data); }
          setSearchResults(results);
        })
        .catch(e => console.warn('[Search] search error:', e))
        .finally(() => setSearching(false));
    }, 750);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const handleKeyPress = useCallback((key: string) => {
    if (key === 'SPACE') {
      setSearchTerm(prev => prev + ' ');
    } else if (key === 'DELETE') {
      setSearchTerm(prev => prev.slice(0, -1));
    } else if (key === '123') {
      setShowNumbers(prev => !prev);
    } else {
      setSearchTerm(prev => prev + key);
    }
  }, []);

  const handleResultPress = useCallback((item: SearchResultItem) => {
    const typeMap: Record<string, string> = {
      songs: 'songs',
      albums: 'albums',
      artists: 'artists',
      playlists: 'playlists',
    };
    const contentType = typeMap[item.type] ?? item.type;
    addRecentSearch(item);

    pushContent({
      id: item.id,
      type: contentType as any,
      attributes: {
        name: item.attributes?.name,
        artistName: item.attributes?.artistName,
        artwork: item.attributes?.artwork,
      },
    });
  }, [pushContent, addRecentSearch]);

  const hasSearch = searchTerm.trim().length > 0;

  const numberKeys = '1234567890'.split('');
  const keyboardKeys = showNumbers ? numberKeys : ALPHA_KEYS;

  return (
    <View style={styles.root}>
      {/* ── Search Bar ─────────────────────────────── */}
      <View style={styles.searchBarContainer}>
        <Text style={styles.searchIcon}>⌕</Text>
        <Text style={searchTerm ? styles.searchText : styles.searchPlaceholder} numberOfLines={1}>
          {searchTerm || 'Artists, Songs, Lyrics, and More'}
        </Text>
      </View>

      {/* ── Virtual Keyboard ───────────────────────── */}
      <View style={styles.keyboardRow}>
        {SPECIAL_KEYS.map(k => (
          <KeyButton
            key={k.id}
            label={k.id === '123' ? (showNumbers ? 'abc' : '123') : k.label}
            onPress={() => handleKeyPress(k.id)}
            styles={styles}
            isSpecial
          />
        ))}
        {keyboardKeys.map(letter => (
          <KeyButton
            key={letter}
            label={letter}
            onPress={() => handleKeyPress(letter)}
            styles={styles}
          />
        ))}
        <KeyButton
          label="⌫"
          onPress={() => handleKeyPress('DELETE')}
          styles={styles}
          isSpecial
        />
      </View>

      {/* ── Divider ────────────────────────────────── */}
      <View style={styles.divider} />

      {/* ── Content: Results ───────────────────────── */}
      {hasSearch ? (
        <View style={styles.resultsContainer}>
          <SearchResultsContent
            searching={searching}
            results={searchResults}
            onResultPress={handleResultPress}
            styles={styles}
            accentColor={colors.accent}
          />
        </View>
      ) : (
        <View style={styles.resultsContainer}>
          {recentSearches.length > 0 && (
            <RecentSearchesRow
              items={recentSearches}
              onPress={handleResultPress}
              onClear={clearRecentSearches}
              styles={styles}
            />
          )}
        </View>
      )}
    </View>
  );
}

// ── Key Button ───────────────────────────────────────────────────

function KeyButton({
  label,
  onPress,
  styles,
  isSpecial,
}: Readonly<{
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
  isSpecial?: boolean;
}>) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[
        isSpecial ? styles.specialKey : styles.letterKey,
        focused && styles.keyFocused,
      ]}
      focusable>
      <Text style={[styles.keyText, focused && styles.keyTextFocused]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Search Results Content ───────────────────────────────────────

function SearchResultsContent({
  searching,
  results,
  onResultPress,
  styles,
}: Readonly<{
  searching: boolean;
  results: SearchResultItem[];
  onResultPress: (item: SearchResultItem) => void;
  styles: ReturnType<typeof useStyles>;
  accentColor: string;
}>) {
  if (searching) {
    return <LoadingIndicator />;
  }
  if (results.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No Results</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={results}
      keyExtractor={item => `${item.type}-${item.id}`}
      renderItem={({ item }) => (
        <SearchResultRow
          item={item}
          onPress={() => onResultPress(item)}
          styles={styles}
        />
      )}
      showsVerticalScrollIndicator={false}
      numColumns={3}
      columnWrapperStyle={styles.resultColumns}
      contentContainerStyle={styles.resultListContent}
    />
  );
}

// ── Recent Searches UI ───────────────────────────────────────────

function RecentSearchesRow({
  items,
  onPress,
  styles,
}: Readonly<{
  items: SearchResultItem[];
  onPress: (item: SearchResultItem) => void;
  onClear: () => void;
  styles: ReturnType<typeof useStyles>;
}>) {
  return (
    <View style={styles.recentSearchesContainer}>
      <Text style={styles.recentSearchesTitle}>Recently Searched</Text>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.recentSearchesList}
        contentContainerStyle={styles.recentSearchesListContent}
        keyExtractor={item => `${item.type}-${item.id}`}
        renderItem={({ item }) => (
          <RecentSearchCard
            item={item}
            onPress={() => onPress(item)}
            styles={styles}
          />
        )}
      />
    </View>
  );
}

function RecentSearchCard({
  item,
  onPress,
  styles,
}: Readonly<{
  item: SearchResultItem;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
}>) {
  const [focused, setFocused] = useState(false);
  const THUMB = 72;
  const artworkUrl = getArtworkUrl(item.attributes?.artwork?.url, THUMB * 2, THUMB * 2);
  const TYPE_LABELS: Record<string, string> = {
    artists: 'Artist',
    songs: 'Song',
    albums: 'Album',
    playlists: 'Playlist',
  };
  const typeLabel = TYPE_LABELS[item.type] ?? item.type;
  const subtitle = item.attributes?.artistName
    ? `${typeLabel} · ${item.attributes.artistName}`
    : typeLabel;

  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.recentSearchCard, focused && styles.recentSearchCardFocused]}
      focusable>
      {artworkUrl ? (
        <Image
          source={{ uri: artworkUrl }}
          style={[
            styles.recentSearchThumb,
            item.type === 'artists' && styles.recentSearchThumbRound,
          ]}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.recentSearchThumb, styles.resultThumbPlaceholder,
        item.type === 'artists' && styles.recentSearchThumbRound]} />
      )}
      <View style={styles.recentSearchInfo}>
        <Text
          style={[styles.recentSearchName, focused && styles.resultNameFocused]}
          numberOfLines={1}>
          {item.attributes?.name ?? ''}
        </Text>
        <Text style={styles.recentSearchSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Search Result Row ────────────────────────────────────────────

function SearchResultRow({
  item,
  onPress,
  styles,
}: Readonly<{
  item: SearchResultItem;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
}>) {
  const [focused, setFocused] = useState(false);
  const THUMB = 60;
  const artworkUrl = getArtworkUrl(item.attributes?.artwork?.url, THUMB, THUMB);
  const TYPE_LABELS: Record<string, string> = {
    artists: 'Artist',
    songs: 'Song',
    albums: 'Album',
    playlists: 'Playlist',
  };
  const typeLabel = TYPE_LABELS[item.type] ?? item.type;

  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.resultCard, focused && styles.resultCardFocused]}
      focusable>
      {artworkUrl ? (
        <Image source={{ uri: artworkUrl }} style={styles.resultThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.resultThumb, styles.resultThumbPlaceholder]} />
      )}
      <View style={styles.resultInfo}>
        <Text style={[styles.resultName, focused && styles.resultNameFocused]} numberOfLines={1}>
          {item.attributes?.name ?? ''}
        </Text>
        <Text style={styles.resultSubtitle} numberOfLines={1}>
          {item.attributes?.artistName
            ? `${typeLabel} · ${item.attributes.artistName}`
            : typeLabel}
        </Text>
      </View>
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────

function useStyles(c: {
  textOnDark: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  navBarCardBg: string;
  borderMuted: string;
  buttonSecondaryBg: string;
  navTabFocusedBg: string;
}) {
  return StyleSheet.create({
    root: {
      flex: 1,
      paddingTop: 70,
      paddingHorizontal: spacing.xxl,
    },
    // ── Search bar ────────────────────────────────────
    searchBarContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    searchIcon: {
      fontSize: 36,
      color: c.textMuted,
      fontWeight: '300',
    },
    searchText: {
      fontSize: 32,
      fontWeight: '400',
      color: c.textOnDark,
      flex: 1,
    },
    searchPlaceholder: {
      fontSize: 32,
      fontWeight: '400',
      color: c.textMuted,
      flex: 1,
    },
    // ── Virtual keyboard ──────────────────────────────
    keyboardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xl,
      flexWrap: 'nowrap',
    },
    letterKey: {
      paddingHorizontal: 0,
      paddingVertical: 2,
      borderRadius: 6,
      minWidth: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    specialKey: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.sm,
      backgroundColor: 'rgba(0,0,0,0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    keyFocused: {
      backgroundColor: 'rgba(0,0,0,0.15)',
      transform: [{ scale: 1.15 }],
    },
    keyText: {
      fontSize: 20,
      fontWeight: '500',
      color: c.textOnDark,
    },
    keyTextFocused: {
      fontWeight: '700',
    },
    // ── Divider ───────────────────────────────────────
    divider: {
      height: 1,
      backgroundColor: c.textMuted,
      marginBottom: spacing.md,
    },
    // ── Search results ────────────────────────────────
    resultsContainer: {
      flex: 1,
    },
    resultListContent: {
      paddingBottom: spacing.xxl,
    },
    resultColumns: {
      gap: spacing.lg,
      marginBottom: spacing.sm,
    },
    resultCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
    },
    resultCardFocused: {
      backgroundColor: 'rgba(255, 255, 255, 0.90)',
    },
    resultThumb: {
      width: 60,
      height: 60,
      borderRadius: radius.sm,
    },
    resultThumbPlaceholder: {
      backgroundColor: c.navBarCardBg,
    },
    resultInfo: {
      flex: 1,
    },
    resultName: {
      fontSize: 15,
      fontWeight: '500',
      color: c.textOnDark,
    },
    resultNameFocused: {
      fontWeight: '700',
    },
    resultSubtitle: {
      fontSize: 13,
      color: c.textMuted,
      marginTop: 2,
    },
    // ── Loading / empty ───────────────────────────────
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: spacing.xxxl,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: spacing.xxxl,
    },
    emptyText: {
      fontSize: 18,
      color: c.textMuted,
    },
    // ── Recently Searched ─────────────────────────────
    recentSearchesContainer: {
      marginTop: spacing.xs,
    },
    recentSearchesTitle: {
      fontSize: 22,
      fontWeight: '700',
      color: c.textOnDark,
    },
    recentSearchesList: {
      marginHorizontal: -spacing.xxl,
    },
    recentSearchesListContent: {
      gap: spacing.md,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.xxl,
    },
    recentSearchCard: {
      flexDirection: 'row',
      backgroundColor: 'rgba(255, 255, 255, 0.75)',
      borderRadius: radius.sm,
      width: 290,
      height: 88,
      alignItems: 'center',
      overflow: 'hidden',
      padding: spacing.sm,
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    recentSearchCardFocused: {
      backgroundColor: '#ffffff',
      transform: [{ scale: 1.05 }],
    },
    recentSearchThumb: {
      width: 72,
      height: 72,
      borderRadius: radius.xs,
      flexShrink: 0,
    },
    recentSearchThumbRound: {
      borderRadius: 36,
    },
    recentSearchInfo: {
      flex: 1,
      paddingVertical: spacing.xs,
      justifyContent: 'center',
    },
    recentSearchName: {
      fontSize: 15,
      fontWeight: '500',
      color: '#000000',
      marginBottom: 1,
    },
    recentSearchSubtitle: {
      fontSize: 13,
      color: 'rgba(0,0,0,0.5)',
    },
  });
}
