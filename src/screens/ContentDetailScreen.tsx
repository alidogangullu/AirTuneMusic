/**
 * Unified content detail screen — playlists, albums, and stations.
 * Two-column Apple TV layout: left = metadata + track list, right = artwork + actions.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getArtworkUrl } from '../api/apple-music/recommendations';
import { useContentDetail } from '../hooks/useContentDetail';
import { NowPlayingBars } from '../components/NowPlayingBars';
import { usePlayer } from '../hooks/usePlayer';
import { useContentNavigation } from '../navigation';
import i18n from '../i18n';
import { formatDuration, formatRelativeDate } from '../utils/dateUtils';
import { useTheme } from '../theme';
import { radius, spacing } from '../theme/layout';
import type {
  AlbumDetail,
  ContentDetailItem,
  MusicVideoDetail,
  PlaylistDetail,
  PlaylistTrack,
  SongDetail,
  StationDetail,
} from '../types/catalog';
import type { RecommendationContentType } from '../types/recommendations';

const ARTWORK_SIZE = 350;

/**
 * Extract the catalog song ID from a track.
 * For library tracks we check: playParams.catalogId → catalog relationship → playParams.id.
 * Falls back to track.id (which may be a library ID — won't play but avoids crash).
 */
function getCatalogSongId(track: PlaylistTrack): string {
  return (
    track.attributes?.playParams?.catalogId ??
    track.relationships?.catalog?.data?.[0]?.id ??
    track.attributes?.playParams?.id ??
    track.id
  );
}

/** Convert API PlaylistTrack to the TrackInfo shape used by the player state. */
function toTrackInfo(track: PlaylistTrack): import('../services/musicPlayer').TrackInfo {
  const THUMB = 200;
  return {
    id: getCatalogSongId(track),
    title: track.attributes?.name ?? null,
    artistName: track.attributes?.artistName ?? null,
    albumTitle: track.attributes?.albumName ?? null,
    artworkUrl: getArtworkUrl(track.attributes?.artwork?.url, THUMB, THUMB) ?? null,
    duration: track.attributes?.durationInMillis ?? 0,
    trackIndex: 0, // will be overridden by SDK on playback
  };
}

export type ContentDetailScreenProps = {
  contentId: string;
  contentType: RecommendationContentType;
  onBack: () => void;
};

// ── Normalized shape ─────────────────────────────────────────────

type NormalizedDetail = {
  name?: string;
  subtitle?: string;
  meta?: string;
  description?: string;
  artworkUrl?: string;
  tracks: PlaylistTrack[];
  kind: 'tracklist' | 'single' | 'video' | 'radio';
  duration?: string;
  genres?: string[];
};

function normalizePlaylists(item: PlaylistDetail): NormalizedDetail {
  const t = i18n.t.bind(i18n);
  const attrs = item.attributes;
  const formattedDate = attrs?.lastModifiedDate
    ? formatRelativeDate(attrs.lastModifiedDate)
    : null;
  return {
    name: attrs?.name,
    subtitle: attrs?.curatorName ? t('detail.playlistBy', { curator: attrs.curatorName }) : undefined,
    meta: formattedDate ? t('detail.updated', { date: formattedDate }) : undefined,
    description: attrs?.description?.standard,
    artworkUrl: getArtworkUrl(attrs?.artwork?.url, ARTWORK_SIZE, ARTWORK_SIZE),
    tracks: (item.relationships?.tracks?.data ?? []).filter(track => track.type !== 'music-videos' && track.type !== 'library-music-videos'),
    kind: 'tracklist',
  };
}

function normalizeAlbum(item: AlbumDetail): NormalizedDetail {
  const t = i18n.t.bind(i18n);
  const attrs = item.attributes;
  const year = attrs?.releaseDate ? new Date(attrs.releaseDate).getFullYear() : null;
  const metaParts = [
    year,
    attrs?.recordLabel,
    attrs?.trackCount == null ? null : t('detail.songsCount', { count: attrs.trackCount }),
  ].filter(Boolean);
  return {
    name: attrs?.name,
    subtitle: attrs?.artistName,
    meta: metaParts.join(' · '),
    artworkUrl: getArtworkUrl(attrs?.artwork?.url, ARTWORK_SIZE, ARTWORK_SIZE),
    tracks: (item.relationships?.tracks?.data ?? []).filter(track => track.type !== 'music-videos' && track.type !== 'library-music-videos'),
    kind: 'tracklist',
  };
}

