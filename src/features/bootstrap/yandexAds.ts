import { MobileAds } from 'yandex-mobile-ads';

let initPromise: Promise<void> | null = null;

export async function initializeYandexAds(): Promise<void> {
  if (initPromise !== null) {
    return initPromise;
  }

  const promise = MobileAds.initialize()
    .then(() => undefined)
    .catch((error: unknown) => {
      initPromise = null;
      throw error;
    });

  initPromise = promise;
  return promise;
}
