import {NativeModules} from 'react-native';

const {ImageColors} = NativeModules;

export interface ImageColorsPalette {
  dominant: string;
  vibrant: string;
  darkVibrant: string;
  lightVibrant: string;
  muted: string;
  darkMuted: string;
  lightMuted: string;
}

export async function getImageColors(
  uri: string,
): Promise<ImageColorsPalette | null> {
  if (!ImageColors) {
    console.warn('[ImageColors] native module not available');
    return null;
  }
  try {
    return await ImageColors.getColors(uri);
  } catch (e) {
    console.warn('[ImageColors] extraction failed:', e);
    return null;
  }
}
