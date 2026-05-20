package com.adg.airtune.unityads

import android.app.Activity
import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.unity3d.ads.IUnityAdsInitializationListener
import com.unity3d.ads.IUnityAdsLoadListener
import com.unity3d.ads.IUnityAdsShowListener
import com.unity3d.ads.UnityAds
import com.unity3d.ads.UnityAdsShowOptions
import com.unity3d.ads.metadata.MetaData

class UnityAdsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "UnityAdsModule"

    @ReactMethod
    fun initialize(gameId: String, testMode: Boolean, promise: Promise) {
        val activity = reactContext.currentActivity as? Activity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No activity available for Unity Ads initialization.")
            return
        }
        Handler(Looper.getMainLooper()).post {
            val gdprMetaData = MetaData(activity)
            gdprMetaData.set("gdpr.consent", true)
            gdprMetaData.commit()
            UnityAds.initialize(
                activity,
                gameId,
                testMode,
                object : IUnityAdsInitializationListener {
                    override fun onInitializationComplete() {
                        promise.resolve(null)
                    }

                    override fun onInitializationFailed(
                        error: UnityAds.UnityAdsInitializationError,
                        message: String,
                    ) {
                        promise.reject("INIT_FAILED", message)
                    }
                },
            )
        }
    }

    @ReactMethod
    fun showRewardedAd(adUnitId: String, promise: Promise) {
        Handler(Looper.getMainLooper()).post { doLoadAndShow(adUnitId, promise) }
    }

    private fun doLoadAndShow(adUnitId: String, promise: Promise) {
        UnityAds.load(
            adUnitId,
            object : IUnityAdsLoadListener {
                override fun onUnityAdsAdLoaded(placementId: String) {
                    val activity = reactContext.currentActivity as? Activity
                    if (activity == null) {
                        promise.reject("NO_ACTIVITY", "No activity available to show ad.")
                        return
                    }
                    UnityAds.show(
                        activity,
                        adUnitId,
                        UnityAdsShowOptions(),
                        object : IUnityAdsShowListener {
                            override fun onUnityAdsShowFailure(
                                placementId: String,
                                error: UnityAds.UnityAdsShowError,
                                message: String,
                            ) {
                                promise.reject("SHOW_FAILED", message)
                            }

                            override fun onUnityAdsShowStart(placementId: String) {}

                            override fun onUnityAdsShowClick(placementId: String) {}

                            override fun onUnityAdsShowComplete(
                                placementId: String,
                                state: UnityAds.UnityAdsShowCompletionState,
                            ) {
                                promise.resolve(true)
                            }
                        },
                    )
                }

                override fun onUnityAdsFailedToLoad(
                    placementId: String,
                    error: UnityAds.UnityAdsLoadError,
                    message: String,
                ) {
                    android.util.Log.e("UnityAdsModule", "onUnityAdsFailedToLoad: placementId=$placementId error=$error message=$message")
                    promise.reject("LOAD_FAILED", message)
                }
            },
        )
    }
}
