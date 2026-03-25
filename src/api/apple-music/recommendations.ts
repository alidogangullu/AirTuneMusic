/**
 * Apple Music Recommendations API.
 * GET /v1/me/recommendations — returns personal recommendations.
 */

import type {
  AlbumDetailResponse,
  ArtistDetailResponse,
  MusicVideoDetailResponse,
  PlaylistDetailResponse,
  SongDetailResponse,
  StationDetailResponse,
} from '../../types/catalog';
import type { GenreResponse } from '../../types/catalog';
import type { RecommendationsResponse } from '../../types/recommendations';
import { appleMusicApi } from './client';

export async function fetchRecommendations(): Promise<RecommendationsResponse> {
  const { data } = await appleMusicApi.get<RecommendationsResponse>(
    '/me/recommendations',
    {
      //params: {limit: 20},
    },
  );
  return data;
}

/**
 * Fetch all catalog genres for a storefront.
 * GET /v1/catalog/{storefront}/genres
 */
export async function fetchCatalogGenres(
  storefront: string,
): Promise<GenreResponse> {
  const { data } = await appleMusicApi.get<GenreResponse>(
    `/catalog/${storefront}/genres`,
  );
  return data;
}

/**
 * Get the user's storefront (country code).
 * GET /v1/me/storefront
 */
export async function fetchUserStorefront(): Promise<string> {
  const { data } = await appleMusicApi.get<{ data: Array<{ id: string }> }>(
    '/me/storefront',
  );
  return data.data[0]?.id ?? 'us';
}

/**
 * Fetch top charts for a storefront.
 * GET /v1/catalog/{storefront}/charts
 */
export async function fetchCatalogCharts(
  storefront: string,
  types: string = 'playlists,albums',
  genre?: string,
): Promise<any> {
  const params: any = { types };
  if (genre) params.genre = genre;
  const { data } = await appleMusicApi.get(`/catalog/${storefront}/charts`, {
    params,
  });
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
  const { data } = await appleMusicApi.get<PlaylistDetailResponse>(
    `/catalog/${storefront}/playlists/${id}`,
    { params: { include: 'tracks' } },
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
  const { data } = await appleMusicApi.get<AlbumDetailResponse>(
    `/catalog/${storefront}/albums/${id}`,
    { params: { include: 'tracks' } },
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
  const { data } = await appleMusicApi.get<ArtistDetailResponse>(
    `/catalog/${storefront}/artists/${id}`,
    { params: { views: 'top-songs,latest-release,full-albums' } },
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
  const { data } = await appleMusicApi.get<StationDetailResponse>(
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
  const { data } = await appleMusicApi.get<SongDetailResponse>(
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
  const { data } = await appleMusicApi.get<MusicVideoDetailResponse>(
    `/catalog/${storefront}/music-videos/${id}`,
  );
  return data;
}

import { PixelRatio } from 'react-native';

/**
 * Build artwork URL with dimensions.
 * Apple Music URLs use {w}x{h}cc.jpg placeholders.
 * Returns direct Apple-hosted artwork URL.
 */
export function getArtworkUrl(
  url: string | undefined,
  width = 300,
  height = 300,
): string | undefined {
  if (!url) return undefined;

  // Scale dimensions based on device pixel density for higher quality
  const scale = PixelRatio.get();
  const scaledW = Math.round(width * scale);
  const scaledH = Math.round(height * scale);

  const resolved = url
    .replace(/\{w\}/g, String(scaledW))
    .replace(/\{h\}/g, String(scaledH))
    .replace(/\{f\}/g, 'jpg');

  return resolved;
}
