/**
 * Apple Music API HTTP client.
 * All requests: Authorization: Bearer <developer token>.
 * Requests to /me/: also Music-User-Token if the user has signed in (startAppleMusicAuth).
 * Response interceptor: central error handling and 401/403 token cleanup.
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { getDeveloperToken } from './getDeveloperToken';
import { getMusicUserToken } from './musicUserToken';
import i18n from '../../i18n';

const APPLE_MUSIC_BASE = 'https://api.music.apple.com/v1';

function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: APPLE_MUSIC_BASE,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use(async config => {
    const devToken = await getDeveloperToken();
    config.headers.Authorization = `Bearer ${devToken}`;

    const url = config.url ?? '';
    const isPersonalRequest = url.includes('filter[identity]=personal') || config.params?.['filter[identity]'] === 'personal';
    
    if (url.includes('/me/') || isPersonalRequest) {
      const musicUserToken = getMusicUserToken();
      if (musicUserToken) {
        config.headers['Music-User-Token'] = musicUserToken;
      }
    }

    const localeMap: Record<string, string> = {
      en: 'en-US',
      tr: 'tr',
      de: 'de',
      es: 'es',
      fr: 'fr',
    };
    const lang = localeMap[i18n.language] || 'en-US';
    config.params = { ...(config.params || {}), l: lang };

    return config;
  });

  client.interceptors.response.use(
    response => response,
    (
      error: AxiosError<{ errors?: Array<{ code?: string; detail?: string }> }>,
    ) => {
      const status = error.response?.status;
      const url = error.config?.url ?? '';
      const fullUrl = error.config?.baseURL
        ? `${error.config.baseURL}${url}`
        : url;
      const isMeRequest = url.includes('/me/');

      if ((status === 401 || status === 403) && isMeRequest) {
        // clearMusicUserToken();
        console.warn(
          `[Apple Music API] ${status} on ${url}, NOT clearing token automatically.`,
        );
      }

      const apiMessage =
        error.response?.data?.errors?.[0]?.detail ??
        error.response?.data?.errors?.[0]?.code;
      if (apiMessage && error.message !== apiMessage) {
        error.message = `Apple Music API ${status ?? 'error'}: ${apiMessage}`;
      }

      if (__DEV__) {
        const isRating404 = status === 404 && url.includes('/ratings/');
        if (!isRating404) {
          // Network errors: no response, log code + URL for debugging
          const details =
            !error.response && error.code
              ? ` [${error.code}] ${fullUrl}`
              : ` ${status ?? 'no-status'} ${url}`;
          console.warn('[Apple Music API]', error.message, details);
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}

export const appleMusicApi = createClient();
