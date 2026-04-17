package com.airtunemusic.musicplayer

import android.util.Log
import com.airtunemusic.BuildConfig
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.unity3d.mediation.LevelPlay
import com.unity3d.mediation.LevelPlayAdError
import com.unity3d.mediation.LevelPlayAdInfo
import com.unity3d.mediation.LevelPlayConfiguration
import com.unity3d.mediation.LevelPlayInitError
import com.unity3d.mediation.LevelPlayInitListener
import com.unity3d.mediation.LevelPlayInitRequest
import com.unity3d.mediation.rewarded.LevelPlayReward
import com.unity3d.mediation.rewarded.LevelPlayRewardedAd
import com.unity3d.mediation.rewarded.LevelPlayRewardedAdListener

class RewardedAdModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LevelPlayRewardedAdListener {

    companion object {
        const val NAME = "RewardedAdModule"
        private const val TAG = "RewardedAdModule"
    }

    private var rewardedAd: LevelPlayRewardedAd? = null
    private var rewardedAdUnitId: String? = null
    private var pendingPromise: Promise? = null
    private var rewardGranted = false
    private var isLoadingAd = false

    private var isInitializing = false
    private var isInitialized = false
    private val initCallbacks = mutableListOf<(Boolean, String?) -> Unit>()

    override fun getName(): String = NAME

    @ReactMethod
    fun showRewardedAd(adUnitIdOverride: String?, promise: Promise) {
        if (pendingPromise != null) {
            promise.reject("AD_IN_PROGRESS", "A rewarded ad is already in progress.")
            return
        }

        val appKey = BuildConfig.LEVELPLAY_APP_KEY
        if (appKey.isBlank()) {
            promise.reject(
                "LEVELPLAY_CONFIG_MISSING",
                "LEVELPLAY_APP_KEY is missing. Set it in .env.local.",
            )
            return
        }

        val adUnitId = adUnitIdOverride?.takeIf { it.isNotBlank() }
            ?: BuildConfig.LEVELPLAY_REWARDED_AD_UNIT_ID
        if (adUnitId.isBlank()) {
            promise.reject(
                "LEVELPLAY_CONFIG_MISSING",
                "LEVELPLAY_REWARDED_AD_UNIT_ID is missing. Set it in .env.local.",
            )
            return
        }

        pendingPromise = promise
        rewardGranted = false

        ensureSdkInitialized(appKey) { success, errorMessage ->
            if (!success) {
                rejectPending("INIT_FAILED", errorMessage ?: "LevelPlay init failed.")
                return@ensureSdkInitialized
            }

            val activity = reactContext.currentActivity
            if (activity == null) {
                rejectPending("ACTIVITY_UNAVAILABLE", "No active Activity to show rewarded ad.")
                return@ensureSdkInitialized
            }

            if (rewardedAd == null || rewardedAdUnitId != adUnitId) {
                rewardedAd = LevelPlayRewardedAd(adUnitId)
                rewardedAd?.setListener(this)
                rewardedAdUnitId = adUnitId
            }

            val ad = rewardedAd
            if (ad == null) {
                rejectPending("AD_OBJECT_ERROR", "Failed to create rewarded ad object.")
                return@ensureSdkInitialized
            }

            if (ad.isAdReady) {
                ad.showAd(activity)
                return@ensureSdkInitialized
            }

            isLoadingAd = true
            ad.loadAd()
        }
    }

    private fun ensureSdkInitialized(appKey: String, callback: (Boolean, String?) -> Unit) {
        if (isInitialized) {
            callback(true, null)
            return
        }

        initCallbacks.add(callback)
        if (isInitializing) return

        isInitializing = true

        val initRequest = LevelPlayInitRequest.Builder(appKey).build()
        LevelPlay.init(reactContext.applicationContext, initRequest, object : LevelPlayInitListener {
            override fun onInitFailed(error: LevelPlayInitError) {
                isInitializing = false
                isInitialized = false
                val callbacks = initCallbacks.toList()
                initCallbacks.clear()
                callbacks.forEach { it(false, error.errorMessage) }
            }

            override fun onInitSuccess(configuration: LevelPlayConfiguration) {
                isInitializing = false
                isInitialized = true
                val callbacks = initCallbacks.toList()
                initCallbacks.clear()
                callbacks.forEach { it(true, null) }
            }
        })
    }

    private fun resolvePending() {
        val promise = pendingPromise ?: return
        pendingPromise = null
        promise.resolve(true)
    }

    private fun rejectPending(code: String, message: String) {
        val promise = pendingPromise ?: return
        pendingPromise = null
        promise.reject(code, message)
    }

    override fun onAdLoaded(adInfo: LevelPlayAdInfo) {
        if (!isLoadingAd) return
        isLoadingAd = false

        val activity = reactContext.currentActivity
        val ad = rewardedAd
        if (activity == null || ad == null) {
            rejectPending("ACTIVITY_UNAVAILABLE", "No active Activity to show rewarded ad.")
            return
        }

        ad.showAd(activity)
    }

    override fun onAdLoadFailed(error: LevelPlayAdError) {
        isLoadingAd = false
        rejectPending("AD_LOAD_FAILED", error.errorMessage)
    }

    override fun onAdDisplayed(adInfo: LevelPlayAdInfo) {
        Log.d(TAG, "Rewarded ad displayed")
    }

    override fun onAdRewarded(reward: LevelPlayReward, adInfo: LevelPlayAdInfo) {
        rewardGranted = true
    }

    override fun onAdDisplayFailed(error: LevelPlayAdError, adInfo: LevelPlayAdInfo) {
        rejectPending("AD_DISPLAY_FAILED", error.errorMessage)
    }

    override fun onAdClicked(adInfo: LevelPlayAdInfo) {
        // Optional no-op.
    }

    override fun onAdClosed(adInfo: LevelPlayAdInfo) {
        if (rewardGranted) {
            resolvePending()
        } else {
            rejectPending("AD_SKIPPED", "Ad was not fully watched.")
        }
    }

    override fun onAdInfoChanged(adInfo: LevelPlayAdInfo) {
        // Optional no-op.
    }
}
