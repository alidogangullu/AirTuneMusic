type LevelPlayAppConfig = {
  levelPlay?: {
    appKey?: string;
    rewardedAdUnitId?: string;
    rewardedPlacementName?: string;
  };
  'unity-levelplay-mediation'?: {
    app_key?: string;
    rewarded_ad_unit_id?: string;
    rewarded_placement_name?: string;
  };
};

const appConfig = require('../../app.json') as LevelPlayAppConfig;

const levelPlayConfig =
  appConfig.levelPlay ??
  (appConfig['unity-levelplay-mediation']
    ? {
        appKey: appConfig['unity-levelplay-mediation'].app_key,
        rewardedAdUnitId: appConfig['unity-levelplay-mediation'].rewarded_ad_unit_id,
        rewardedPlacementName: appConfig['unity-levelplay-mediation'].rewarded_placement_name,
      }
    : undefined) ??
  {};

export const LEVELPLAY_APP_KEY = levelPlayConfig.appKey ?? '';
export const LEVELPLAY_REWARDED_AD_UNIT_ID = levelPlayConfig.rewardedAdUnitId ?? '';
export const LEVELPLAY_REWARDED_PLACEMENT_NAME = levelPlayConfig.rewardedPlacementName ?? '';
