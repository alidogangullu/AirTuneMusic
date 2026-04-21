/**
 * Apple Music User Library API.
 * All endpoints require Music-User-Token (auto-injected by client for /me/ paths).
 *
 * GET /v1/me/library/recently-added — recently added resources
 * GET /v1/me/library/albums          — all library albums
 * GET /v1/me/library/playlists       — all library playlists
 * GET /v1/me/library/artists         — all library artists
 * GET /v1/me/library/songs           — all library songs
 */

import type {LibraryCategoryId, LibraryResponse} from '../../types/library';
import type {PlaylistDetailResponse, AlbumDetailResponse} from '../../types/catalog';
import {appleMusicApi} from './client';

const ENDPOINT_MAP: Record<LibraryCategoryId, string> = {
  'recently-added': '/me/library/recently-added',
  albums: '/me/library/albums',
  playlists: '/me/library/playlists',
  artists: '/me/library/artists',
  songs: '/me/library/songs',
  'music-videos': '/me/library/music-videos',
};

export async function fetchLibraryItems(
  category: LibraryCategoryId,
  limit = 25,
  offset?: string,
): Promise<LibraryResponse> {
  const endpoint = ENDPOINT_MAP[category];
  const params: Record<string, string | number> = {limit};
  if (offset) {
    params.offset = offset;
  }
  if (category === 'artists' || category === 'music-videos') {
    params.include = 'catalog';
  }
  if (category === 'recently-added') {
    params['include[library-music-videos]'] = 'catalog';
  }
  const {data} = await appleMusicApi.get<LibraryResponse>(endpoint, {params});
  return data;
}

export async function fetchLibraryPlaylistDetail(
  id: string,
): Promise<PlaylistDetailResponse> {
  const {data} = await appleMusicApi.get<PlaylistDetailResponse>(
    `/me/library/playlists/${id}`,
    {params: {include: 'tracks', 'include[library-songs]': 'catalog', 'include[library-music-videos]': 'catalog'}},
  );
  return data;
}

export async function fetchLibraryAlbumDetail(
  id: string,
): Promise<AlbumDetailResponse> {
  const {data} = await appleMusicApi.get<AlbumDetailResponse>(
    `/me/library/albums/${id}`,
    {params: {include: 'tracks', 'include[library-songs]': 'catalog'}},
  );
  return data;
}

export async function fetchStorefront(): Promise<any> {
  const {data} = await appleMusicApi.get('/me/storefront');
  return data;
}

export async function fetchRecentlyPlayedVideos(limit = 20): Promise<any[]> {
  const { data } = await appleMusicApi.get<{ data: any[] }>(
    '/me/recent/played/tracks',
    { params: { types: 'music-videos,library-music-videos', limit } },
  );
  return data.data ?? [];
}

export async function fetchLibraryMusicVideos(limit = 20): Promise<any[]> {
  const { data } = await appleMusicApi.get<{ data: any[] }>(
    '/me/library/music-videos',
    { params: { limit } },
  );
  return data.data ?? [];
}
