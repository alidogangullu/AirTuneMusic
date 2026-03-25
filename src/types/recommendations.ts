// Apple Music recommendation types
// Catalog resource types (PlaylistDetail, AlbumDetail, etc.) live in src/types/catalog.ts

// ── Recommendations ─────────────────────────────────────────────

export type RecommendationContentType =
  | 'playlists'
  | 'albums'
  | 'artists'
  | 'stations'
  | 'music-videos'
  | 'songs';

export type RecommendationContent = {
  id: string;
  type: RecommendationContentType;
  attributes?: {
    name?: string;
    artistName?: string;
    artwork?: {
      url: string;
      width?: number;
      height?: number;
    };
    url?: string;
    releaseDate?: string;
    dateAdded?: string;
    genreNames?: string[];
    editorialNotes?: {short?: string};
  };
};

export type PersonalRecommendation = {
  id: string;
  type: 'personal-recommendation';
  attributes?: {
    title?: { stringForDisplay: string; contentIds?: string[] };
    resourceTypes?: string[];
    kind?: string;
  };
  relationships?: {
    contents?: {
      data: RecommendationContent[];
    };
  };
};

export type RecommendationsResponse = {
  data: PersonalRecommendation[];
};
