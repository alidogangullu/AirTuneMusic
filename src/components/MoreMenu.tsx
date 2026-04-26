/**
 * MoreMenu — Apple Music ••• actions for the content detail screen.
 * Delegates rendering to TVActionSheet.
 *
 *   albums       → Add to Library  |  Love  |  Dislike  |  Add to Playlist  |  Go to Artist
 *   playlists    → Add to Library  |  Love  |  Dislike  |  Add to Playlist
 *   songs        → Add to Library  |  Love  |  Dislike  |  Add to Playlist  |  Go to Artist  |  Go to Album
 *   music-videos → Add to Library  |  Love  |  Dislike  |  Go to Artist  |  Go to Album
 *   stations     → Love  |  Dislike
 *
 * "Add to Playlist" opens a secondary TVActionSheet listing the user's editable library playlists.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { TVActionSheet } from './TVActionSheet';
import type { TVActionSheetItem } from './TVActionSheet';
import { getRating, setRating as setUserRating } from '../api/apple-music/ratings';
import { addToLibrary, fetchEditableLibraryPlaylists, addTrackToPlaylist, type LibraryMembershipSnapshot, type EditablePlaylist } from '../api/apple-music/library';
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
  handleDislike: () => Promise<void>;
  handleAddToLibrary: () => Promise<void>;
  handleAddToPlaylist: () => void;
};

function buildLibraryLabel(t: Translate, inLibrary: boolean, loading: boolean): string {
  if (loading) { return '…'; }
  return inLibrary ? t('more.inLibrary') : t('more.addToLibrary');
}

function buildRatingLabel(t: Translate, rating: number, loading: boolean, activeValue: number, activeKey: string, inactiveKey: string): string {
  if (loading) { return '…'; }
  return rating === activeValue ? t(activeKey) : t(inactiveKey);
}

function actionItems(t: Translate, contentType: RecommendationContentType, state: ActionState): TVActionSheetItem[] {
  const { rating, loadingRating, inLibrary, loadingLibrary, handleLove, handleDislike, handleAddToLibrary, handleAddToPlaylist } = state;
  const items: TVActionSheetItem[] = [];

  const supportsLibrary = contentType === 'songs' || contentType === 'albums' || contentType === 'playlists' || contentType === 'music-videos';
  const supportsRating = supportsLibrary || contentType === 'stations';
  const supportsPlaylist = contentType === 'songs' || contentType === 'albums' || contentType === 'playlists';

  if (supportsLibrary) {
    items.push({ key: 'library', label: buildLibraryLabel(t, inLibrary, loadingLibrary), onPress: handleAddToLibrary, disabled: loadingLibrary || inLibrary });
  }
  if (supportsRating) {
    items.push(
      { key: 'love', label: buildRatingLabel(t, rating, loadingRating, 1, 'more.removeLove', 'more.love'), onPress: handleLove },
      { key: 'dislike', label: buildRatingLabel(t, rating, loadingRating, -1, 'more.removeDislike', 'more.dislike'), onPress: handleDislike },
    );
  }
  if (supportsPlaylist) {
    items.push({ key: 'addToPlaylist', label: t('more.addToPlaylist'), onPress: handleAddToPlaylist });
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
  const [playlists, setPlaylists] = useState<EditablePlaylist[]>([]);
  const [playlistPickerVisible, setPlaylistPickerVisible] = useState(false);
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);

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
      try {
        await fn();
        if (successMsg) setFeedback(successMsg);
        return true;
      } catch (e) {
        console.error('[MoreMenu] action failed:', key, e);
        setFeedback(t('more.error'));
        return false;
      } finally {
        setBusyKey(null);
      }
    },
    [t],
  );

  const handleLove = useCallback(async () => {
    const newValue = rating === 1 ? 0 : 1;
    const success = await run('love', () => setUserRating(contentId, newValue, contentType), '');
    if (success) {
      setRating(newValue);
    }
  }, [rating, contentId, contentType, run]);

  const handleDislike = useCallback(async () => {
    const newValue = rating === -1 ? 0 : -1;
    const success = await run('dislike', () => setUserRating(contentId, newValue, contentType), '');
    if (success) {
      setRating(newValue);
    }
  }, [rating, contentId, contentType, run]);

  const handleAddToPlaylist = useCallback(() => {
    setLoadingPlaylists(true);
    setPlaylists([]);
    setPlaylistPickerVisible(true);
    fetchEditableLibraryPlaylists()
      .then(result => setPlaylists(result.length > 0 ? result : []))
      .catch(() => setPlaylists([]))
      .finally(() => setLoadingPlaylists(false));
  }, []);

  const handlePickPlaylist = useCallback(async (playlist: EditablePlaylist) => {
    setPlaylistPickerVisible(false);
    onClose();
    await run(
      `playlist-${playlist.id}`,
      () => addTrackToPlaylist(playlist.id, contentId),
      '',
    );
  }, [contentId, onClose, run]);

  const handleAddToLibrary = useCallback(async () => {
    const success = await run('library', () => addToLibrary(contentType, contentId), '');
    if (!success) return;
    setLocallyAdded(true);
    queryClient.setQueryData<LibraryMembershipSnapshot>(
      LIBRARY_MEMBERSHIP_QUERY_KEY,
      previous => {
        if (!previous || isInLibrarySnapshot(previous, contentType, contentId)) {
          return previous;
        }
        const entry = previous[contentType as keyof LibraryMembershipSnapshot];
        return {
          ...previous,
          [contentType]: { ...entry, ids: [...entry.ids, contentId] },
        };
      },
    );
    queryClient.invalidateQueries({ queryKey: LIBRARY_MEMBERSHIP_QUERY_KEY }).catch(() => undefined);
  }, [contentId, contentType, queryClient, run]);

  const items: TVActionSheetItem[] = [
    ...navItems(t, contentType, relationships, onClose, onNavigateToArtist, onNavigateToAlbum),
    ...actionItems(t, contentType, { rating, loadingRating, inLibrary, loadingLibrary, handleLove, handleDislike, handleAddToLibrary, handleAddToPlaylist }),
  ];

  let playlistItems: TVActionSheetItem[];
  if (loadingPlaylists) {
    playlistItems = [{ key: 'loading', label: t('more.loadingPlaylists'), onPress: async () => {}, disabled: true }];
  } else if (playlists.length === 0) {
    playlistItems = [{ key: 'empty', label: t('more.noPlaylists'), onPress: async () => {}, disabled: true }];
  } else {
    playlistItems = playlists.map(pl => ({ key: pl.id, label: pl.name, onPress: () => handlePickPlaylist(pl) }));
  }

  return (
    <>
      <TVActionSheet
        visible={visible}
        onClose={onClose}
        items={items}
        busyKey={busyKey}
        feedback={feedback}
      />
      <TVActionSheet
        visible={playlistPickerVisible}
        onClose={() => setPlaylistPickerVisible(false)}
        items={playlistItems}
        busyKey={busyKey}
      />
    </>
  );
}
