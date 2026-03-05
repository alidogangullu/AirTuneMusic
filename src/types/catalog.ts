// Apple Music catalog resource types (detail responses)

// ── Playlist Detail ─────────────────────────────────────────────

export type PlaylistTrack = {
  id: string;
  type: 'songs';
  href?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    durationInMillis?: number;
    artwork?: {url: string; width?: number; height?: number; bgColor?: string};
    playParams?: {id: string; kind: string};
    previews?: {url: string}[];
    trackNumber?: number;
    releaseDate?: string;
    genreNames?: string[];
    hasLyrics?: boolean;
  };
};

export type PlaylistDetail = {
  id: string;
  type: 'playlists';
  href?: string;
  attributes?: {
    name?: string;
    curatorName?: string;
    description?: {standard?: string; short?: string};
    artwork?: {
      url: string;
      width?: number;
      height?: number;
      bgColor?: string;
      textColor1?: string;
    };
    lastModifiedDate?: string;
    playlistType?: string;
    url?: string;
    playParams?: {id: string; kind: string; versionHash?: string};
    isChart?: boolean;
  };
  relationships?: {
    tracks?: {href?: string; data: PlaylistTrack[]};
    curator?: {href?: string; data: unknown[]};
  };
};

export type PlaylistDetailResponse = {
  data: PlaylistDetail[];
};

// ── Album Detail ────────────────────────────────────────────────

export type AlbumDetail = {
  id: string;
  type: 'albums';
  href?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    artwork?: {
      url: string;
      width?: number;
      height?: number;
      bgColor?: string;
      textColor1?: string;
    };
    releaseDate?: string;
    trackCount?: number;
    copyright?: string;
    recordLabel?: string;
    genreNames?: string[];
    isSingle?: boolean;
    isComplete?: boolean;
    url?: string;
    playParams?: {id: string; kind: string};
  };
  relationships?: {
    tracks?: {href?: string; data: PlaylistTrack[]};
    artists?: {href?: string; data: unknown[]};
  };
};

export type AlbumDetailResponse = {
  data: AlbumDetail[];
};

// ── Station Detail ──────────────────────────────────────────────

export type StationDetail = {
  id: string;
  type: 'stations';
  href?: string;
  attributes?: {
    name?: string;
    artwork?: {
      url: string;
      width?: number;
      height?: number;
      bgColor?: string;
      textColor1?: string;
    };
    isLive?: boolean;
    mediaKind?: string;
    url?: string;
    playParams?: {
      id: string;
      kind: string;
      format?: string;
      hasDrm?: boolean;
      mediaType?: number;
      stationHash?: string;
    };
  };
};

export type StationDetailResponse = {
  data: StationDetail[];
};

// ── Song Detail ─────────────────────────────────────────────────

export type SongDetail = {
  id: string;
  type: 'songs';
  href?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    albumName?: string;
    durationInMillis?: number;
    artwork?: {
      url: string;
      width?: number;
      height?: number;
      bgColor?: string;
      textColor1?: string;
    };
    genreNames?: string[];
    releaseDate?: string;
    hasLyrics?: boolean;
    trackNumber?: number;
    discNumber?: number;
    composerName?: string;
    isrc?: string;
    url?: string;
    previews?: {url: string}[];
    playParams?: {id: string; kind: string};
  };
  relationships?: {
    albums?: {href?: string; data: {id: string; type: string; href?: string}[]};
    artists?: {href?: string; data: {id: string; type: string; href?: string}[]};
  };
};

export type SongDetailResponse = {
  data: SongDetail[];
};

// ── Music Video Detail ──────────────────────────────────────────

export type MusicVideoDetail = {
  id: string;
  type: 'music-videos';
  href?: string;
  attributes?: {
    name?: string;
    artistName?: string;
    artwork?: {
      url: string;
      width?: number;
      height?: number;
      bgColor?: string;
      textColor1?: string;
    };
    durationInMillis?: number;
    genreNames?: string[];
    releaseDate?: string;
    has4K?: boolean;
    hasHDR?: boolean;
    isrc?: string;
    url?: string;
    previews?: {
      url?: string;
      hlsUrl?: string;
      artwork?: {url: string; width?: number; height?: number};
    }[];
    playParams?: {id: string; kind: string};
  };
  relationships?: {
    albums?: {href?: string; data: unknown[]};
    artists?: {href?: string; data: {id: string; type: string; href?: string}[]};
  };
};

export type MusicVideoDetailResponse = {
  data: MusicVideoDetail[];
};

// ── Unified content detail ──────────────────────────────────────

export type ContentDetailItem =
  | PlaylistDetail
  | AlbumDetail
  | StationDetail
  | SongDetail
  | MusicVideoDetail;

export type ContentDetailResponse = {
  data: ContentDetailItem[];
};