function normalizeSong(item: SongDetail): NormalizedDetail {
  const attrs = item.attributes;
  const year = attrs?.releaseDate ? new Date(attrs.releaseDate).getFullYear() : null;
  return {
    name: attrs?.name,
    subtitle: attrs?.artistName,
    meta: [year, attrs?.albumName].filter(Boolean).join(' · '),
    artworkUrl: getArtworkUrl(attrs?.artwork?.url, ARTWORK_SIZE, ARTWORK_SIZE),
    tracks: [],
    kind: 'single',
    duration: attrs?.durationInMillis ? formatDuration(attrs.durationInMillis) : undefined,
    genres: attrs?.genreNames,
  };
}

function normalizeMusicVideo(item: MusicVideoDetail): NormalizedDetail {
  const attrs = item.attributes;
  const year = attrs?.releaseDate ? new Date(attrs.releaseDate).getFullYear() : null;
  const badges = [attrs?.has4K ? '4K' : null, attrs?.hasHDR ? 'HDR' : null].filter(Boolean);
  return {
    name: attrs?.name,
    subtitle: attrs?.artistName,
    meta: [year, ...badges].filter(Boolean).join(' · '),
    artworkUrl: getArtworkUrl(attrs?.artwork?.url, ARTWORK_SIZE, ARTWORK_SIZE),
    tracks: [],
    kind: 'video',
    duration: attrs?.durationInMillis ? formatDuration(attrs.durationInMillis) : undefined,
    genres: attrs?.genreNames,
  };
}

function normalizeStation(item: StationDetail): NormalizedDetail {
  const t = i18n.t.bind(i18n);
  const attrs = item.attributes;
  return {
    name: attrs?.name,
    subtitle: t('detail.radioStation'),
    meta: attrs?.isLive ? t('detail.live') : t('detail.onDemand'),
    artworkUrl: getArtworkUrl(attrs?.artwork?.url, ARTWORK_SIZE, ARTWORK_SIZE),
    tracks: [],
    kind: 'radio',
  };
}

const normalizers: {
  [K in RecommendationContentType]?: (item: ContentDetailItem) => NormalizedDetail;
} = {
  playlists: i => normalizePlaylists(i as PlaylistDetail),
  albums: i => normalizeAlbum(i as AlbumDetail),
  songs: i => normalizeSong(i as SongDetail),
  'music-videos': i => normalizeMusicVideo(i as MusicVideoDetail),
  stations: i => normalizeStation(i as StationDetail),
};

function normalizeDetail(
  item: ContentDetailItem | undefined,
  contentType: RecommendationContentType,
): NormalizedDetail {
  if (!item) {
    return { tracks: [], kind: 'tracklist' };
  }
  const fn = normalizers[contentType];
  return fn ? fn(item) : { tracks: [], kind: 'tracklist' };
}

// ── Main component ───────────────────────────────────────────────

