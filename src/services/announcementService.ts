import axios from 'axios';
import { createMMKV } from 'react-native-mmkv';
import { ANNOUNCEMENTS_URL } from '../constants/announcementInfo';

export interface Announcement {
  id: string;
  title: string;
  body: string;
}

const storage = createMMKV({ id: 'announcement-storage' });
const READ_IDS_KEY = 'read_announcement_ids';

function getReadIds(): string[] {
  const raw = storage.getString(READ_IDS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveReadIds(ids: string[]): void {
  storage.set(READ_IDS_KEY, JSON.stringify(ids));
}

export const AnnouncementService = {
  async fetchAnnouncements(): Promise<Announcement[]> {
    try {
      const response = await axios.get<{ announcements?: Announcement[] }>(
        `${ANNOUNCEMENTS_URL}?t=${Date.now()}`,
        { timeout: 5000 },
      );
      return Array.isArray(response.data.announcements) ? response.data.announcements : [];
    } catch (error) {
      console.warn('[AnnouncementService] Fetch failed:', error);
      return [];
    }
  },

  getUnreadAnnouncements(announcements: Announcement[]): Announcement[] {
    const readIds = getReadIds();
    return announcements.filter(a => !readIds.includes(a.id));
  },

  getReadIds,

  markAsRead(id: string): void {
    const readIds = getReadIds();
    if (!readIds.includes(id)) {
      saveReadIds([...readIds, id]);
    }
  },
};
