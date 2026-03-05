import {createContext, useContext} from 'react';
import type {RecommendationContent} from '../types/recommendations';

type ContentNavigationContextValue = {
  pushContent: (content: RecommendationContent) => void;
};

export const ContentNavigationContext =
  createContext<ContentNavigationContextValue>({
    pushContent: () => {},
  });

export function useContentNavigation() {
  return useContext(ContentNavigationContext);
}