export function ContentDetailScreen({
  contentId,
  contentType,
  onBack,
}: Readonly<ContentDetailScreenProps>): React.JSX.Element {
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const { data, isLoading, error } = useContentDetail(contentId, contentType);
  const {
    state: playerState,
    playAlbum,
    playPlaylist,
    playStation,
    playSong,
    playMusicVideo,
  } = usePlayer();

  const { openNowPlayingFullscreen } = useContentNavigation();

  const isPlaying = playerState.playbackState === 'playing';
  const isPaused = playerState.playbackState === 'paused';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const item = data?.data?.[0];
  const normalized = normalizeDetail(item, contentType);

  const handlePlay = useCallback(() => {
    const action = async () => {
      let success = false;
      const trackInfos = normalized.tracks.map(toTrackInfo);
      switch (contentType) {
        case 'albums':
          success = await playAlbum(contentId, 0, false, trackInfos);
          break;
        case 'playlists':
          success = await playPlaylist(contentId, 0, false, trackInfos);
          break;
        case 'stations':
          success = await playStation(contentId);
          break;
        case 'songs':
          success = await playSong(contentId);
          break;
        case 'music-videos':
          success = await playMusicVideo(contentId);
          break;
      }
      if (success) {
        openNowPlayingFullscreen();
      }
    };
    action().catch(e => console.warn('[Play]', e));
  }, [contentId, contentType, normalized.tracks, playAlbum, playPlaylist, playStation, playSong, playMusicVideo, openNowPlayingFullscreen]);

  const handleShuffle = useCallback(() => {
    const action = async () => {
      let success = false;
      const trackInfos = normalized.tracks.map(toTrackInfo);
      switch (contentType) {
        case 'albums':
          success = await playAlbum(contentId, 0, true, trackInfos);
          break;
        case 'playlists':
          success = await playPlaylist(contentId, 0, true, trackInfos);
          break;
        default:
          // This is effectively play
          success = await (async () => {
            switch (contentType) {
              case 'stations': return playStation(contentId);
              case 'songs': return playSong(contentId);
              case 'music-videos': return playMusicVideo(contentId);
              default: return false;
            }
          })();
      }
      if (success) {
        openNowPlayingFullscreen();
      }
    };
    action().catch(e => console.warn('[Shuffle]', e));
  }, [contentId, contentType, normalized.tracks, playAlbum, playPlaylist, playSong, playStation, playMusicVideo, openNowPlayingFullscreen]);

  // Check if a track matches the currently playing item by comparing
  // title + artist (robust for both library and catalog content).
  const isTrackNowPlaying = useCallback(
    (track: PlaylistTrack): boolean => {
      if (!(isPlaying || isPaused)) { return false; }
      const currentTrack = playerState.track;
      if (!currentTrack) { return false; }

      // Fast path: Exact ID match
      const trackId = getCatalogSongId(track);
      if (currentTrack.id && trackId === currentTrack.id) {
        return true;
      }

      // Fallback: compare track title + artist name
      const trackName = track.attributes?.name;
      const trackArtist = track.attributes?.artistName;
      if (trackName && currentTrack.title && trackName === currentTrack.title) {
        // If both have artist info, also compare that to avoid false matches
        if (trackArtist && currentTrack.artistName) {
          return trackArtist === currentTrack.artistName;
        }
        return true;
      }

      return false;
    },
    [isPlaying, isPaused, playerState.track],
  );

  const handleTrackPress = useCallback(
    (index: number) => {
      const track = normalized.tracks[index];
      if (!track) return;

      // If this track is already now playing, just open the fullscreen player
      if (isTrackNowPlaying(track)) {
        openNowPlayingFullscreen();
        return;
      }

      const action = async () => {
        let success = false;
        switch (contentType) {
          case 'albums':
            success = await playAlbum(contentId, index, false, normalized.tracks.map(toTrackInfo));
            break;
          case 'playlists':
            success = await playPlaylist(contentId, index, false, normalized.tracks.map(toTrackInfo));
            break;
          case 'songs':
          case 'music-videos':
          case 'stations':
            // Individual items or library songs without container
            success = await playSong(getCatalogSongId(track));
            break;
        }
        if (success) {
          openNowPlayingFullscreen();
        }
      };
      action().catch(e => console.warn('[TrackPress]', e));
    },
    [contentId, contentType, normalized.tracks, playAlbum, playPlaylist, playSong, openNowPlayingFullscreen, isTrackNowPlaying],
  );

  const renderTrack = useCallback(
    (renderInfo: { item: PlaylistTrack; index: number }) => (
      <TrackRow
        item={renderInfo.item}
        index={renderInfo.index}
        showArtist={contentType === 'playlists'}
        showThumb={contentType === 'playlists'}
        onPress={() => handleTrackPress(renderInfo.index)}
        isNowPlaying={isTrackNowPlaying(renderInfo.item)}
        isPlaying={isPlaying}
        styles={styles}
      />
    ),
    [styles, contentType, handleTrackPress, isPlaying, isTrackNowPlaying],
  );

  let rightContent: React.ReactNode;
  if (isLoading) {
    const LoadingIndicator = require('../components/LoadingIndicator').LoadingIndicator;
    rightContent = <LoadingIndicator />;
  } else if (error) {
    rightContent = (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load content</Text>
      </View>
    );
  } else if (normalized.kind === 'tracklist') {
    rightContent = (
      <FlatList
        data={normalized.tracks}
        keyExtractor={t => t.id}
        renderItem={renderTrack}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <ContentHeader
            normalized={normalized}
            contentType={contentType}
            onPlay={handlePlay}
            onShuffle={handleShuffle}
            styles={styles}
          />
        }
        contentContainerStyle={styles.trackListContent}
      />
    );
  } else {
    rightContent = (
      <ScrollView showsVerticalScrollIndicator={false}>
        <ContentHeader
          normalized={normalized}
          contentType={contentType}
          onPlay={handlePlay}
          onShuffle={handleShuffle}
          styles={styles}
        />
        <View style={styles.headerBlock}>
          {normalized.duration ? (
            <Text style={styles.singleDetail}>{normalized.duration}</Text>
          ) : null}
          {normalized.genres && normalized.genres.length > 0 ? (
            <Text style={styles.metaText}>{normalized.genres.join(' · ')}</Text>
          ) : null}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Artwork (left) ───────────────────────────────── */}
      <View style={styles.artworkPanel}>
        <View style={styles.artworkContainer}>
          {normalized.artworkUrl ? (
            <Image
              source={{ uri: normalized.artworkUrl }}
              style={styles.artwork}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.artwork, styles.artworkPlaceholder]} />
          )}
        </View>
      </View>

      {/* ── Content (right) ──────────────────────────────── */}
      <View style={styles.contentPanel}>
        {rightContent}
      </View>
    </View>
  );
}

