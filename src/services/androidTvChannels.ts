import { NativeModules, Platform } from 'react-native';
import type { RecommendationSection } from '../features/recommendations/hooks/useRecommendations';
import type { RecommendationContent } from '../types/recommendations';

const { AndroidTVChannelsModule } = NativeModules;

export interface TvProgramItem {
  id: string;
  title: string;
  subtitle?: string;
  artworkUrl?: string;
  deepLinkUri: string;
}

/**
 * Format artwork URL template ({w}x{h}) to standard dimensions (e.g. 500x500).
 */
function getArtworkUrl(artwork?: { url: string }, width = 500, height = 500): string {
  if (!artwork?.url) return '';
  return artwork.url.replace('{w}', width.toString()).replace('{h}', height.toString());
}

/**
 * Helper to build TV program items from recommendation content objects.
 */
function mapContentToTvPrograms(contents: RecommendationContent[]): TvProgramItem[] {
  return contents.slice(0, 15).map(item => {
    const title =
      item.attributes?.name ??
      (item.attributes as any)?.title?.stringForDisplay ??
      (item.attributes as any)?.artistName ??
      'AirTune';

    const subtitle = item.attributes?.artistName ?? item.type ?? '';
    const artworkUrl = getArtworkUrl(item.attributes?.artwork);
    const deepLinkUri = `airtune://play?type=${item.type}&id=${item.id}`;

    return {
      id: item.id,
      title,
      subtitle,
      artworkUrl,
      deepLinkUri,
    };
  });
}

export const AndroidTvChannels = {
  /**
   * Check if Android TV channels are supported on the current platform.
   */
  isSupported(): boolean {
    return Platform.OS === 'android' && Boolean(AndroidTVChannelsModule);
  },

  /**
   * Publish or update a channel on the Android TV home screen.
   */
  async publishChannel(
    channelKey: string,
    channelTitle: string,
    items: TvProgramItem[]
  ): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      await AndroidTVChannelsModule.publishChannel(channelKey, channelTitle, items);
      return true;
    } catch (error) {
      console.error(`[AndroidTvChannels] Failed to publish channel ${channelKey}:`, error);
      return false;
    }
  },

  /**
   * Remove a channel from Android TV home screen.
   */
  async removeChannel(channelKey: string): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      await AndroidTVChannelsModule.removeChannel(channelKey);
      return true;
    } catch (error) {
      console.error(`[AndroidTvChannels] Failed to remove channel ${channelKey}:`, error);
      return false;
    }
  },

  /**
   * Synchronize Home Screen Recommendation Sections to Android TV Channels.
   */
  async syncRecommendationSections(sections: RecommendationSection[]): Promise<void> {
    if (!this.isSupported()) return;

    for (const section of sections) {
      if (!section.contents || section.contents.length === 0) continue;

      const title = section.title;
      const programs = mapContentToTvPrograms(section.contents);
      if (programs.length === 0) continue;

      let channelKey: string | null = null;
      const lowerTitle = section.title.toLowerCase();

      if (
        section.id?.startsWith('7-') ||
        section.kind === 'recently-played' ||
        lowerTitle.includes('recently') ||
        lowerTitle.includes('son oynatılan') ||
        lowerTitle.includes('son dinlenen') ||
        lowerTitle.includes('son çalınan')
      ) {
        channelKey = 'RECENTLY_PLAYED';
      } else if (
        section.id?.startsWith('6-') ||
        section.kind === 'made-for-you' ||
        lowerTitle.includes('made for you') ||
        lowerTitle.includes('sizin için') ||
        lowerTitle.includes('sana özel') ||
        lowerTitle.includes('kişisel')
      ) {
        channelKey = 'MADE_FOR_YOU';
      } else if (
        section.id?.startsWith('9-') ||
        lowerTitle.includes('new releases') ||
        lowerTitle.includes('yeni çıkan') ||
        lowerTitle.includes('yeni yayın')
      ) {
        channelKey = 'NEW_RELEASES';
      }

      // Strictly filter and only publish the 3 requested TV channels
      if (!channelKey) continue;

      await this.publishChannel(channelKey, title, programs);
    }
  },
};
