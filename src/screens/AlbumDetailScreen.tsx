/**
 * Album detail screen — Apple TV-style two-column layout.
 * Left: metadata + scrollable track list. Right: artwork + action buttons.
 */

import React, { useCallback, useEffect } from 'react';
import {
  BackHandler,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getArtworkUrl } from '../api/apple-music/recommendations';
import { useAlbumDetail } from '../hooks/useAlbumDetail';
import { useTheme } from '../theme';
import { radius, spacing } from '../theme/layout';
import type { PlaylistTrack } from '../types/catalog';

const ARTWORK_SIZE = 300;
const TRACK_THUMB_SIZE = 52;

export type AlbumDetailScreenProps = {
  albumId: string;
  onBack: () => void;
};

export function AlbumDetailScreen({
  albumId,
  onBack,
}: Readonly<AlbumDetailScreenProps>): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const { data, isLoading, error } = useAlbumDetail(albumId);

  // Hardware back button support for Android TV remote
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const album = data?.data?.[0];
  const attrs = album?.attributes;
  const tracks = album?.relationships?.tracks?.data ?? [];

  const artworkUrl = getArtworkUrl(attrs?.artwork?.url, ARTWORK_SIZE, ARTWORK_SIZE);

  const renderTrack = useCallback(
    (renderInfo: { item: PlaylistTrack; index: number }) => (
      <TrackRow item={renderInfo.item} index={renderInfo.index} styles={styles} />
    ),
    [styles],
  );

  let leftContent: React.ReactNode;
  if (isLoading) {
    const LoadingIndicator = require('../components/LoadingIndicator').LoadingIndicator;
    leftContent = <LoadingIndicator />;
  } else if (error) {
    leftContent = (
      <View style={styles.center}>
        <Text style={styles.errorText}>{t('detail.failedToLoadAlbum')}</Text>
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
          <AlbumHeader
            name={attrs?.name}
            artistName={attrs?.artistName}
            releaseDate={attrs?.releaseDate}
            recordLabel={attrs?.recordLabel}
            trackCount={attrs?.trackCount}
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
        <View style={styles.leftPanel}>{leftContent}</View>

        {/* ── Right panel ─────────────────────────────────── */}
        <View style={styles.rightPanel}>
          <View style={styles.artworkContainer}>
            {artworkUrl ? (
              <Image
                source={{ uri: artworkUrl }}
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

function AlbumHeader({
  name,
  artistName,
  releaseDate,
  recordLabel,
  trackCount,
  styles,
}: Readonly<{
  name?: string;
  artistName?: string;
  releaseDate?: string;
  recordLabel?: string;
  trackCount?: number;
  styles: ReturnType<typeof useStyles>;
}>) {
  const { t } = useTranslation();
  const year = releaseDate ? new Date(releaseDate).getFullYear() : null;
  const meta = [year, recordLabel, trackCount == null ? null : t('detail.songsCount', { count: trackCount })]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.headerBlock}>
      <Text style={styles.albumTitle} numberOfLines={2}>
        {name ?? ''}
      </Text>
      {artistName ? (
        <Text style={styles.artistName}>{artistName}</Text>
      ) : null}
      {meta ? (
        <Text style={styles.albumMeta}>{meta}</Text>
      ) : null}
      <View style={styles.divider} />
    </View>
  );
}

function TrackRow({
  item,
  index,
  styles,
}: Readonly<{
  item: PlaylistTrack;
  index: number;
  styles: ReturnType<typeof useStyles>;
}>) {
  const thumbUrl = getArtworkUrl(
    item.attributes?.artwork?.url,
    TRACK_THUMB_SIZE,
    TRACK_THUMB_SIZE,
  );
  const duration = item.attributes?.durationInMillis
    ? formatDuration(item.attributes.durationInMillis)
    : '';

  return (
    <Pressable
      style={({ focused }) => [styles.trackRow, focused && styles.trackRowFocused]}
      focusable>
      <Text style={styles.trackNumber}>{index + 1}</Text>
      <View style={styles.trackThumbContainer}>
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            style={styles.trackThumb}
            resizeMode="cover"
          />
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
      style={({ focused }) => [styles.actionBtn, focused && styles.actionBtnFocused]}
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

// ── Styles ───────────────────────────────────────────────────────

function useStyles(c: {
  textOnDark: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  navBarCardBg: string;
  borderMuted: string;
  buttonSecondaryBg: string;
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
    albumTitle: {
      fontSize: 32,
      fontWeight: '700',
      color: c.textOnDark,
      lineHeight: 38,
      marginBottom: spacing.xs,
    },
    artistName: {
      fontSize: 18,
      fontWeight: '600',
      color: c.accent,
      marginBottom: 4,
    },
    albumMeta: {
      fontSize: 14,
      color: c.textMuted,
      marginBottom: spacing.sm,
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
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
    },
    trackNumber: {
      width: 24,
      textAlign: 'center',
      fontSize: 14,
      color: c.textMuted,
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
      transform: [{ scale: 1.05 }],
    },
    actionBtnIcon: {
      fontSize: 18,
      color: c.textOnDark,
    },
    actionBtnLabel: {
      fontSize: 12,
      color: c.textOnDark,
    },
  });
}
