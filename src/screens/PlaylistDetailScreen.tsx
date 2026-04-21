/**
 * Playlist detail screen — Apple TV-style two-column layout.
 * Left: metadata + scrollable track list. Right: artwork + action buttons.
 */

import React, {useCallback, useEffect} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {getArtworkUrl} from '../api/apple-music/recommendations';
import {usePlaylistDetail} from '../hooks/usePlaylistDetail';
import {usePlayer} from '../hooks/usePlayer';
import {useTheme} from '../theme';
import {radius, spacing} from '../theme/layout';
import type {PlaylistTrack} from '../types/catalog';
import { isVideoTrack, buildVideoQueue, buildSongTracks } from '../utils/trackUtils';

const ARTWORK_SIZE = 300;
const TRACK_THUMB_SIZE = 52;

export type PlaylistDetailScreenProps = {
  playlistId: string;
  onBack: () => void;
};

export function PlaylistDetailScreen({
  playlistId,
  onBack,
}: Readonly<PlaylistDetailScreenProps>): React.JSX.Element {
  const { t } = useTranslation();
  const {colors} = useTheme();
  const styles = useStyles(colors);
  const {data, isLoading, error} = usePlaylistDetail(playlistId);
  const { playPlaylist, playVideoQueue } = usePlayer();

  // Hardware back button support for Android TV remote
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const playlist = data?.data?.[0];
  const attrs = playlist?.attributes;
  const tracks = playlist?.relationships?.tracks?.data ?? [];

  const artworkUrl = getArtworkUrl(attrs?.artwork?.url, ARTWORK_SIZE, ARTWORK_SIZE);

  const formattedDate = attrs?.lastModifiedDate
    ? formatRelativeDate(attrs.lastModifiedDate)
    : null;

  const handleTrackPress = useCallback((item: PlaylistTrack) => {
    if (isVideoTrack(item.type)) {
      playVideoQueue(buildVideoQueue(tracks, item.id));
    } else {
      const { tracks: songTracks, startIndex } = buildSongTracks(tracks, item.id);
      playPlaylist(playlistId, startIndex, false, songTracks);
    }
  }, [tracks, playlistId, playPlaylist, playVideoQueue]);

  const renderTrack = useCallback(
    (renderInfo: {item: PlaylistTrack}) => (
      <TrackRow item={renderInfo.item} styles={styles} onPress={handleTrackPress} />
    ),
    [styles, handleTrackPress],
  );

  let leftContent: React.ReactNode;
  if (isLoading) {
    leftContent = (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  } else if (error) {
    leftContent = (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to load playlist</Text>
      </View>
    );
  } else {
    leftContent = (
      <FlatList
        data={tracks}
        keyExtractor={t => t.id}
        renderItem={renderTrack}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <PlaylistHeader
            name={attrs?.name}
            curatorName={attrs?.curatorName}
            description={attrs?.description?.standard}
            formattedDate={formattedDate}
            styles={styles}
          />
        }
        contentContainerStyle={styles.trackListContent}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        {/* ── Left panel ──────────────────────────────────── */}
        <View style={styles.leftPanel}>
          {leftContent}
        </View>

        {/* ── Right panel ─────────────────────────────────── */}
        <View style={styles.rightPanel}>
          <View style={styles.artworkContainer}>
            {artworkUrl ? (
              <Image
                source={{uri: artworkUrl}}
                style={styles.artwork}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.artwork, styles.artworkPlaceholder]} />
            )}
          </View>

          <View style={styles.actionRow}>
            <ActionButton label={t('detail.add')} icon="+" styles={styles} />
            <ActionButton label={t('detail.shuffle')} icon="⇌" styles={styles} />
            <ActionButton label={t('detail.more')} icon="•••" styles={styles} />
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function PlaylistHeader({
  name,
  curatorName,
  description,
  formattedDate,
  styles,
}: Readonly<{
  name?: string;
  curatorName?: string;
  description?: string;
  formattedDate: string | null;
  styles: ReturnType<typeof useStyles>;
}>) {
  const { t } = useTranslation();
  return (
    <View style={styles.headerBlock}>
      <Text style={styles.playlistTitle} numberOfLines={2}>
        {name ?? ''}
      </Text>
      {curatorName ? (
        <Text style={styles.curatorName}>{t('detail.playlistBy', { curator: curatorName })}</Text>
      ) : null}
      {formattedDate ? (
        <Text style={styles.updatedDate}>{t('detail.updated', { date: formattedDate })}</Text>
      ) : null}
      {description ? (
        <Text style={styles.description} numberOfLines={3}>
          {description}
        </Text>
      ) : null}
      <View style={styles.divider} />
    </View>
  );
}

function TrackRow({
  item,
  styles,
  onPress,
}: Readonly<{
  item: PlaylistTrack;
  styles: ReturnType<typeof useStyles>;
  onPress: (item: PlaylistTrack) => void;
}>) {
  const thumbUrl = getArtworkUrl(item.attributes?.artwork?.url, TRACK_THUMB_SIZE, TRACK_THUMB_SIZE);
  const duration = item.attributes?.durationInMillis
    ? formatDuration(item.attributes.durationInMillis)
    : '';

  return (
    <Pressable
      style={({focused}) => [
        styles.trackRow,
        focused && styles.trackRowFocused,
      ]}
      onPress={() => onPress(item)}
      focusable>
      <View style={styles.trackThumbContainer}>
        {thumbUrl ? (
          <Image source={{uri: thumbUrl}} style={styles.trackThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.trackThumb, styles.trackThumbPlaceholder]} />
        )}
      </View>
      <View style={styles.trackInfo}>
        <Text style={styles.trackName} numberOfLines={1}>
          {item.attributes?.name ?? ''}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {item.attributes?.artistName ?? ''}
        </Text>
      </View>
      <Text style={styles.trackDuration}>{duration}</Text>
    </Pressable>
  );
}

