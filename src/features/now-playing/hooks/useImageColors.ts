import {useEffect, useState} from 'react';
import {
  getImageColors,
  type ImageColorsPalette,
} from '../imageColors';

const cache = new Map<string, ImageColorsPalette>();

export function useImageColors(uri: string | null | undefined) {
  const [colors, setColors] = useState<ImageColorsPalette | null>(
    uri ? cache.get(uri) ?? null : null,
  );

  useEffect(() => {
    if (!uri) {
      setColors(null);
      return;
    }

    const cached = cache.get(uri);
    if (cached) {
      setColors(cached);
      return;
    }

    let cancelled = false;
    getImageColors(uri).then(result => {
      if (cancelled) return;
      if (result) {
        cache.set(uri, result);
        setColors(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  return colors;
}
