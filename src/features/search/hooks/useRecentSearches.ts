import { useCallback, useState, useEffect } from 'react';
import { createMMKV } from 'react-native-mmkv';
import type { SearchResultItem } from '../../../types/search';

const storage = createMMKV();
const RECENT_SEARCHES_KEY = 'recent_searches_v1';
const MAX_RECENT_SEARCHES = 20;

export function clearRecentSearchesGlobal() {
  storage.remove(RECENT_SEARCHES_KEY);
}

export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<SearchResultItem[]>([]);

  // Load initial value
  useEffect(() => {
    try {
      const stored = storage.getString(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Failed to parse recent searches from MMKV:', e);
    }
  }, []);

  const addRecentSearch = useCallback((item: SearchResultItem) => {
    setRecentSearches(prev => {
      // Remove the item if it already exists to move it to the front
      const filtered = prev.filter(
        i => i.id !== item.id || i.type !== item.type
      );
      
      const updated = [item, ...filtered].slice(0, MAX_RECENT_SEARCHES);
      
      try {
        storage.set(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save recent searches to MMKV:', e);
      }
      
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    clearRecentSearchesGlobal();
    setRecentSearches([]);
  }, []);

  return {
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
  };
}
