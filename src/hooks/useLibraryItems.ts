import {useInfiniteQuery} from '@tanstack/react-query';
import {fetchLibraryItems} from '../api/apple-music/library';
import type {LibraryCategoryId, LibraryResponse} from '../types/library';

const QUERY_KEY = 'library-items';

function extractOffset(nextPath: string | undefined): string | undefined {
  if (!nextPath) return undefined;
  const match = /offset=(\d+)/.exec(nextPath);
  return match?.[1];
}

export function useLibraryInfiniteItems(category: LibraryCategoryId, limit = 25) {
  return useInfiniteQuery<LibraryResponse, Error>({
    queryKey: [QUERY_KEY, category],
    queryFn: ({pageParam}) => fetchLibraryItems(category, limit, pageParam as string | undefined),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => extractOffset(lastPage.next),
    select: (data) => ({
      ...data,
      pages: data.pages.map(page => ({
        ...page,
        data: category === 'music-videos'
          ? page.data
          : page.data.filter(item =>
              item.type !== 'library-music-videos' &&
              item.attributes?.name !== 'Unknown Album'
            ),
      })),
    }),
  });
}
