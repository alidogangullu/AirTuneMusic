/**
 * Apple Music API HTTP client.
 * All requests: Authorization: Bearer <developer token>.
 * Requests to /me/: also Music-User-Token if the user has signed in (startAppleMusicAuth).
 * Response interceptor: central error handling and 401/403 token cleanup.
 */

import axios, {AxiosError, AxiosInstance} from 'axios';
import {getDeveloperToken} from './getDeveloperToken';
import {clearMusicUserToken, getMusicUserToken} from './musicUserToken';

const APPLE_MUSIC_BASE = 'https://api.music.apple.com/v1';
/** Emulator'da api.music.apple.com erişilemediği için __DEV__'de proxy kullan. */
const PROXY_BASE = 'http://10.0.2.2:8080/api/apple-music-proxy';
const BASE_URL = __DEV__ ? PROXY_BASE : APPLE_MUSIC_BASE;

function createClient(): AxiosInstance {
  const client = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  client.interceptors.request.use(async config => {
    const devToken = await getDeveloperToken();
    config.headers.Authorization = `Bearer ${devToken}`;

    const url = config.url ?? '';
    if (url.includes('/me/')) {
      const musicUserToken = getMusicUserToken();
      if (musicUserToken) {
        config.headers['Music-User-Token'] = musicUserToken;
      }
    }

    return config;
  });

  client.interceptors.response.use(
    response => response,
    (error: AxiosError<{errors?: Array<{code?: string; detail?: string}>}>) => {
      const status = error.response?.status;
      const url = error.config?.url ?? '';
      const fullUrl = error.config?.baseURL
        ? `${error.config.baseURL}${url}`
        : url;
      const isMeRequest = url.includes('/me/');

      if ((status === 401 || status === 403) && isMeRequest) {
        clearMusicUserToken();
      }

      const apiMessage =
        error.response?.data?.errors?.[0]?.detail ??
        error.response?.data?.errors?.[0]?.code;
      if (apiMessage && error.message !== apiMessage) {
        error.message = `Apple Music API ${status ?? 'error'}: ${apiMessage}`;
      }

      if (__DEV__) {
        // Network errors: no response, log code + URL for debugging
        const details =
          !error.response && error.code
            ? ` [${error.code}] ${fullUrl}`
            : ` ${status ?? 'no-status'} ${url}`;
        console.warn('[Apple Music API]', error.message, details);
      }

      return Promise.reject(error);
    },
  );

  return client;
}

export const appleMusicApi = createClient();
