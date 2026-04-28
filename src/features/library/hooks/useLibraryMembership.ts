import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {
  fetchLibraryMembershipSnapshot,
  type LibraryMembershipContentType,
  type LibraryMembershipSnapshot,
} from '../api/library';
import {useMusicUserToken} from '../../../api/apple-music/musicUserToken';
import type {RecommendationContentType} from '../../../types/recommendations';

export const LIBRARY_MEMBERSHIP_QUERY_KEY = ['library-membership-snapshot'] as const;

function toMembershipType(
  contentType: RecommendationContentType,
): LibraryMembershipContentType | null {
  if (contentType === 'albums' || contentType === 'songs' || contentType === 'playlists' || contentType === 'music-videos') {
    return contentType;
  }
  return null;
}

export function isInLibrarySnapshot(
  snapshot: LibraryMembershipSnapshot | undefined,
  contentType: RecommendationContentType,
  contentId: string,
): boolean {
  const membershipType = toMembershipType(contentType);
  if (!snapshot || !membershipType) {
    return false;
  }
  return snapshot[membershipType].ids.includes(contentId);
}

export function getLibraryIdFromSnapshot(
  snapshot: LibraryMembershipSnapshot | undefined,
  contentType: RecommendationContentType,
  contentId: string,
): string | undefined {
  const membershipType = toMembershipType(contentType);
  if (!snapshot || !membershipType) {
    return undefined;
  }

  const entry = snapshot[membershipType];
  if (entry.catalogToLibrary[contentId]) {
    return entry.catalogToLibrary[contentId];
  }

  if (entry.ids.includes(contentId)) {
    return contentId;
  }

  return undefined;
}

export function useLibraryMembershipSnapshot() {
  const token = useMusicUserToken();
  const hasUserToken = !!token;

  return useQuery<LibraryMembershipSnapshot, Error>({
    queryKey: LIBRARY_MEMBERSHIP_QUERY_KEY,
    queryFn: () => fetchLibraryMembershipSnapshot(),
    enabled: hasUserToken,
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    retry: 1,
  });
}

export function useLibraryMembership(
  contentType: RecommendationContentType,
  contentId: string,
): {inLibrary: boolean; loading: boolean; libraryId?: string} {
  const {data, isLoading, isFetching} = useLibraryMembershipSnapshot();

  const inLibrary = useMemo(
    () => isInLibrarySnapshot(data, contentType, contentId),
    [data, contentType, contentId],
  );

  const membershipType = toMembershipType(contentType);
  const libraryId = useMemo(
    () => getLibraryIdFromSnapshot(data, contentType, contentId),
    [data, contentType, contentId],
  );
  const loading = !!membershipType && (isLoading || (isFetching && !data));

  return {inLibrary, loading, libraryId};
}
