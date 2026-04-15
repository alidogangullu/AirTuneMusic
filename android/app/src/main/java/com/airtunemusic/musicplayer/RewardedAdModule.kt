package com.airtunemusic.musicplayer

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class RewardedAdModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    companion object {
        const val NAME = "RewardedAdModule"
        private const val REQUEST_CODE_REWARDED_AD = 9043
    }

    private var pendingPromise: Promise? = null

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = NAME

    @ReactMethod
    fun showRewardedAd(adTagUrl: String?, promise: Promise) {
        if (pendingPromise != null) {
            promise.reject("AD_IN_PROGRESS", "A rewarded ad is already in progress.")
            return
        }

        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("ACTIVITY_UNAVAILABLE", "No active Activity to show rewarded ad.")
            return
        }

        val intent = Intent(activity, RewardedAdActivity::class.java)
        if (!adTagUrl.isNullOrBlank()) {
            intent.putExtra(RewardedAdActivity.EXTRA_AD_TAG_URL, adTagUrl)
        }

        pendingPromise = promise
        activity.startActivityForResult(intent, REQUEST_CODE_REWARDED_AD)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != REQUEST_CODE_REWARDED_AD) {
            return
        }

        val promise = pendingPromise ?: return
        pendingPromise = null

        val granted = data?.getBooleanExtra(RewardedAdActivity.EXTRA_REWARD_GRANTED, false) == true
        if (resultCode == Activity.RESULT_OK && granted) {
            promise.resolve(true)
            return
        }

        val errorMessage =
            data?.getStringExtra(RewardedAdActivity.EXTRA_ERROR_MESSAGE)
                ?: "Ad was not completed."
        promise.reject("AD_NOT_COMPLETED", errorMessage)
    }

    override fun onNewIntent(intent: Intent) {
        // No-op.
    }
}
