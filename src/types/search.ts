// Apple Music Search & Genre types

export type SearchResultItem = {
  id: string;
  type: string;
  href?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    artwork?: {url: string; width?: number; height?: number; bgColor?: string};
    url?: string;
    genreNames?: string[];
    releaseDate?: string;
    durationInMillis?: number;
    playParams?: {id: string; kind: string};
  };
};

export type SearchResultGroup = {
  href?: string;
  next?: string;
  data: SearchResultItem[];
};

export type SearchResults = {
  songs?: SearchResultGroup;
  albums?: SearchResultGroup;
  artists?: SearchResultGroup;
  playlists?: SearchResultGroup;
  'music-videos'?: SearchResultGroup;
  stations?: SearchResultGroup;
};

export type SearchResponse = {
  results: SearchResults;
};

export type SearchHintsResponse = {
  results: {
    terms: string[];
  };
};


