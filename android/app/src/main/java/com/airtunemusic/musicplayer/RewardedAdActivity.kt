package com.airtunemusic.musicplayer

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.VideoView
import com.google.ads.interactivemedia.v3.api.AdErrorEvent
import com.google.ads.interactivemedia.v3.api.AdEvent
import com.google.ads.interactivemedia.v3.api.AdsLoader
import com.google.ads.interactivemedia.v3.api.AdsManager
import com.google.ads.interactivemedia.v3.api.AdsRenderingSettings
import com.google.ads.interactivemedia.v3.api.ImaSdkFactory
import com.google.ads.interactivemedia.v3.api.player.AdMediaInfo
import com.google.ads.interactivemedia.v3.api.player.VideoAdPlayer
import com.google.ads.interactivemedia.v3.api.player.VideoProgressUpdate

class RewardedAdActivity : Activity() {

    companion object {
        private const val TAG = "RewardedAdActivity"

        const val EXTRA_AD_TAG_URL = "extra_ad_tag_url"
        const val EXTRA_REWARD_GRANTED = "extra_reward_granted"
        const val EXTRA_ERROR_MESSAGE = "extra_error_message"

        private const val DEFAULT_AD_TAG_URL =
            "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&correlator="
    }

    private lateinit var adContainer: FrameLayout
    private lateinit var videoView: VideoView

    private var adsLoader: AdsLoader? = null
    private var adsManager: AdsManager? = null
    private var adPlayerAdapter: RewardVideoAdPlayerAdapter? = null

    private var completedSuccessfully = false
    private var finished = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        adContainer = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(0xFF000000.toInt())
        }

        videoView = VideoView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
                Gravity.CENTER
            )
        }
        adContainer.addView(videoView)
        setContentView(adContainer)

        initializeAndRequestAds()
    }

    override fun onBackPressed() {
        finishWithResult(false, "Ad closed before completion.")
    }

    override fun onDestroy() {
        cleanup()
        super.onDestroy()
    }

    private fun initializeAndRequestAds() {
        val sdkFactory = ImaSdkFactory.getInstance()
        val sdkSettings = sdkFactory.createImaSdkSettings()

        sdkFactory.initialize(applicationContext, sdkSettings)

        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val adapter = RewardVideoAdPlayerAdapter(videoView, audioManager)
        adPlayerAdapter = adapter

        val adDisplayContainer =
            ImaSdkFactory.createAdDisplayContainer(adContainer, adapter)

        adsLoader = sdkFactory.createAdsLoader(this, sdkSettings, adDisplayContainer).also { loader ->
            loader.addAdErrorListener(AdErrorEvent.AdErrorListener { event ->
                Log.e(TAG, "Ad load/playback error: ${event.error.message}")
                finishWithResult(false, event.error.message)
            })

            loader.addAdsLoadedListener { loadedEvent ->
                val manager = loadedEvent.getAdsManager() ?: run {
                    finishWithResult(false, "Failed to create ads manager.")
                    return@addAdsLoadedListener
                }
                adsManager = manager

                manager.addAdErrorListener(AdErrorEvent.AdErrorListener { event ->
                    Log.e(TAG, "AdsManager error: ${event.error.message}")
                    finishWithResult(false, event.error.message)
                })

                manager.addAdEventListener(AdEvent.AdEventListener { event ->
                    when (event.type) {
                        AdEvent.AdEventType.LOADED -> {
                            manager.start()
                        }
                        AdEvent.AdEventType.COMPLETED -> {
                            completedSuccessfully = true
                        }
                        AdEvent.AdEventType.SKIPPED -> {
                            completedSuccessfully = false
                        }
                        AdEvent.AdEventType.CONTENT_RESUME_REQUESTED,
                        AdEvent.AdEventType.ALL_ADS_COMPLETED -> {
                            if (completedSuccessfully) {
                                finishWithResult(true, null)
                            } else {
                                finishWithResult(false, "Ad was not fully watched.")
                            }
                        }
                        else -> {
                            // Intentionally ignored.
                        }
                    }
                })

                val renderingSettings: AdsRenderingSettings =
                    sdkFactory.createAdsRenderingSettings().apply {
                        setFocusSkipButtonWhenAvailable(true)
                    }
                manager.init(renderingSettings)
            }
        }

        val adTagUrl = intent.getStringExtra(EXTRA_AD_TAG_URL).orEmpty().ifBlank {
            DEFAULT_AD_TAG_URL
        }

        val request = sdkFactory.createAdsRequest().apply {
            setAdTagUrl(adTagUrl)
            setContentProgressProvider {
                VideoProgressUpdate.VIDEO_TIME_NOT_READY
            }
        }

        adsLoader?.requestAds(request)
    }

    private fun finishWithResult(rewardGranted: Boolean, errorMessage: String?) {
        if (finished) return
        finished = true

        completedSuccessfully = rewardGranted

        val resultIntent = Intent().apply {
            putExtra(EXTRA_REWARD_GRANTED, rewardGranted)
            if (!errorMessage.isNullOrBlank()) {
                putExtra(EXTRA_ERROR_MESSAGE, errorMessage)
            }
        }

        if (rewardGranted) {
            setResult(RESULT_OK, resultIntent)
        } else {
            setResult(RESULT_CANCELED, resultIntent)
        }

        cleanup()
        finish()
    }

    private fun cleanup() {
        adsManager?.destroy()
        adsManager = null

        adPlayerAdapter?.release()
        adPlayerAdapter = null

        videoView.stopPlayback()
        videoView.setOnPreparedListener(null)
        videoView.setOnCompletionListener(null)
        videoView.setOnErrorListener(null)
    }
}

