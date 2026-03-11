import {createContext, useContext} from 'react';
import type {RecommendationContent} from '../types/recommendations';

type ContentNavigationContextValue = {
  pushContent: (content: RecommendationContent) => void;
  openNowPlayingFullscreen: () => void;
};

export const ContentNavigationContext =
  createContext<ContentNavigationContextValue>({
    pushContent: () => {},
    openNowPlayingFullscreen: () => {},
  });

export function useContentNavigation() {
  return useContext(ContentNavigationContext);
}