function subtitleStyle(
  contentType: RecommendationContentType,
  styles: ReturnType<typeof useStyles>,
) {
  if (contentType === 'songs') { return styles.subtitleAccent; }
  if (contentType === 'albums') { return styles.subtitleArtist; }
  return styles.subtitleMuted;
}

// ── Sub-components ───────────────────────────────────────────────

function ContentHeader({
  normalized,
  contentType,
  onPlay,
  onShuffle,
  styles,
}: Readonly<{
  normalized: NormalizedDetail;
  contentType: RecommendationContentType;
  onPlay: () => void;
  onShuffle: () => void;
  styles: ReturnType<typeof useStyles>;
}>) {
  const { t } = useTranslation();
  const showShuffle = normalized.kind === 'tracklist';

  return (
    <View style={styles.headerBlock}>
      <Text style={styles.contentTitle} numberOfLines={2}>
        {normalized.name ?? ''}
      </Text>
      {normalized.subtitle ? (
        <Text
          style={subtitleStyle(contentType, styles)}>
          {normalized.subtitle}
        </Text>
      ) : null}
      {normalized.meta ? (
        <Text style={styles.metaText}>{normalized.meta}</Text>
      ) : null}
      {normalized.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {normalized.description}
        </Text>
      ) : null}

      {/* [Play] [Shuffle?]        [•••] */}
      <View style={styles.actionRow}>
        <ActionButton icon="▶" label={t('detail.play')} grabFocus onPress={onPlay} styles={styles} />
        {showShuffle ? (
          <ActionButton icon="⇌" label={t('detail.shuffle')} onPress={onShuffle} styles={styles} />
        ) : null}
        <View style={styles.actionSpacer} />
        <MoreButton styles={styles} />
      </View>
    </View>
  );
}

function TrackRow({
  item,
  index,
  showArtist,
  showThumb,
  onPress,
  isNowPlaying,
  isPlaying,
  styles,
}: Readonly<{
  item: PlaylistTrack;
  index: number;
  showArtist: boolean;
  showThumb: boolean;
  onPress: () => void;
  isNowPlaying: boolean;
  isPlaying: boolean;
  styles: ReturnType<typeof useStyles>;
}>) {
  const [focused, setFocused] = useState(false);
  const THUMB = 52;
  const thumbUrl = showThumb
    ? getArtworkUrl(item.attributes?.artwork?.url, THUMB, THUMB)
    : undefined;
  const duration = item.attributes?.durationInMillis
    ? formatDuration(item.attributes.durationInMillis)
    : '';

  const prefixContent = () => {
    if (isNowPlaying && !focused) {
      return (
        <View style={styles.trackPrefixBars}>
          <NowPlayingBars playing={isPlaying} size={14} />
        </View>
      );
    }
    return (
      <Text style={[styles.trackPrefix, focused && styles.trackPrefixFocused]}>
        {focused ? '▶' : String(index + 1)}
      </Text>
    );
  };

  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={onPress}
      style={[styles.trackRow, focused && styles.trackRowFocused]}
      focusable>
      {showThumb ? (
        <View style={styles.trackThumbContainer}>
          {thumbUrl ? (
            <Image source={{ uri: thumbUrl }} style={styles.trackThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.trackThumb, styles.trackThumbPlaceholder]} />
          )}
        </View>
      ) : (
        prefixContent()
      )}
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
        {showArtist ? (
          <Text style={styles.trackArtist} numberOfLines={1}>
            {item.attributes?.artistName ?? ''}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.trackDuration, focused && styles.trackDurationFocused]}>
        {duration}
      </Text>
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  grabFocus,
  onPress,
  styles,
}: Readonly<{
  icon: string;
  label: string;
  grabFocus?: boolean;
  onPress?: () => void;
  styles: ReturnType<typeof useStyles>;
}>) {
  return (
    <Pressable
      style={({ focused }) => [styles.actionBtn, focused && styles.actionBtnFocused]}
      hasTVPreferredFocus={grabFocus}
      onPress={onPress}
      focusable>
      <Text style={styles.actionBtnText}>{icon}  {label}</Text>
    </Pressable>
  );
}

