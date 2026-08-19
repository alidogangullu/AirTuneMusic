import React, { useMemo, useCallback, useEffect } from 'react';
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
import { getArtworkUrl } from '../recommendations/api/recommendations';
import { MotionArtworkCover } from '../../components/MotionArtworkCover';
import { formatFullDate } from './utils/dateUtils';
import { useArtistDetail } from './hooks/useArtistDetail';
import { usePlayer } from '../player/hooks/usePlayer';
import { useContentNavigation } from '../home/navigation';
import { useTheme } from '../../theme';
import { spacing } from '../../theme/layout';
import type { AlbumDetail, MusicVideoDetail, SongDetail } from '../../types/catalog';
import Svg, { Path } from 'react-native-svg';

export type ArtistDetailScreenProps = {
  artistId: string;
  onBack: () => void;
};

function toTrackInfoFromSong(song: SongDetail): import('../player/musicPlayer').TrackInfo {
  const THUMB = 200;
  const attrs = song.attributes;
  return {
    id: attrs?.playParams?.id ?? song.id,
    title: attrs?.name ?? null,
    artistName: attrs?.artistName ?? null,
    albumTitle: attrs?.albumName ?? null,
    artworkUrl: getArtworkUrl(attrs?.artwork?.url, THUMB, THUMB) ?? null,
    duration: attrs?.durationInMillis ?? 0,
    trackIndex: 0,
  };
}

