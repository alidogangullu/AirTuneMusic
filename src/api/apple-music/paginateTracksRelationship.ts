import {appleMusicApi} from './client';
import type {PlaylistTrack} from '../../types/catalog';

type TracksRelationship = {href?: string; next?: string; data: PlaylistTrack[]};

function extractOffset(nextPath: string | undefined): string | undefined {
  if (!nextPath) { return undefined; }
  const match = /[?&]offset=(\d+)/.exec(nextPath);
  return match?.[1];
}

/**
 * Apple truncates a resource's inline `tracks` relationship to a per-endpoint cap
 * (100-300, see the relevant *.Relationships doc) and exposes the rest only via
 * `relationships.tracks.next`. This follows that cursor against the relationship's
 * own endpoint and appends pages into `tracks.data` in place, up to `maxPages`.
 */
export async function paginateTracksRelationship(
  tracks: TracksRelationship | undefined,
  tracksEndpoint: string,
  fetchLimit: number,
  extraParams: Record<string, string> = {},
  maxPages = 20,
): Promise<void> {
  if (!tracks) { return; }
  let offset = extractOffset(tracks.next);
  let page = 0;

  while (offset && page < maxPages) {
    const { data: nextPage } = await appleMusicApi.get<{ data: PlaylistTrack[]; next?: string }>(
      tracksEndpoint,
      { params: { ...extraParams, offset, limit: fetchLimit } },
    );
    tracks.data.push(...nextPage.data);
    offset = extractOffset(nextPage.next);
    page += 1;
  }
  tracks.next = undefined;
}
