/**
 * Apple Music Catalog Search API.
 * GET /v1/catalog/{storefront}/search — search catalog resources
 * GET /v1/catalog/{storefront}/search/hints — search term hints
 */

import type {SearchResponse, SearchHintsResponse} from '../../types/search';
import {appleMusicApi} from './client';

const DEFAULT_STOREFRONT = 'tr';

export async function searchCatalog(
  term: string,
  storefront = DEFAULT_STOREFRONT,
  limit = 10,
): Promise<SearchResponse> {
  const {data} = await appleMusicApi.get<SearchResponse>(
    `/catalog/${storefront}/search`,
    {
      params: {
        term: term.trim().replaceAll(/\s+/g, '+'),
        types: 'songs,albums,artists,playlists',
        limit,
      },
    },
  );
  return data;
}

export async function fetchSearchHints(
  term: string,
  storefront = DEFAULT_STOREFRONT,
  limit = 10,
): Promise<string[]> {
  const {data} = await appleMusicApi.get<SearchHintsResponse>(
    `/catalog/${storefront}/search/hints`,
    {params: {term: term.trim().replaceAll(/\s+/g, '+'), limit}},
  );
  return data?.results?.terms ?? [];
}
