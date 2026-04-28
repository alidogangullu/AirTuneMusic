import {useQuery} from '@tanstack/react-query';
import {fetchStorefront} from '../features/library/api/library';

interface StorefrontData {
  storefrontId: string;
  language: string;
}

/**
 * Fetches the user's storefront from /me/storefront.
 * Returns the storefront ID (e.g. "tr") and default language tag (e.g. "tr-TR").
 * Cached with a long staleTime since this rarely changes.
 */
export function useStorefront(): StorefrontData & {isLoading: boolean} {
  const {data, isLoading} = useQuery<StorefrontData>({
    queryKey: ['user-storefront'],
    queryFn: async () => {
      const res = await fetchStorefront();
      const sf = res?.data?.[0];
      return {
        storefrontId: sf?.id ?? 'us',
        language: sf?.attributes?.defaultLanguageTag ?? 'en-US',
      };
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return {
    storefrontId: data?.storefrontId ?? 'us',
    language: data?.language ?? 'en-US',
    isLoading,
  };
}
