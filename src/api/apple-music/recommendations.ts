/**
 * Apple Music Recommendations API.
 * GET /v1/me/recommendations — returns personal recommendations.
 */

import type {AlbumDetailResponse, ArtistDetailResponse, MusicVideoDetailResponse, PlaylistDetailResponse, SongDetailResponse, StationDetailResponse} from '../../types/catalog';
import type {RecommendationsResponse} from '../../types/recommendations';
import {appleMusicApi} from './client';
import {DEV_SERVER, CAN_REACH_INTERNET_DIRECTLY} from '../../config/devServer';

export async function fetchRecommendations(): Promise<RecommendationsResponse> {
  const {data} = await appleMusicApi.get<RecommendationsResponse>(
    '/me/recommendations',
    {
      //params: {limit: 20},
    },
  );
  return data;
}

/**
 * Fetch full playlist details including tracks.
 * GET /v1/catalog/{storefront}/playlists/{id}?include=tracks
 */
export async function fetchPlaylistDetail(
  id: string,
  storefront: string,
): Promise<PlaylistDetailResponse> {
  const {data} = await appleMusicApi.get<PlaylistDetailResponse>(
    `/catalog/${storefront}/playlists/${id}`,
    {params: {include: 'tracks'}},
  );
  return data;
}

/**
 * Fetch full album details including tracks.
 * GET /v1/catalog/{storefront}/albums/{id}?include=tracks
 */
export async function fetchAlbumDetail(
  id: string,
  storefront: string,
): Promise<AlbumDetailResponse> {
  const {data} = await appleMusicApi.get<AlbumDetailResponse>(
    `/catalog/${storefront}/albums/${id}`,
    {params: {include: 'tracks'}},
  );
  return data;
}

/**
 * Fetch artist details with top songs, latest release, and full albums.
 * GET /v1/catalog/{storefront}/artists/{id}?views=top-songs,latest-release,full-albums
 */
export async function fetchArtistDetail(
  id: string,
  storefront: string,
): Promise<ArtistDetailResponse> {
  const {data} = await appleMusicApi.get<ArtistDetailResponse>(
    `/catalog/${storefront}/artists/${id}`,
    {params: {views: 'top-songs,latest-release,full-albums'}},
  );
  return data;
}

/**
 * Fetch station details.
 * GET /v1/catalog/{storefront}/stations/{id}
 */
export async function fetchStationDetail(
  id: string,
  storefront: string,
): Promise<StationDetailResponse> {
  const {data} = await appleMusicApi.get<StationDetailResponse>(
    `/catalog/${storefront}/stations/${id}`,
  );
  return data;
}

/**
 * Fetch song details.
 * GET /v1/catalog/{storefront}/songs/{id}
 */
export async function fetchSongDetail(
  id: string,
  storefront: string,
): Promise<SongDetailResponse> {
  const {data} = await appleMusicApi.get<SongDetailResponse>(
    `/catalog/${storefront}/songs/${id}`,
  );
  return data;
}

/**
 * Fetch music video details.
 * GET /v1/catalog/{storefront}/music-videos/{id}
 */
export async function fetchMusicVideoDetail(
  id: string,
  storefront: string,
): Promise<MusicVideoDetailResponse> {
  const {data} = await appleMusicApi.get<MusicVideoDetailResponse>(
    `/catalog/${storefront}/music-videos/${id}`,
  );
  return data;
}

const ARTWORK_PROXY = `${DEV_SERVER}/api/apple-music-proxy/image`;

/**
 * Build artwork URL with dimensions.
 * Apple Music URLs use {w}x{h}cc.jpg placeholders.
 * __DEV__: Emulator can't reach mzstatic.com, use proxy.
 */
export function getArtworkUrl(
  url: string | undefined,
  width = 300,
  height = 300,
): string | undefined {
  if (!url) return undefined;
  const resolved = url
    .replace(/\{w\}/g, String(width))
    .replace(/\{h\}/g, String(height))
    .replace(/\{f\}/g, 'jpg');
  if (__DEV__ && !CAN_REACH_INTERNET_DIRECTLY) {
    return `${ARTWORK_PROXY}?url=${encodeURIComponent(resolved)}`;
  }
  return resolved;
}