function MoreButton({
  styles,
}: Readonly<{ styles: ReturnType<typeof useStyles> }>) {
  return (
    <Pressable
      style={({ focused }) => [styles.moreBtn, focused && styles.moreBtnFocused]}
      focusable>
      <Text style={styles.moreBtnText}>•••</Text>
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
  buttonFocusedBg: string;
  borderMuted: string;
  buttonSecondaryBg: string;
  settingsCardBg: string;
  subtleBg: string;
  glassBg: string;
  glassCardBgStrong: string;
}) {
  return StyleSheet.create({
    // ── Root ──────────────────────────────────────────
    root: {
      flex: 1,
      flexDirection: 'row',
      paddingTop: spacing.xl,
      paddingLeft: spacing.xl,
    },
    // ── Artwork panel (left) ──────────────────────────
    artworkPanel: {
      width: ARTWORK_SIZE,
      flexShrink: 0,
      paddingTop: spacing.xs,
    },
    artworkContainer: {
      width: ARTWORK_SIZE,
      height: ARTWORK_SIZE,
      borderRadius: radius.lg,
      overflow: 'hidden',
      backgroundColor: c.navBarCardBg,
    },
    artwork: {
      width: '100%',
      height: '100%',
    },
    artworkPlaceholder: {
      backgroundColor: c.subtleBg,
    },
    // ── Content panel (right) ─────────────────────────
    contentPanel: {
      flex: 1,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      color: c.textMuted,
      fontSize: 16,
    },
    trackListContent: {
      paddingBottom: 0,
      paddingTop: 0,
    },
    // ── Header ────────────────────────────────────────
    headerBlock: {
      marginBottom: spacing.xs,
      marginHorizontal: spacing.xxl,
    },
    contentTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: c.textOnDark,
      lineHeight: 34,
    },
    subtitleAccent: {
      fontSize: 20,
      fontWeight: '600',
      color: c.accent,
      marginBottom: 4,
    },
    subtitleArtist: {
      fontSize: 20,
      fontWeight: '600',
      color: c.textOnDark,
      marginBottom: 4,
    },
    subtitleMuted: {
      fontSize: 16,
      color: c.textSubtle,
      fontWeight: '500',
      marginBottom: 4,
    },
    metaText: {
      fontSize: 14,
      color: c.textMuted,
      marginBottom: spacing.xs,
    },
    description: {
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
      marginBottom: spacing.sm,
    },
    singleDetail: {
      fontSize: 15,
      color: c.textOnDark,
      marginBottom: spacing.xs,
    },
    // ── Action row ────────────────────────────────────
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      marginBottom: spacing.md,
    },
    actionSpacer: {
      flex: 1,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: c.glassBg,
    },
    actionBtnFocused: {
      backgroundColor: c.buttonFocusedBg,
      transform: [{ scale: 1.05 }],
    },
    actionBtnText: {
      fontSize: 15,
      fontWeight: '600',
      color: c.textOnDark,
    },
    moreBtn: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.glassBg,
    },
    moreBtnFocused: {
      backgroundColor: c.glassCardBgStrong,
      transform: [{ scale: 1.05 }],
    },
    moreBtnText: {
      fontSize: 16,
      color: c.textOnDark,
    },
    // ── Divider ───────────────────────────────────────
    divider: {
      height: 1,
      backgroundColor: c.borderMuted,
      marginBottom: spacing.xs,
    },
    // ── Track row ─────────────────────────────────────
    trackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      gap: spacing.md,
      marginHorizontal: spacing.xxl,
    },
    trackRowFocused: {
      backgroundColor: c.glassCardBgStrong,
    },
    trackPrefix: {
      width: 28,
      textAlign: 'center',
      fontSize: 14,
      color: c.textMuted,
    },
    trackPrefixBars: {
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trackPrefixFocused: {
      color: c.textOnDark,
      fontWeight: '600',
    },
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
    trackInfo: {
      flex: 1,
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
      marginTop: 2,
    },
    trackDuration: {
      fontSize: 14,
      color: c.textMuted,
      minWidth: 40,
      textAlign: 'right',
    },
    trackDurationFocused: {
      color: c.textOnDark,
    },
  });
}