export function ArtistDetailScreen({
  artistId,
  onBack,
}: Readonly<ArtistDetailScreenProps>): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const { data, isLoading, error } = useArtistDetail(artistId);

  const { playSong, playStation } = usePlayer();
  const { openNowPlayingFullscreen, pushContent } = useContentNavigation();

  // Hardware back button support for Android TV remote
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const artist = data?.data?.[0];
  const attrs = artist?.attributes;
  const stationId = artist?.relationships?.station?.data?.[0]?.id;
  const topSongs = React.useMemo(() => artist?.views?.['top-songs']?.data ?? [], [artist]);
  const latestRelease = artist?.views?.['latest-release']?.data?.[0];
  const essentialAlbums = artist?.views?.['full-albums']?.data ?? [];
  const musicVideos = artist?.views?.['top-music-videos']?.data ?? [];

  const handlePlayArtist = useCallback(() => {
    if (topSongs.length > 0) {
      const firstSong = topSongs[0];
      if (firstSong) {
        const songId = firstSong.attributes?.playParams?.id ?? firstSong.id;
        const allTopSongsInfo = topSongs.map(toTrackInfoFromSong);
        playSong(songId, allTopSongsInfo[0], allTopSongsInfo, 0).catch(console.warn);
        openNowPlayingFullscreen();
      }
    }
  }, [topSongs, playSong, openNowPlayingFullscreen]);

  const handlePlayStation = useCallback(() => {
    if (stationId) {
      playStation(stationId).then((success) => {
        if (success) {
          openNowPlayingFullscreen();
        }
      }).catch(console.warn);
    }
  }, [stationId, playStation, openNowPlayingFullscreen]);

  const handleTrackPress = useCallback((song: SongDetail) => {
    const songId = song.attributes?.playParams?.id ?? song.id;
    const trackInfo = toTrackInfoFromSong(song);
    const songIndex = topSongs.findIndex(s => s.id === song.id);
    const allTopSongsInfo = topSongs.map(toTrackInfoFromSong);
    playSong(
      songId,
      trackInfo,
      allTopSongsInfo.length > 0 ? allTopSongsInfo : [trackInfo],
      songIndex >= 0 ? songIndex : 0,
    ).catch(console.warn);
    openNowPlayingFullscreen();
  }, [topSongs, playSong, openNowPlayingFullscreen]);

  const handleAlbumPress = useCallback((album: AlbumDetail) => {
    pushContent({
      id: album.id,
      type: 'albums',
      attributes: {
        name: album.attributes?.name,
        artistName: album.attributes?.artistName,
        artwork: album.attributes?.artwork ? { url: album.attributes.artwork.url } : undefined,
      },
    });
  }, [pushContent]);

  const handleVideoPress = useCallback((video: MusicVideoDetail) => {
    pushContent({
      id: video.id,
      type: 'music-videos',
      attributes: {
        name: video.attributes?.name,
        artistName: video.attributes?.artistName,
        artwork: video.attributes?.artwork ? { url: video.attributes.artwork.url } : undefined,
      },
    });
  }, [pushContent]);

  if (isLoading) {
    const LoadingIndicator = require('../../components/LoadingIndicator').LoadingIndicator;
    return <LoadingIndicator />;
  }

  if (error || !artist) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.errorText}>{t('artist.failedToLoad')}</Text>
      </View>
    );
  }

  // Split top songs into chunks of 2 for the 2-row layout
  const topSongsChunks: SongDetail[][] = [];
  for (let i = 0; i < topSongs.length; i += 2) {
    topSongsChunks.push(topSongs.slice(i, i + 2));
  }

  return (
      <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
        {/* ── Header ──────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            style={({ focused }) => [styles.playButton, focused && styles.playButtonFocused]}
            onPress={handlePlayArtist}
            focusable>
            <View style={styles.playButtonIcon} />
          </Pressable>
          {stationId && (
            <Pressable
              style={({ focused }) => [styles.actionBtn, focused && styles.actionBtnFocused]}
              onPress={handlePlayStation}
              focusable>
              <RadioIcon color={colors.textOnDark} size={20} />
              <Text style={styles.actionBtnText}>{t('artist.createStation')}</Text>
            </Pressable>
          )}
          <Text style={styles.artistNameTitle}>{attrs?.name}</Text>
        </View>

        {/* ── Top Row (Latest Release + Top Songs) ────────── */}
        <View style={styles.topRow}>
          {latestRelease && (
            <View style={styles.latestReleaseSection}>
              <Text style={styles.sectionTitle}>{t('artist.latestRelease')}</Text>
              <LatestReleaseCard
                album={latestRelease}
                onPress={() => handleAlbumPress(latestRelease)}
                styles={styles}
              />
            </View>
          )}

          <View style={styles.topSongsSection}>
            <Text style={styles.sectionTitle}>{t('artist.topSongs')}</Text>
            <FlatList
              horizontal
              data={topSongsChunks}
              keyExtractor={(_, index) => `chunk-${index}`}
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={styles.topSongsList}
              renderItem={({ item: chunk }) => (
                <View style={styles.topSongsColumn}>
                  {chunk.map(song => (
                    <TopSongCard
                      key={song.id}
                      song={song}
                      onPress={() => handleTrackPress(song)}
                      styles={styles}
                    />
                  ))}
                </View>
              )}
            />
          </View>
        </View>

        {/* ── Essential Albums ────────────────────────────── */}
        {essentialAlbums.length > 0 && (
          <View style={styles.albumsSection}>
            <Text style={styles.sectionTitle}>{t('artist.essentialAlbums')}</Text>
            <FlatList
              horizontal
              data={essentialAlbums}
              keyExtractor={a => a.id}
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={styles.albumsList}
              renderItem={({ item: album }) => (
                <EssentialAlbumCard
                  album={album}
                  onPress={() => handleAlbumPress(album)}
                  styles={styles}
                />
              )}
            />
          </View>
        )}

        {/* ── Music Videos ────────────────────────────────── */}
        {musicVideos.length > 0 && (
          <View style={styles.albumsSection}>
            <Text style={styles.sectionTitle}>{t('artist.musicVideos')}</Text>
            <FlatList
              horizontal
              data={musicVideos}
              keyExtractor={v => v.id}
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              contentContainerStyle={styles.albumsList}
              renderItem={({ item: video }) => (
                <MusicVideoCard
                  video={video}
                  onPress={() => handleVideoPress(video)}
                  styles={styles}
                />
              )}
            />
          </View>
        )}
      </ScrollView>
  );
}

