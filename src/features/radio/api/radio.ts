import { appleMusicApi } from '../../../api/apple-music/client';
import { StationDetailResponse } from '../../../types/catalog';

/**
 * Fetch the Apple Music live radio stations for the storefront.
 * GET /v1/catalog/{storefront}/stations?filter[featured]=apple-music-live-radio
 */
export async function fetchLiveRadioStations(
  storefront: string,
): Promise<StationDetailResponse> {
  const { data } = await appleMusicApi.get<StationDetailResponse>(
    `/catalog/${storefront}/stations`,
    {
      params: {
        'filter[featured]': 'apple-music-live-radio',
      },
    },
  );
  return data;
}

/**
 * Fetch the current user’s personal Apple Music station.
 * GET /v1/catalog/{storefront}/stations?filter[identity]=personal
 */
export async function fetchPersonalRadioStation(
  storefront: string,
): Promise<StationDetailResponse> {
  const { data } = await appleMusicApi.get<StationDetailResponse>(
    `/catalog/${storefront}/stations`,
    {
      params: {
        'filter[identity]': 'personal',
      },
    },
  );
  return data;
}

/**
 * Fetch recently played radio stations.
 * GET /v1/me/recent/radio-stations
 */
export async function fetchRecentlyPlayedStations(): Promise<StationDetailResponse> {
  const { data } = await appleMusicApi.get<StationDetailResponse>(
    '/me/recent/radio-stations',
  );
  return data;
}
