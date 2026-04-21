import type { PlaylistTrack } from '../types/catalog';
import type { TrackInfo } from '../services/musicPlayer';
import type { VideoQueue } from '../hooks/usePlayer';

const VIDEO_TYPES = new Set(['music-videos', 'library-music-videos']);

export function isVideoTrack(type: string): boolean {
  return VIDEO_TYPES.has(type);
}

export function getCatalogId(track: PlaylistTrack): string {
  return (
    track.relationships?.catalog?.data?.[0]?.id ??
    track.attributes?.playParams?.catalogId ??
    track.id
  );
}

export function trackToTrackInfo(track: PlaylistTrack, index: number): TrackInfo {
  return {
    id: getCatalogId(track),
    title: track.attributes?.name ?? null,
    artistName: track.attributes?.artistName ?? null,
    albumTitle: track.attributes?.albumName ?? null,
    artworkUrl: track.attributes?.artwork?.url ?? null,
    duration: track.attributes?.durationInMillis ?? 0,
    trackIndex: index,
    kind: isVideoTrack(track.type) ? 'musicVideo' : 'song',
  };
}

export function buildVideoQueue(tracks: PlaylistTrack[], selectedId: string): VideoQueue {
  const videoTracks = tracks.filter(t => isVideoTrack(t.type));
  const startIndex = Math.max(0, videoTracks.findIndex(t => t.id === selectedId));
  return {
    ids: videoTracks.map(getCatalogId),
    startIndex,
    tracks: videoTracks.map(t => ({
      id: getCatalogId(t),
      title: t.attributes?.name ?? null,
      artistName: t.attributes?.artistName ?? null,
      artworkUrl: t.attributes?.artwork?.url ?? null,
    })),
  };
}

export function buildSongTracks(tracks: PlaylistTrack[], selectedId: string): { tracks: TrackInfo[]; startIndex: number } {
  const songTracks = tracks.filter(t => !isVideoTrack(t.type));
  const startIndex = Math.max(0, songTracks.findIndex(t => t.id === selectedId));
  return { tracks: songTracks.map(trackToTrackInfo), startIndex };
}
