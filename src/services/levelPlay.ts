import { LevelPlay, LevelPlayInitRequest } from 'unity-levelplay-mediation';

import { LEVELPLAY_APP_KEY } from '../config/levelPlay';

let initPromise: Promise<void> | null = null;

export async function initializeLevelPlay(): Promise<void> {
  if (initPromise !== null) {
    return initPromise;
  }

  if (!LEVELPLAY_APP_KEY) {
    throw new Error('LevelPlay app key is missing. Add it to app.json.');
  }

  initPromise = (async () => {
    if (__DEV__) {
      await LevelPlay.setAdaptersDebug(true);
    }

    const initRequest = LevelPlayInitRequest.builder(LEVELPLAY_APP_KEY).build();

    await new Promise<void>((resolve, reject) => {
      void LevelPlay.init(initRequest, {
        onInitFailed: error => {
          reject(new Error(error.errorMessage || `LevelPlay init failed (${error.errorCode})`));
        },
        onInitSuccess: () => {
          resolve();
        },
      }).catch(reject);
    });
  })().catch(error => {
    initPromise = null;
    throw error;
  });

  return initPromise;
}