// ── Sub-components ───────────────────────────────────────────────

function RadioIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7 18C10.3137 18 13 15.3137 13 12C13 8.68629 10.3137 6 7 6C3.68629 6 1 8.68629 1 12C1 15.3137 3.68629 18 7 18ZM8 9V11H10V13H8V15H6V13H4V11H6V9H8Z"
        fill={color}
      />
      <Path
        d="M15.5 8.5C16.8 9.4 17.5 10.6 17.5 12C17.5 13.4 16.8 14.6 15.5 15.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M18.5 5.5C20.8 7.2 22.5 9.5 22.5 12C22.5 14.5 20.8 16.8 18.5 18.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function LatestReleaseCard({
  album,
  onPress,
  styles,
}: Readonly<{
  album: AlbumDetail;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
}>) {
  const { t } = useTranslation();
  const artworkUrl = getArtworkUrl(
    album.attributes?.artwork?.url,
    300,
    300,
  );

  const releaseDate = album.attributes?.releaseDate
    ? formatFullDate(album.attributes.releaseDate).toUpperCase()
    : '';

  return (
    <Pressable
      style={({ focused }) => [styles.latestReleaseCard, focused && styles.cardFocused]}
      onPress={onPress}
      focusable>
      {({ focused }) => (
      <>
      <View style={styles.latestReleaseArtworkContainer}>
        <MotionArtworkCover
          contentType="albums"
          contentId={album.id}
          artworkUrl={artworkUrl ?? undefined}
          focused={focused}
          width={152}
          height={152}
        />
      </View>
      <View style={styles.latestReleaseInfo}>
        <Text style={styles.latestReleaseDate}>{releaseDate}</Text>
        <Text style={styles.latestReleaseName} numberOfLines={2}>{album.attributes?.name}</Text>
        <Text style={styles.latestReleaseMeta}>
          {album.attributes?.isSingle ? t('artist.single') : t('artist.album')} · {t('detail.songsCount', { count: album.attributes?.trackCount })}
        </Text>
      </View>
      </>
      )}
    </Pressable>
  );
}

function TopSongCard({
  song,
  onPress,
  styles,
}: Readonly<{
  song: SongDetail;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
}>) {
  const artworkUrl = getArtworkUrl(
    song.attributes?.artwork?.url,
    100,
    100,
  );

  const year = song.attributes?.releaseDate ? new Date(song.attributes.releaseDate).getFullYear() : '';
  const meta = [song.attributes?.albumName, year].filter(Boolean).join(' · ');

  return (
    <Pressable
      style={({ focused }) => [styles.topSongCard, focused && styles.cardFocused]}
      onPress={onPress}
      focusable>
      <View style={styles.topSongArtworkContainer}>
        {artworkUrl ? (
          <Image source={{ uri: artworkUrl }} style={styles.topSongArtwork} resizeMode="cover" />
        ) : (
          <View style={[styles.topSongArtwork, styles.placeholderBg]} />
        )}
      </View>
      <View style={styles.topSongInfo}>
        <Text style={styles.topSongName} numberOfLines={1}>{song.attributes?.name}</Text>
        <Text style={styles.topSongMeta} numberOfLines={1}>{meta}</Text>
      </View>
    </Pressable>
  );
}

