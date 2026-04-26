import React, { useCallback, useEffect } from 'react';
import {
  BackHandler,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { getArtworkUrl } from '../api/apple-music';
import { formatFullDate } from '../utils/dateUtils';
import { useArtistDetail } from '../hooks/useArtistDetail';
import { usePlayer } from '../hooks/usePlayer';
import { useContentNavigation } from '../navigation';
import { ContentDetailScreen } from './ContentDetailScreen';
import { GradientBackground } from '../components/GradientBackground';
import { useTheme } from '../theme';
import { spacing } from '../theme/layout';
import type { AlbumDetail, MusicVideoDetail, SongDetail } from '../types/catalog';

export type ArtistDetailScreenProps = {
  artistId: string;
  onBack: () => void;
};

export function ArtistDetailScreen({
  artistId,
  onBack,
}: Readonly<ArtistDetailScreenProps>): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(colors);
  const { data, isLoading, error } = useArtistDetail(artistId);

  const { playSong } = usePlayer();
  const { openNowPlayingFullscreen, pushContent } = useContentNavigation();

  const [selectedAlbumParams, setSelectedAlbumParams] = React.useState<{ id: string, type: 'albums' } | null>(null);

  // Hardware back button support for Android TV remote
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedAlbumParams) {
        setSelectedAlbumParams(null);
      } else {
        onBack();
      }
      return true;
    });
    return () => sub.remove();
  }, [onBack, selectedAlbumParams]);

  const artist = data?.data?.[0];
  const attrs = artist?.attributes;
  const topSongs = React.useMemo(() => artist?.views?.['top-songs']?.data ?? [], [artist]);
  const latestRelease = artist?.views?.['latest-release']?.data?.[0];
  const essentialAlbums = artist?.views?.['full-albums']?.data ?? [];
  const musicVideos = artist?.views?.['top-music-videos']?.data ?? [];

  const handlePlayArtist = useCallback(() => {
    if (topSongs.length > 0) {
      const firstSong = topSongs[0];
      if (firstSong) {
        // Find catalog song id to play
        const songId = firstSong.attributes?.playParams?.id ?? firstSong.id;
        playSong(songId).catch(console.warn);
        openNowPlayingFullscreen();
      }
    }
  }, [topSongs, playSong, openNowPlayingFullscreen]);

  const handleTrackPress = useCallback((song: SongDetail) => {
    const songId = song.attributes?.playParams?.id ?? song.id;
    playSong(songId).catch(console.warn);
    openNowPlayingFullscreen();
  }, [playSong, openNowPlayingFullscreen]);

  const handleAlbumPress = useCallback((album: AlbumDetail) => {
    setSelectedAlbumParams({
      id: album.id,
      type: 'albums',
    });
  }, []);

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
    const LoadingIndicator = require('../components/LoadingIndicator').LoadingIndicator;
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
    <>
      <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
        {/* ── Header ──────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            style={({ focused }) => [styles.playButton, focused && styles.playButtonFocused]}
            onPress={handlePlayArtist}
            focusable>
            <View style={styles.playButtonIcon} />
          </Pressable>
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

      <Modal
        visible={selectedAlbumParams !== null}
        animationType="none"
        onRequestClose={() => setSelectedAlbumParams(null)}>
        {selectedAlbumParams !== null && (
          <GradientBackground
            startColor={colors.gradientStart}
            endColor={colors.gradientEnd}>
            <ContentDetailScreen
              contentId={selectedAlbumParams.id}
              contentType={selectedAlbumParams.type}
              onBack={() => setSelectedAlbumParams(null)}
            />
          </GradientBackground>
        )}
      </Modal>
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────

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
      <View style={styles.latestReleaseArtworkContainer}>
        {artworkUrl ? (
          <Image source={{ uri: artworkUrl }} style={styles.latestReleaseArtwork} resizeMode="cover" />
        ) : (
          <View style={[styles.latestReleaseArtwork, styles.placeholderBg]} />
        )}
      </View>
      <View style={styles.latestReleaseInfo}>
        <Text style={styles.latestReleaseDate}>{releaseDate}</Text>
        <Text style={styles.latestReleaseName} numberOfLines={2}>{album.attributes?.name}</Text>
        <Text style={styles.latestReleaseMeta}>
          {album.attributes?.isSingle ? t('artist.single') : t('artist.album')} · {t('detail.songsCount', { count: album.attributes?.trackCount })}
        </Text>
      </View>
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
      <View style={styles.essentialAlbumArtworkContainer}>
        {artworkUrl ? (
          <Image source={{ uri: artworkUrl }} style={styles.essentialAlbumArtwork} resizeMode="cover" />
        ) : (
          <View style={[styles.essentialAlbumArtwork, styles.placeholderBg]} />
        )}
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
  return StyleSheet.create({
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
      width: 64,
      height: 64,
      borderRadius: 32,
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
      borderTopWidth: 12,
      borderBottomWidth: 12,
      borderLeftWidth: 22,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderLeftColor: c.textOnDark,
      marginLeft: 6,
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
  });
}
