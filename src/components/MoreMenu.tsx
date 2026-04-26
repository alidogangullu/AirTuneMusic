/**
 * MoreMenu — Apple Music ••• actions for the content detail screen.
 * Delegates rendering to TVActionSheet.
 *
 *   albums       → Add to Library  |  Love  |  Go to Artist
 *   playlists    → Add to Library  |  Love
 *   songs        → Add to Library  |  Love  |  Go to Artist  |  Go to Album
 *   music-videos → Add to Library  |  Love  |  Go to Artist  |  Go to Album
 *   stations     → Love
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TVActionSheet } from './TVActionSheet';
import type { TVActionSheetItem } from './TVActionSheet';
import { getRating, setRating as setUserRating } from '../api/apple-music/ratings';
import { addToLibrary, removeFromLibrary, type LibraryMembershipSnapshot } from '../api/apple-music/library';
import {
  isInLibrarySnapshot,
  LIBRARY_MEMBERSHIP_QUERY_KEY,
  useLibraryMembership,
} from '../hooks/useLibraryMembership';
import type { RecommendationContentType } from '../types/recommendations';

export type MoreMenuRelationships = {
  artistId?: string;
  artistName?: string;
  albumId?: string;
  albumName?: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  contentId: string;
  contentType: RecommendationContentType;
  relationships?: MoreMenuRelationships;
  onNavigateToArtist?: (artistId: string) => void;
  onNavigateToAlbum?: (albumId: string) => void;
};

// ── Item builders ────────────────────────────────────────────────

type Translate = ReturnType<typeof useTranslation>['t'];

function navItems(
  t: Translate,
  contentType: RecommendationContentType,
  relationships: MoreMenuRelationships | undefined,
  onClose: () => void,
  onNavigateToArtist: ((id: string) => void) | undefined,
  onNavigateToAlbum: ((id: string) => void) | undefined,
): TVActionSheetItem[] {
  const items: TVActionSheetItem[] = [];
  const isVideoLike = contentType === 'songs' || contentType === 'music-videos';
  if (relationships?.albumId && onNavigateToAlbum && isVideoLike) {
    const albumId = relationships.albumId;
    const label = t('more.goToAlbum');
    items.push({ key: 'album', label, onPress: () => { onClose(); onNavigateToAlbum(albumId); } });
  }
  if (relationships?.artistId && onNavigateToArtist) {
    const artistId = relationships.artistId;
    const label = t('more.goToArtist');
    items.push({ key: 'artist', label, onPress: () => { onClose(); onNavigateToArtist(artistId); } });
  }
  return items;
}

type ActionState = {
  rating: number;
  loadingRating: boolean;
  inLibrary: boolean;
  loadingLibrary: boolean;
  handleLove: () => Promise<void>;
  handleAddToLibrary: () => Promise<void>;
};

function actionItems(t: Translate, contentType: RecommendationContentType, state: ActionState): TVActionSheetItem[] {
  const { rating, loadingRating, inLibrary, loadingLibrary, handleLove, handleAddToLibrary } = state;
  const items: TVActionSheetItem[] = [];
  const supportsLibrary = contentType === 'songs' || contentType === 'albums' || contentType === 'playlists' || contentType === 'music-videos';

  if (supportsLibrary) {
    let libraryLabel = t('more.addToLibrary');
    if (loadingLibrary) { libraryLabel = '…'; }
    else if (inLibrary) { libraryLabel = t('more.inLibrary'); }
    items.push({ key: 'library', label: libraryLabel, onPress: handleAddToLibrary, disabled: loadingLibrary });
  }

  const supportsRating = supportsLibrary || contentType === 'stations';
  if (supportsRating) {
    let loveLabel = rating === 1 ? t('more.removeLove') : t('more.love');
    if (loadingRating) { loveLabel = '…'; }
    items.push({ key: 'love', label: loveLabel, onPress: handleLove });
  }

  return items;
}

// ── Component ────────────────────────────────────────────────────

export function MoreMenu({
  visible,
  onClose,
  contentId,
  contentType,
  relationships,
  onNavigateToArtist,
  onNavigateToAlbum,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const membership = useLibraryMembership(contentType, contentId);

  const [rating, setRating] = useState(0);
  const [loadingRating, setLoadingRating] = useState(false);
  const [locallyAdded, setLocallyAdded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const inLibrary = locallyAdded || membership.inLibrary;
  const loadingLibrary = !locallyAdded && membership.loading;

  useEffect(() => {
    if (!visible) { return; }
    setFeedback(null);
    setLoadingRating(true);
    getRating(contentId, contentType).then(v => setRating(v)).finally(() => setLoadingRating(false));
  }, [visible, contentId, contentType]);

  useEffect(() => {
    setLocallyAdded(false);
  }, [contentId, contentType]);

  const run = useCallback(
    async (key: string, fn: () => Promise<void>, successMsg: string) => {
      setBusyKey(key);
      try { await fn(); setFeedback(successMsg); }
      catch { setFeedback(t('more.error')); }
      finally { setBusyKey(null); }
    },
    [t],
  );

  const handleLove = useCallback(async () => {
    const newValue = rating === 1 ? 0 : 1;
    await run('love', () => setUserRating(contentId, newValue, contentType), newValue === 1 ? t('more.loved') : t('more.loveRemoved'));
    setRating(newValue);
  }, [rating, contentId, contentType, run, t]);

  const handleAddToLibrary = useCallback(async () => {
    const supportedType =
      contentType === 'albums' ||
      contentType === 'songs' ||
      contentType === 'playlists' ||
      contentType === 'music-videos';

    if (!supportedType) {
      return;
    }

    if (inLibrary) {
      const removeId = membership.libraryId ?? contentId;
      await run('library', () => removeFromLibrary(contentType, removeId), t('more.removedFromLibrary'));
      setLocallyAdded(false);
      queryClient.setQueryData<LibraryMembershipSnapshot>(
        LIBRARY_MEMBERSHIP_QUERY_KEY,
        previous => {
          if (!previous) {
            return previous;
          }

          const entry = previous[contentType];
          const nextIds = entry.ids.filter(id => id !== contentId && id !== removeId);
          const nextCatalogToLibrary = Object.fromEntries(
            Object.entries(entry.catalogToLibrary).filter(
              ([catalogId, libraryId]) => catalogId !== contentId && catalogId !== removeId && libraryId !== removeId,
            ),
          );

          return {
            ...previous,
            [contentType]: {
              ...entry,
              ids: nextIds,
              catalogToLibrary: nextCatalogToLibrary,
            },
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: LIBRARY_MEMBERSHIP_QUERY_KEY }).catch(() => undefined);
      return;
    }

    await run('library', () => addToLibrary(contentType, contentId), t('more.addedToLibrary'));
    setLocallyAdded(true);
    queryClient.setQueryData<LibraryMembershipSnapshot>(
      LIBRARY_MEMBERSHIP_QUERY_KEY,
      previous => {
        if (!previous) {
          return previous;
        }

        if (isInLibrarySnapshot(previous, contentType, contentId)) {
          return previous;
        }

        const entry = previous[contentType];
        return {
          ...previous,
          [contentType]: {
            ...entry,
            ids: [...entry.ids, contentId],
          },
        };
      },
    );

    queryClient.invalidateQueries({ queryKey: LIBRARY_MEMBERSHIP_QUERY_KEY }).catch(() => undefined);
  }, [contentId, contentType, inLibrary, membership.libraryId, queryClient, run, t]);

  const items: TVActionSheetItem[] = [
    ...navItems(t, contentType, relationships, onClose, onNavigateToArtist, onNavigateToAlbum),
    ...actionItems(t, contentType, { rating, loadingRating, inLibrary, loadingLibrary, handleLove, handleAddToLibrary }),
  ];

  return (
    <TVActionSheet
      visible={visible}
      onClose={onClose}
      items={items}
      busyKey={busyKey}
      feedback={feedback}
    />
  );
}