function EssentialAlbumCard({
  album,
  onPress,
  styles,
}: Readonly<{
  album: AlbumDetail;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
}>) {
  const artworkUrl = getArtworkUrl(
    album.attributes?.artwork?.url,
    400,
    400,
  );

  const year = album.attributes?.releaseDate ? new Date(album.attributes.releaseDate).getFullYear() : '';

  return (
    <Pressable
      style={({ focused }) => [styles.essentialAlbumCard, focused && styles.cardFocused]}
      onPress={onPress}
      focusable>
      {({ focused }) => (
      <>
      <View style={styles.essentialAlbumArtworkContainer}>
        <MotionArtworkCover
          contentType="albums"
          contentId={album.id}
          artworkUrl={artworkUrl ?? undefined}
          focused={focused}
          width={200}
          height={200}
        />
      </View>
      <View style={styles.essentialAlbumInfo}>
        <Text style={styles.essentialAlbumName} numberOfLines={1}>{album.attributes?.name}</Text>
        <Text style={styles.essentialAlbumYear}>{year}</Text>
        {album.attributes?.editorialNotes?.short ? (
          <Text style={styles.essentialAlbumDesc} numberOfLines={4}>
            {album.attributes.editorialNotes.short.replaceAll(/<[^>]*>?/gm, '')}
          </Text>
        ) : null}
      </View>
      </>
      )}
    </Pressable>
  );
}

