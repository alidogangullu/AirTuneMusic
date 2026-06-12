/**
 * Card for a single recommendation item (playlist, album, station).
 * Apple Music style: artwork, title, subtitle.
 */

import React, { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getArtworkUrl } from '../api/recommendations';
import { radius, spacing } from '../../../theme/layout';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../theme';
import { RecommendationContent } from '../../../types/recommendations';
import { MotionArtworkCover } from '../../../components/MotionArtworkCover';

const CARD_WIDTH = 180;
const ARTWORK_SIZE = 160;

export type RecommendationCardProps = {
  category?: string;
  content: RecommendationContent;
  onPress?: () => void;
};

export function RecommendationCard({
  category,
  content,
  onPress,
}: Readonly<RecommendationCardProps>): React.JSX.Element {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles(colors);

  const artworkUrl = getArtworkUrl(
    content.attributes?.artwork?.url,
    ARTWORK_SIZE,
    ARTWORK_SIZE,
  );
  const title = content.attributes?.name ?? t('common.unknown');
  const subtitle = content.attributes?.artistName ?? '';
  const supportsMotion =
    content.type === 'playlists' ||
    content.type === 'albums' ||
    content.type === 'stations';

  return (
    <Pressable
      style={({ focused }) => [styles.card, focused && styles.cardFocused]}
      onPress={onPress}
      focusable>
      {({ focused }) => (
        <View style={styles.cardInner}>
          {category ? (
            <Text style={styles.category} numberOfLines={1}>
              {category}
            </Text>
          ) : null}
          {supportsMotion ? (
            <MotionArtworkCover
              contentType={content.type as 'playlists' | 'albums' | 'stations'}
              contentId={content.id}
              artworkUrl={artworkUrl}
              focused={focused}
              width={ARTWORK_SIZE}
              height={ARTWORK_SIZE}
              borderRadius={radius.md}
            />
          ) : (
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
          )}
          <View style={styles.textContainer}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={styles.subtitle}
                numberOfLines={1}
                ellipsizeMode="tail">
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
}

function useStyles(c: {
  textOnDark: string;
  textMuted: string;
  navBarCardBg: string;
  cardTitleText: string;
}) {
  return useMemo(() => StyleSheet.create({
    card: {
      width: CARD_WIDTH,
    },
    cardFocused: {
      opacity: 1,
      transform: [{ scale: 1.1 }], // scale from center — paddingVertical in rail handles overflow
    },
    cardInner: {
      width: CARD_WIDTH,
    },
    category: {
      fontSize: 13,
      color: c.textMuted,
      marginBottom: spacing.sm,
    },
    artworkContainer: {
      width: ARTWORK_SIZE,
      height: ARTWORK_SIZE,
      borderRadius: radius.md,
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
    textContainer: {
      marginTop: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    title: {
      fontSize: 15,
      fontWeight: '600',
      color: c.cardTitleText,
    },
    subtitle: {
      fontSize: 13,
      color: c.textMuted,
    },
  }), [c]);
}