private class RewardVideoAdPlayerAdapter(
    private val videoView: VideoView,
    private val audioManager: AudioManager
) : VideoAdPlayer {

    companion object {
        private const val PROGRESS_TICK_MS = 250L
    }

    private val callbacks = mutableListOf<VideoAdPlayer.VideoAdPlayerCallback>()
    private val mainHandler = Handler(Looper.getMainLooper())

    private var currentAdMediaInfo: AdMediaInfo? = null
    private var adDurationMs: Long = 0L
    private var savedPositionMs: Int = 0
    private var progressRunnable: Runnable? = null

    override fun addCallback(callback: VideoAdPlayer.VideoAdPlayerCallback) {
        callbacks.add(callback)
    }

    override fun removeCallback(callback: VideoAdPlayer.VideoAdPlayerCallback) {
        callbacks.remove(callback)
    }

    override fun loadAd(adMediaInfo: AdMediaInfo, adPodInfo: com.google.ads.interactivemedia.v3.api.AdPodInfo) {
        currentAdMediaInfo = adMediaInfo
    }

    override fun playAd(adMediaInfo: AdMediaInfo) {
        currentAdMediaInfo = adMediaInfo

        videoView.setVideoURI(Uri.parse(adMediaInfo.url))
        videoView.setOnPreparedListener { mediaPlayer ->
            adDurationMs = mediaPlayer.duration.toLong().coerceAtLeast(0L)
            callbacks.forEach { it.onLoaded(adMediaInfo) }

            if (savedPositionMs > 0) {
                mediaPlayer.seekTo(savedPositionMs)
                callbacks.forEach { it.onResume(adMediaInfo) }
            } else {
                callbacks.forEach { it.onPlay(adMediaInfo) }
            }

            mediaPlayer.start()
            startProgressUpdates()
        }

        videoView.setOnCompletionListener {
            savedPositionMs = 0
            stopProgressUpdates()
            callbacks.forEach { it.onEnded(adMediaInfo) }
        }

        videoView.setOnErrorListener { _, _, _ ->
            stopProgressUpdates()
            callbacks.forEach { it.onError(adMediaInfo) }
            true
        }
    }

    override fun pauseAd(adMediaInfo: AdMediaInfo) {
        if (videoView.isPlaying) {
            videoView.pause()
            savedPositionMs = videoView.currentPosition
            callbacks.forEach { it.onPause(adMediaInfo) }
        }
        stopProgressUpdates()
    }

    override fun stopAd(adMediaInfo: AdMediaInfo) {
        savedPositionMs = 0
        videoView.stopPlayback()
        stopProgressUpdates()
    }

    override fun release() {
        stopProgressUpdates()
        callbacks.clear()
        currentAdMediaInfo = null
    }

    override fun getAdProgress(): VideoProgressUpdate {
        val duration = adDurationMs
        if (duration <= 0) {
            return VideoProgressUpdate.VIDEO_TIME_NOT_READY
        }
        return VideoProgressUpdate(videoView.currentPosition.toLong(), duration)
    }

    override fun getVolume(): Int {
        val maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        if (maxVolume <= 0) return 0
        val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        return ((current.toFloat() / maxVolume.toFloat()) * 100f).toInt()
    }

    private fun startProgressUpdates() {
        if (progressRunnable != null) return
        val runnable = object : Runnable {
            override fun run() {
                val adInfo = currentAdMediaInfo
                if (adInfo != null) {
                    val progress = getAdProgress()
                    callbacks.forEach { it.onAdProgress(adInfo, progress) }
                }
                mainHandler.postDelayed(this, PROGRESS_TICK_MS)
            }
        }
        progressRunnable = runnable
        mainHandler.post(runnable)
    }

    private fun stopProgressUpdates() {
        val runnable = progressRunnable ?: return
        mainHandler.removeCallbacks(runnable)
        progressRunnable = null
    }
}
