// Apple Music Library types
// All /v1/me/library/* endpoints return these resource types.

export type LibraryArtwork = {
  url: string;
  width?: number;
  height?: number;
};

export type LibraryItem = {
  id: string;
  type: 'library-albums' | 'library-playlists' | 'library-artists' | 'library-songs' | 'library-music-videos';
  href?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    artwork?: LibraryArtwork;
    trackNumber?: number;
    genreNames?: string[];
    dateAdded?: string;
    releaseDate?: string;
    durationInMillis?: number;
    playParams?: {id: string; kind: string; catalogId?: string};
    contentRating?: string;
  };
  relationships?: {
    catalog?: {
      data?: any[];
    };
  };
};

export type LibraryResponse = {
  data: LibraryItem[];
  next?: string;
};

/** Sidebar categories that map to API endpoints */
export type LibraryCategoryId =
  | 'recently-added'
  | 'playlists'
  | 'artists'
  | 'albums'
  | 'songs'
  | 'music-videos';