function ActionButton({
  label,
  icon,
  styles,
}: Readonly<{
  label: string;
  icon: string;
  styles: ReturnType<typeof useStyles>;
}>) {
  return (
    <Pressable
      style={({focused}) => [styles.actionBtn, focused && styles.actionBtnFocused]}
      focusable>
      <Text style={styles.actionBtnIcon}>{icon}</Text>
      <Text style={styles.actionBtnLabel}>{label}</Text>
    </Pressable>
  );
}

// ── Helpers ──────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatRelativeDate(isoDate: string): string {
  const { t } = require('i18next');
  const date = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t('detail.today');
  if (diffDays === 1) return t('detail.yesterday');
  if (diffDays < 7) return t('detail.daysAgo', { count: diffDays });
  return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
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
  glassCardBg: string;
}) {
  return StyleSheet.create({
    root: {
      flex: 1,
      padding: spacing.xl,
    },
    body: {
      flex: 1,
      flexDirection: 'row',
      paddingHorizontal: spacing.xl,
      gap: spacing.xxl,
    },
    // ── Left panel ───────────────────────
    leftPanel: {
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
      paddingBottom: spacing.xxxl,
    },
    // ── Header ───────────────────────────
    headerBlock: {
      marginBottom: spacing.md,
    },
    playlistTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: c.textOnDark,
      lineHeight: 38,
      marginBottom: spacing.xs,
    },
    curatorName: {
      fontSize: 16,
      color: c.textSubtle,
      fontWeight: '500',
      marginBottom: 2,
    },
    updatedDate: {
      fontSize: 14,
      color: c.textMuted,
      marginBottom: spacing.sm,
    },
    description: {
      fontSize: 14,
      color: c.textMuted,
      lineHeight: 20,
      marginBottom: spacing.md,
    },
    divider: {
      height: 1,
      backgroundColor: c.borderMuted,
      marginBottom: spacing.xs,
    },
    // ── Track row ────────────────────────
    trackRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.sm,
      gap: spacing.md,
    },
    trackRowFocused: {
      backgroundColor: c.glassCardBg,
    },
    trackThumbContainer: {
      width: TRACK_THUMB_SIZE,
      height: TRACK_THUMB_SIZE,
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
    trackArtist: {
      fontSize: 13,
      color: c.textMuted,
      marginTop: 2,
    },
    trackDuration: {
      fontSize: 14,
      color: c.textMuted,
      minWidth: 38,
      textAlign: 'right',
    },
    // ── Right panel ──────────────────────
    rightPanel: {
      width: ARTWORK_SIZE,
      alignItems: 'center',
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
      backgroundColor: c.navBarCardBg,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: c.buttonSecondaryBg,
      gap: 4,
    },
    actionBtnFocused: {
      backgroundColor: c.navBarCardBg,
      transform: [{scale: 1.05}],
    },
    actionBtnIcon: {
      fontSize: 18,
      color: c.textOnDark,
      fontWeight: '600',
    },
    actionBtnLabel: {
      fontSize: 12,
      color: c.textMuted,
    },
  });
}
