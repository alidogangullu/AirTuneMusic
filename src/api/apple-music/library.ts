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

export type LibraryMembershipContentType = 'albums' | 'songs' | 'playlists' | 'music-videos';

export type LibraryMembershipEntry = {
  ids: string[];
  catalogToLibrary: Record<string, string>;
};

export type LibraryMembershipSnapshot = Record<LibraryMembershipContentType, LibraryMembershipEntry>;

const ENDPOINT_MAP: Record<LibraryCategoryId, string> = {
  'recently-added': '/me/library/recently-added',
  albums: '/me/library/albums',
  playlists: '/me/library/playlists',
  artists: '/me/library/artists',
  songs: '/me/library/songs',
  'music-videos': '/me/library/music-videos',
};

const MEMBERSHIP_CATEGORIES: LibraryMembershipContentType[] = [
  'albums',
  'songs',
  'playlists',
  'music-videos',
];

function extractOffset(nextPath: string | undefined): string | undefined {
  if (!nextPath) { return undefined; }
  const match = /[?&]offset=(\d+)/.exec(nextPath);
  return match?.[1];
}

function collectMembershipIdsFromItem(
  item: any,
  target: Set<string>,
  catalogToLibrary: Record<string, string>,
): void {
  const libraryId = item?.id;
  if (typeof libraryId === 'string' && libraryId.length > 0) {
    target.add(libraryId);
  }

  const catalogId = item?.attributes?.playParams?.catalogId;
  if (typeof catalogId === 'string' && catalogId.length > 0) {
    target.add(catalogId);
    if (typeof libraryId === 'string' && libraryId.length > 0) {
      catalogToLibrary[catalogId] = libraryId;
    }
  }

  const catalogData = item?.relationships?.catalog?.data;
  if (Array.isArray(catalogData)) {
    catalogData.forEach((catalogItem: any) => {
      const id = catalogItem?.id;
      if (typeof id === 'string' && id.length > 0) {
        target.add(id);
        if (typeof libraryId === 'string' && libraryId.length > 0) {
          catalogToLibrary[id] = libraryId;
        }
      }
    });
  }
}

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

/**
 * Builds an ID snapshot of resources already present in the user's library.
 * Includes both library IDs and catalog IDs so screens that navigate with either ID
 * can render Add-to-Library state consistently without per-item API checks.
 */
export async function fetchLibraryMembershipSnapshot(
  limit = 100,
  maxPagesPerCategory = 25,
): Promise<LibraryMembershipSnapshot> {
  const result: LibraryMembershipSnapshot = {
    albums: { ids: [], catalogToLibrary: {} },
    songs: { ids: [], catalogToLibrary: {} },
    playlists: { ids: [], catalogToLibrary: {} },
    'music-videos': { ids: [], catalogToLibrary: {} },
  };

  for (const category of MEMBERSHIP_CATEGORIES) {
    const endpoint = ENDPOINT_MAP[category];
    const ids = new Set<string>();
    const catalogToLibrary: Record<string, string> = {};
    let offset: string | undefined;
    let pageCount = 0;

    do {
      const params: Record<string, string | number> = { limit, include: 'catalog' };
      if (offset) {
        params.offset = offset;
      }

      const { data } = await appleMusicApi.get<LibraryResponse>(endpoint, { params });
      (data.data ?? []).forEach(item => collectMembershipIdsFromItem(item, ids, catalogToLibrary));

      offset = extractOffset(data.next);
      pageCount += 1;
    } while (offset && pageCount < maxPagesPerCategory);

    result[category] = {
      ids: Array.from(ids),
      catalogToLibrary,
    };
  }

  return result;
}

// Maps content type to the query param key for POST /v1/me/library
const LIBRARY_ADD_TYPE_MAP: Record<string, string> = {
  albums: 'albums',
  songs: 'songs',
  playlists: 'playlists',
  'music-videos': 'music-videos',
};

const LIBRARY_CHECK_TYPE_MAP: Record<string, string> = {
  albums: 'albums',
  songs: 'songs',
  playlists: 'playlists',
  'music-videos': 'music-videos',
};

/**
 * Check if a catalog resource is already in the user's iCloud Music Library.
 * GET /v1/catalog/{storefront}/{type}/{id}?include=library
 * Returns true if relationships.library.data is non-empty.
 */
export async function checkInLibrary(
  contentType: string,
  id: string,
  storefront: string,
): Promise<boolean> {
  const apiType = LIBRARY_CHECK_TYPE_MAP[contentType];
  if (!apiType) { return false; }
  try {
    const { data } = await appleMusicApi.get<{ data: { relationships?: { library?: { data: unknown[] } } }[] }>(
      `/catalog/${storefront}/${apiType}/${id}`,
      { params: { include: 'library' } },
    );
    return (data.data?.[0]?.relationships?.library?.data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

/**
 * Add a catalog resource to the user's iCloud Music Library.
 * POST /v1/me/library?ids[albums]=id  (example)
 */
export async function addToLibrary(
  contentType: string,
  id: string,
): Promise<void> {
  const typeKey = LIBRARY_ADD_TYPE_MAP[contentType];
  if (!typeKey) { return; }
  await appleMusicApi.post('/me/library', null, {
    params: { [`ids[${typeKey}]`]: id },
  });
}

const LIBRARY_REMOVE_TYPE_MAP: Record<string, string> = {
  albums: 'albums',
  songs: 'songs',
  playlists: 'playlists',
  'music-videos': 'music-videos',
};

/**
 * Removes a library resource by its library ID.
 * Endpoint follows /v1/me/library/{type}/{id}.
 */
export async function removeFromLibrary(
  contentType: string,
  libraryId: string,
): Promise<void> {
  const typeKey = LIBRARY_REMOVE_TYPE_MAP[contentType];
  if (!typeKey || !libraryId) { return; }
  await appleMusicApi.delete(`/me/library/${typeKey}/${libraryId}`);
}
