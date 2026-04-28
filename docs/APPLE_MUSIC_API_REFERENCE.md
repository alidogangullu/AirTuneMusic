# Apple Music API — Reference for AirTune Music

Single reference for request/response shapes, resource attributes, and usage. Use this when defining TypeScript types and API client code so results stay consistent with the official API.

**Official docs:** [Apple Music API](https://developer.apple.com/documentation/applemusicapi/)

---

## Base URL and paths

- **Root:** `https://api.music.apple.com/v1`
- **Catalog** (public Apple Music): `/v1/catalog/{storefront}/...` — always include storefront (e.g. `us`).
- **User library** (personal): `/v1/me/...` — requires `Music-User-Token` header.

Catalog IDs and library IDs are different; re-adding a library item gives a new ID.

---

## Authentication

### Developer token (required for all requests)

- **Header:** `Authorization: Bearer [developer token]`
- **Format:** JWT, signed with **ES256** only. Algorithm `ES256`; header must include `kid` (10-char key id) and `alg: "ES256"`.
- **Payload:** `iss` (Team ID), `iat`, `exp` (max 15777000 seconds from iat). Optional `origin` for web.
- **Rate limiting:** 429 Too Many Requests if exceeded; back off and retry.

### Music User Token (required for `/me` and user-specific data)

- **Header:** `Music-User-Token: [music user token]`
- **Platform:** On Android, automatic management is not available; use [MusicKit for Android](https://developer.apple.com/musickit/android/) docs to obtain and send this header.

Example:

```http
GET /v1/me/library/songs
Authorization: Bearer [developer token]
Music-User-Token: [music user token]
```

---

## Request query parameters

| Parameter | Purpose |
|-----------|---------|
| `extend` | Request extended attributes for the primary resource (e.g. `?extend=artistUrl`). |
| `extend[resourceType]` | Extend attributes for a specific resource type in the response (e.g. `extend[songs]=artistUrl`). |
| `include` | Include relationship resources (e.g. `?include=playlists`). |
| `include[resourceType]` | Include relationship for a specific type (e.g. `include[albums]=tracks`). |
| `relate` | Include only relationship identifiers (no full attributes). |
| `views` | Include relationship views (e.g. `?views=other-versions`, `views=featured-albums`). |
| `limit` | Page size; default varies by endpoint. |
| `offset` | Pagination offset (e.g. for `next` link). |
| `l` | Localization: language tag from storefront’s `supportedLanguageTags` (e.g. `?l=es-MX`). |

---

## Responses

### Success

- **200 OK** — Request succeeded; body has `data` and/or `results`.
- **201 Created** — Creation succeeded.
- **202 Accepted** — Modification accepted, may not be complete.
- **204 No Content** — Modification succeeded; no body.
- **Relationship/collection:** `data` is an array of resources; optional `next` for more (pagination).
- **Results (e.g. search, charts):** Top-level `results` object; structure is endpoint-specific.
- **Empty result:** 200 with empty `data` when requesting by IDs and none exist.
- **Single resource missing:** 404; no `data` array.

### Errors

- Response contains `errors` array of error objects.
- **401 Unauthorized** — Developer token missing or invalid.
- **403 Forbidden** — Music user token issue or wrong authentication.
- **404 Not Found** — Single resource does not exist.
- **429 Too Many Requests** — Rate limited; retry after backoff.

### HTTP status code reference

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 202 | Accepted |
| 204 | No Content |
| 301 | Moved Permanently |
| 302 | Found |
| 400 | Bad Request |
| 401 | Unauthorized (developer token) |
| 403 | Forbidden (music user token / auth) |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 409 | Conflict |
| 413 | Payload Too Large |
| 414 | URI Too Long |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 501 | Not Implemented |
| 503 | Service Unavailable |

---

## Pagination

- Responses may include `next` (subpath or URL) for the next page.
- Use `limit` to set page size; use `offset` (or the URL in `next`) for the next request.
- Relationship objects may have `next` for relationship-specific pagination.

Example: `GET /v1/storefronts?limit=2` → response includes `"next": "/v1/storefronts?offset=2"`.

---

## Resource structure (common)

Every resource object can have:

- **id** — string
- **type** — string (e.g. `albums`, `songs`, `artists`, `playlists`)
- **href** — string (path or URL)
- **attributes** — object (see per-type attributes below)
- **relationships** — object (optional; keys are relationship names, values have `data` array and optionally `href`, `next`)
- **meta** — optional

---

## Common nested objects

### Artwork

```ts
{
  width: number;
  height: number;
  url: string;  // template with {w}, {h} e.g. ".../{w}x{h}bb.jpg"
  bgColor?: string;   // hex without #
  textColor1?: string;
  textColor2?: string;
  textColor3?: string;
  textColor4?: string;
}
```

### PlayParams (playback hint)

```ts
{
  id: string;
  kind: string;  // e.g. "song", "album"
}
```

### EditorialNotes

```ts
{
  standard?: string;
  short?: string;
}
```

### Preview (audio preview)

```ts
{
  url: string;
}
```

---

## Resource types and attributes

Use these when defining TypeScript interfaces for API responses.

### Artists (catalog)

- **attributes:** `name`, `genreNames` (string[]), `artwork` (Artwork), `url` (string).

### Songs (catalog)

- **attributes:**  
  `name`, `artistName`, `albumName`, `genreNames` (string[]), `trackNumber`, `discNumber`, `releaseDate` (YYYY-MM-DD), `durationInMillis`, `isrc`, `artwork` (Artwork), `url`, `playParams` (PlayParams), `previews` (Preview[]), `hasLyrics` (boolean), `isAppleDigitalMaster` (boolean), `composerName` (optional).

### Albums (catalog)

- **attributes:**  
  `name`, `artistName`, `genreNames` (string[]), `releaseDate`, `trackCount`, `isCompilation`, `isSingle`, `artwork` (Artwork), `url`, `playParams` (PlayParams), `copyright`, `recordLabel`, `upc`, `isMasteredForItunes`, `editorialNotes` (EditorialNotes), `isComplete` (boolean).

### Playlists (catalog)

- **attributes:** `name`, `curatorName`, `description` (EditorialNotes), `artwork` (Artwork), `lastModifiedDate`, `playlistType`, `url`, `playParams` (PlayParams), `isChart` (boolean).
- **relationships:** `tracks` (array of Song resources), `curator`.
- **Fetch with tracks:** `GET /v1/catalog/{storefront}/playlists/{id}?include=tracks`

### Stations (catalog)

- **attributes:** `name`, `artwork` (Artwork), `url`, `playParams` (PlayParams), `durationInMillis`, `episodeNumber`, `mediaKind` (`'audio' | 'video'`), `isLive` (boolean), `notes` (EditorialNotes).
- **Fetch:** `GET /v1/catalog/{storefront}/stations/{id}`
- Stations do **not** have a tracks relationship. Duration/episodeNumber appear for radio episodes; live stations have `isLive: true`.

### Music Videos (catalog)

- **attributes:** `name`, `artistName`, `artwork` (Artwork), `durationInMillis`, `genreNames` (string[]), `releaseDate`, `has4K` (boolean), `hasHDR` (boolean), `isrc`, `url`, `previews` (array of `{url?, hlsUrl?, artwork?}`), `playParams` (PlayParams).
- **relationships:** `albums`, `artists`.
- **Fetch:** `GET /v1/catalog/{storefront}/music-videos/{id}`

### Storefronts

- **attributes:** `name`, `defaultLanguageTag`, `supportedLanguageTags` (string[]).

---

## Endpoints used in this app

| Function | Method + Path | Auth required |
|----------|---------------|---------------|
| `fetchRecommendations` | `GET /v1/me/recommendations` | Developer + User token |
| `fetchPlaylistDetail` | `GET /v1/catalog/{sf}/playlists/{id}?include=tracks` | Developer token |
| `fetchAlbumDetail` | `GET /v1/catalog/{sf}/albums/{id}?include=tracks` | Developer token |
| `fetchStationDetail` | `GET /v1/catalog/{sf}/stations/{id}` | Developer token |
| `fetchSongDetail` | `GET /v1/catalog/{sf}/songs/{id}` | Developer token |
| `fetchMusicVideoDetail` | `GET /v1/catalog/{sf}/music-videos/{id}` | Developer token |

All functions live in `src/features/recommendations/api/recommendations.ts`.

### TypeScript types (`src/types/recommendations.ts`)

| Type | Corresponds to |
|------|----------------|
| `PlaylistDetail` | `/catalog/{sf}/playlists/{id}` resource |
| `AlbumDetail` | `/catalog/{sf}/albums/{id}` resource |
| `StationDetail` | `/catalog/{sf}/stations/{id}` resource |
| `SongDetail` | `/catalog/{sf}/songs/{id}` resource |
| `MusicVideoDetail` | `/catalog/{sf}/music-videos/{id}` resource |
| `ContentDetailItem` | Union of all 5 types above |
| `ContentDetailResponse` | `{ data: ContentDetailItem[] }` |
| `RecommendationContentType` | `'playlists' \| 'albums' \| 'stations' \| 'music-videos' \| 'songs'` |
| `RecommendationContent` | Single item inside a recommendation row |
| `PersonalRecommendation` | One row returned by `/me/recommendations` |

Use `useContentDetail(id, type, storefront)` (`src/features/content/hooks/useContentDetail.ts`) to fetch and cache any content type via TanStack Query. The hook dispatches to the correct fetch function based on `type`.

---

## Relationships (common patterns)

- **Albums:** `artists`, `tracks`, `genres`, `recordLabels`; views e.g. `other-versions`.
- **Artists:** `albums`, `playlists`, `music-videos`; views e.g. `featured-playlists`, `similar-artists`.
- **Songs:** `artists`, `album`.
- Fetch relationship directly: `GET .../albums/{id}/tracks`.  
- Fetch relationship view: `GET .../artists/{id}/view/similar-artists`. Use `with` for view attributes, `limit` for page size.

---

## Search (catalog)

- **Endpoint:** `GET /v1/catalog/{storefront}/search`
- **Query:** `term` (search string), `types` (comma-separated: e.g. `songs`, `albums`, `artists`), optional `limit`, `offset`.
- **Response:** Top-level `results`; each key is a type (e.g. `songs`, `albums`, `artists`). Each value has `data` (array of resources), `href`, and optionally `next`.

Example:  
`GET /v1/catalog/us/search?types=songs,albums,artists&term=beach+bunny`

---

## Storefronts and localization

- Catalog requests use a storefront in the path (e.g. `us`).
- Use `l` with a value from the storefront’s `supportedLanguageTags` to get localized content (e.g. `?l=es-MX`).
- Endpoints: get storefront(s) via `/v1/storefronts`, `/v1/storefronts/{id}`, or get all storefronts.

---

## Error object

- **errors** array elements: `id`, `status` (HTTP status string or code), `code`, `title`, `detail`, `source` (optional; e.g. `parameter`, `pointer`).

---

## Endpoint quick reference

| Area | Example |
|------|---------|
| Catalog album | `GET /v1/catalog/{storefront}/albums/{id}` |
| Catalog album tracks | `GET /v1/catalog/{storefront}/albums/{id}/tracks` |
| Catalog song | `GET /v1/catalog/{storefront}/songs/{id}` |
| Catalog artist | `GET /v1/catalog/{storefront}/artists/{id}` |
| Catalog artist view | `GET /v1/catalog/{storefront}/artists/{id}/view/similar-artists` |
| Search | `GET /v1/catalog/{storefront}/search?term=...&types=songs,albums,artists` |
| Charts | `GET /v1/catalog/{storefront}/charts` |
| User library songs | `GET /v1/me/library/songs` (requires Music-User-Token) |
| User library albums | `GET /v1/me/library/albums` |
| Storefronts | `GET /v1/storefronts` or `GET /v1/storefronts/{id}` |

When defining types in `src/api/apple-music/` or `src/types/`, align field names and shapes with this document and the [Apple Music API](https://developer.apple.com/documentation/applemusicapi/) for any additional resource types or attributes.