function MusicVideoCard({
  video,
  onPress,
  styles,
}: Readonly<{
  video: MusicVideoDetail;
  onPress: () => void;
  styles: ReturnType<typeof useStyles>;
}>) {
  const artworkUrl = getArtworkUrl(video.attributes?.artwork?.url, 400, 225);
  const year = video.attributes?.releaseDate ? new Date(video.attributes.releaseDate).getFullYear() : '';

  return (
    <Pressable
      style={({ focused }) => [styles.musicVideoCard, focused && styles.cardFocused]}
      onPress={onPress}
      focusable>
      <View style={styles.musicVideoArtworkContainer}>
        {artworkUrl ? (
          <Image source={{ uri: artworkUrl }} style={styles.musicVideoArtwork} resizeMode="cover" />
        ) : (
          <View style={[styles.musicVideoArtwork, styles.placeholderBg]} />
        )}
      </View>
      <View style={styles.musicVideoInfo}>
        <Text style={styles.essentialAlbumName} numberOfLines={1}>{video.attributes?.name}</Text>
        <Text style={styles.essentialAlbumYear}>{year}</Text>
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
  screenBackground: string;
  lightGreyBg: string;
  glassBg: string;
  buttonFocusedBg: string;
}) {
  return useMemo(() => StyleSheet.create({
    root: {
      flex: 1,
    },
    scrollContent: {
      marginTop: spacing.xl,
      marginLeft: spacing.xl,
      marginBottom: spacing.xxxl,
    },
    center: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    errorText: {
      color: c.textMuted,
      fontSize: 16,
    },
    placeholderBg: {
      backgroundColor: c.navBarCardBg,
    },

    // ── Header ───────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xl,
      gap: spacing.lg,
      paddingRight: spacing.xl,
    },
    playButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: c.glassBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
    playButtonFocused: {
      transform: [{ scale: 1.1 }],
      backgroundColor: c.buttonFocusedBg,
    },
    playButtonIcon: {
      width: 0,
      height: 0,
      borderTopWidth: 8,
      borderBottomWidth: 8,
      borderLeftWidth: 14,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: c.textOnDark,
      marginLeft: 4,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: 48,
      paddingHorizontal: spacing.xl,
      borderRadius: 24,
      backgroundColor: c.glassBg,
    },
    actionBtnFocused: {
      backgroundColor: c.buttonFocusedBg,
      transform: [{ scale: 1.05 }],
    },
    actionBtnText: {
      fontSize: 16,
      fontWeight: '600',
      color: c.textOnDark,
      marginLeft: spacing.sm,
    },
    artistNameTitle: {
      fontSize: 48,
      fontWeight: '700',
      color: c.textOnDark,
    },

    // ── Sections ─────────────────────
    sectionTitle: {
      fontSize: 22,
      fontWeight: '600',
      color: c.textMuted,
    },
    topRow: {
      flexDirection: 'row',
      marginBottom: spacing.xl,
      gap: spacing.xl, // Space between latest release and top songs
    },
    latestReleaseSection: {
      width: 320, // Fixed width for latest release (reduced)
      flexShrink: 0,
    },
    topSongsSection: {
      flex: 1,
      overflow: 'hidden',
    },
    topSongsList: {
      gap: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: spacing.md,
      paddingLeft: spacing.xs, // Small padding to allow focus scale without clipping
    },
    topSongsColumn: {
      flexDirection: 'column',
      gap: spacing.sm,
      width: 320, // Fixed width for each top song item (shorter width)
    },
    albumsSection: {
      marginBottom: spacing.xl, // Match topRow margin
    },
    albumsList: {
      gap: spacing.lg,
      paddingRight: spacing.xl,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg, // Extra room for scale
      paddingLeft: spacing.xs,
    },

    // ── Cards ────────────────────────
    cardFocused: {
      transform: [{ scale: 1.02 }],
      backgroundColor: c.buttonFocusedBg,
    },

    // Latest Release Card
    latestReleaseCard: {
      flexDirection: 'row',
      backgroundColor: c.glassBg,
      borderRadius: 4,
      overflow: 'hidden',
      height: 152,
      marginTop: spacing.sm,
    },
    latestReleaseArtworkContainer: {
      width: 152,
      height: 152,
    },
    latestReleaseArtwork: {
      width: '100%',
      height: '100%',
    },
    latestReleaseInfo: {
      flex: 1,
      padding: spacing.md,
      justifyContent: 'center',
    },
    latestReleaseDate: {
      fontSize: 12,
      fontWeight: '700',
      color: c.accent,
      marginBottom: spacing.xs,
    },
    latestReleaseName: {
      fontSize: 18,
      fontWeight: '600',
      color: c.textOnDark,
      marginBottom: spacing.xs,
    },
    latestReleaseMeta: {
      fontSize: 14,
      color: c.textMuted,
    },

    // Top Song Card
    topSongCard: {
      flexDirection: 'row',
      backgroundColor: c.glassBg,
      borderRadius: 4,
      overflow: 'hidden',
      alignItems: 'center',
      height: 72,
    },
    topSongArtworkContainer: {
      width: 72,
      height: 72,
    },
    topSongArtwork: {
      width: '100%',
      height: '100%',
    },
    topSongInfo: {
      flex: 1,
      marginLeft: spacing.md,
      justifyContent: 'center',
    },
    topSongName: {
      fontSize: 16,
      fontWeight: '500',
      color: c.textOnDark,
      marginBottom: 2,
    },
    topSongMeta: {
      fontSize: 14,
      color: c.textMuted,
    },

    // Essential Album Card
    essentialAlbumCard: {
      flexDirection: 'row',
      backgroundColor: c.glassBg,
      borderRadius: 4,
      overflow: 'hidden',
      width: 400,
      height: 200,
    },
    essentialAlbumArtworkContainer: {
      width: 200,
      height: 200,
    },
    essentialAlbumArtwork: {
      width: '100%',
      height: '100%',
    },
    essentialAlbumInfo: {
      flex: 1,
      padding: spacing.lg,
    },
    essentialAlbumName: {
      fontSize: 20,
      fontWeight: '600',
      color: c.textOnDark,
      marginBottom: 2,
    },
    essentialAlbumYear: {
      fontSize: 14,
      color: c.textMuted,
      marginBottom: spacing.sm,
    },
    essentialAlbumDesc: {
      fontSize: 13,
      color: c.textSubtle,
      lineHeight: 18,
    },

    // Music Video Card (16:9 ratio, 400x225)
    musicVideoCard: {
      flexDirection: 'column',
      backgroundColor: c.glassBg,
      borderRadius: 4,
      overflow: 'hidden',
      width: 320,
    },
    musicVideoArtworkContainer: {
      width: 320,
      height: 180,
    },
    musicVideoArtwork: {
      width: '100%',
      height: '100%',
    },
    musicVideoInfo: {
      padding: spacing.sm,
    },
  }), [c]);
}
