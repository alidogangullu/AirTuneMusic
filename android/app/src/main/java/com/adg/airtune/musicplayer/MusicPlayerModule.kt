package com.adg.airtune.musicplayer

import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import android.util.Log
import com.apple.android.music.playback.controller.MediaPlayerController
import com.apple.android.music.playback.controller.MediaPlayerControllerFactory
import com.apple.android.music.playback.model.MediaContainerType
import com.apple.android.music.playback.model.MediaItemType
import com.apple.android.music.playback.model.MediaPlayerException
import com.apple.android.music.playback.model.PlaybackShuffleMode
import com.apple.android.music.playback.model.PlaybackState
import com.apple.android.music.playback.model.PlayerQueueItem
import com.apple.android.music.playback.queue.CatalogPlaybackQueueItemProvider
import com.apple.android.sdk.authentication.TokenProvider
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class MusicPlayerModule(private val reactContext: ReactApplicationContext) :
        ReactContextBaseJavaModule(reactContext), MediaPlayerController.Listener {

    companion object {
        const val NAME = "MusicPlayer"
        private const val TAG = "MusicPlayer"
        private const val ARTWORK_SIZE = 600
        private const val PROGRESS_INTERVAL_MS = 1000L
        private var nativeLibLoaded = false

        private fun ensureNativeLib() {
            if (!nativeLibLoaded) {
                System.loadLibrary("appleMusicSDK")
                nativeLibLoaded = true
            }
        }
    }

    override fun getName(): String = NAME

    private var player: MediaPlayerController? = null
    private var storedDevToken: String? = null
    private var storedUsrToken: String? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private var progressRunnable: Runnable? = null
    private var currentQueueItems: List<PlayerQueueItem> = emptyList()

    // ── Configure ───────────────────────────────────────────────

    @ReactMethod
    fun configure(devToken: String, usrToken: String, promise: Promise) {
        ensureNativeLib() // Native kütüphaneyi açılışta yükle
        Log.d(
                TAG,
                "configure called, devToken=${devToken.take(20)}..., usrToken=${usrToken.take(20)}..."
        )
        storedDevToken = devToken
        storedUsrToken = usrToken

        if (player != null) {
            promise.resolve(true)
            return
        }

        // Must run on main thread — javacpp JNI init overflows the NativeModules thread stack
        mainHandler.post {
            try {
                ensureNativeLib()

                val tokenProvider =
                        object : TokenProvider {
                            override fun getDeveloperToken(): String = storedDevToken ?: ""
                            override fun getUserToken(): String {
                                val token = storedUsrToken
                                return if (token.isNullOrEmpty()) "" else token
                            }
                        }

                player =
                        MediaPlayerControllerFactory.createLocalController(
                                reactContext.applicationContext,
                                mainHandler,
                                tokenProvider
                        )
                player?.addListener(this)

                Log.d(TAG, "Player created successfully: ${player != null}")
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CONFIGURE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun updateTokens(devToken: String, usrToken: String) {
        Log.d(
                TAG,
                "updateTokens called, devToken=${devToken.take(20)}..., usrToken=${usrToken.take(20)}..."
        )
        storedDevToken = devToken
        storedUsrToken = usrToken
    }

    // ── Play content ────────────────────────────────────────────

    @ReactMethod
    fun playAlbum(albumId: String, startIndex: Int, shuffle: Boolean, promise: Promise) {
        playContainer(MediaContainerType.ALBUM, albumId, startIndex, shuffle, promise)
    }

    @ReactMethod
    fun playPlaylist(playlistId: String, startIndex: Int, shuffle: Boolean, promise: Promise) {
        playContainer(MediaContainerType.PLAYLIST, playlistId, startIndex, shuffle, promise)
    }

    @ReactMethod
    fun playStation(stationId: String, promise: Promise) {
        // SDK has no RADIO_STATION container type; play as individual item
        playItem(MediaItemType.SONG, stationId, promise)
    }

    @ReactMethod
    fun playSong(songId: String, promise: Promise) {
        playItem(MediaItemType.SONG, songId, promise)
    }

    @ReactMethod
    fun playMusicVideo(musicVideoId: String, promise: Promise) {
        // SDK doesn't expose MUSIC_VIDEO type; use SONG as fallback
        playItem(MediaItemType.SONG, musicVideoId, promise)
    }

    @ReactMethod
    fun playTracks(trackIds: ReadableArray, startIndex: Int, shuffle: Boolean, promise: Promise) {
        val p = player
        if (p == null) {
            promise.reject("NOT_CONFIGURED", "Call configure() first")
            return
        }
        mainHandler.post {
            try {
                val idsList = mutableListOf<String>()
                for (i in 0 until trackIds.size()) {
                    val id = trackIds.getString(i)
                    if (id != null) idsList.add(id)
                }

                Log.d(TAG, "playTracks count=${idsList.size} startIndex=$startIndex shuffle=$shuffle")
                
                if (idsList.isEmpty()) {
                    promise.resolve(true)
                    return@post
                }
                
                val builder = CatalogPlaybackQueueItemProvider.Builder()
                builder.items(MediaItemType.SONG, *idsList.toTypedArray())
                builder.startItemIndex(startIndex)
                
                if (shuffle) {
                    builder.shuffleMode(PlaybackShuffleMode.SHUFFLE_MODE_SONGS)
                }
                
                val queue = builder.build()
                p.prepare(queue, true)
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "playTracks error", e)
                promise.reject("PLAY_ERROR", e.message, e)
            }
        }
    }

    private fun playContainer(
            containerType: Int,
            containerId: String,
            startIndex: Int,
            shuffle: Boolean,
            promise: Promise
    ) {
        val p = player
        if (p == null) {
            promise.reject("NOT_CONFIGURED", "Call configure() first")
            return
        }
        mainHandler.post {
            try {
                Log.d(
                        TAG,
                        "playContainer type=$containerType id=$containerId startIndex=$startIndex shuffle=$shuffle"
                )
                val builder =
                        CatalogPlaybackQueueItemProvider.Builder()
                                .containers(containerType, containerId)
                                .startItemIndex(startIndex)
                if (shuffle) {
                    builder.shuffleMode(PlaybackShuffleMode.SHUFFLE_MODE_SONGS)
                }
                val queue = builder.build()
                Log.d(TAG, "playContainer: queue built, calling prepare(queue, autoPlay=true)")
                p.prepare(queue, true)
                Log.d(TAG, "playContainer: prepare() returned, playbackState=${p.playbackState}")
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("PLAY_ERROR", e.message, e)
            }
        }
    }

    private fun playItem(itemType: Int, itemId: String, promise: Promise) {
        val p = player
        if (p == null) {
            Log.e(TAG, "playItem: player is null!")
            promise.reject("NOT_CONFIGURED", "Call configure() first")
            return
        }
        mainHandler.post {
            try {
                Log.d(TAG, "playItem type=$itemType id=$itemId")
                val queue =
                        CatalogPlaybackQueueItemProvider.Builder().items(itemType, itemId).build()
                Log.d(TAG, "playItem: queue built, calling prepare(queue, autoPlay=true)")
                p.prepare(queue, true)
                Log.d(TAG, "playItem: prepare() returned, playbackState=${p.playbackState}")
                promise.resolve(true)
            } catch (e: Exception) {
                Log.e(TAG, "playItem error", e)
                promise.reject("PLAY_ERROR", e.message, e)
            }
        }
    }

    // ── Token Storage Fallback ──────────────────────────────────
    
    @ReactMethod
    fun saveUserToken(token: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("AirTuneMusicPrefs", android.content.Context.MODE_PRIVATE)
            prefs.edit().putString("musicUserToken", token).commit()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SAVE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getUserToken(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("AirTuneMusicPrefs", android.content.Context.MODE_PRIVATE)
            val token = prefs.getString("musicUserToken", null)
            promise.resolve(token)
        } catch (e: Exception) {
            promise.reject("GET_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun clearUserToken(promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("AirTuneMusicPrefs", android.content.Context.MODE_PRIVATE)
            prefs.edit().remove("musicUserToken").commit()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLEAR_ERROR", e.message, e)
        }
    }

    // ── Transport controls ──────────────────────────────────────

    private fun isSafeForQueueModification(): Boolean {
        val state = player?.playbackState
        return state == PlaybackState.PLAYING || state == PlaybackState.PAUSED || state == PlaybackState.STOPPED
    }

    @ReactMethod
    fun setKeepAwake(enabled: Boolean) {
        mainHandler.post {
            try {
                val activity = reactContext.currentActivity
                if (activity != null) {
                    if (enabled) {
                        Log.d(TAG, "Setting FLAG_KEEP_SCREEN_ON")
                        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    } else {
                        Log.d(TAG, "Clearing FLAG_KEEP_SCREEN_ON")
                        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error in setKeepAwake", e)
            }
        }
    }

    @ReactMethod
    fun play() {
        mainHandler.post { player?.play() }
    }

    @ReactMethod
    fun pause() {
        mainHandler.post { player?.pause() }
    }

    @ReactMethod
    fun stop() {
        mainHandler.post {
            player?.stop()
            stopProgressUpdates()
        }
    }

    @ReactMethod
    fun skipToNext() {
        mainHandler.post { player?.skipToNextItem() }
    }

    @ReactMethod
    fun skipToPrevious() {
        mainHandler.post { player?.skipToPreviousItem() }
    }

    @ReactMethod
    fun seekTo(positionMs: Double) {
        val ms = positionMs.toLong()
        mainHandler.post { player?.seekToPosition(ms) }
    }

    @ReactMethod
    fun setShuffleMode(mode: Int) {
        mainHandler.post { 
            if (!isSafeForQueueModification()) {
                Log.w(TAG, "Ignored setShuffleMode to prevent Apple Music SDK race condition during track transition")
                return@post
            }
            val pos = player?.currentPosition ?: -1L
            val dur = player?.duration ?: -1L
            val remaining = if (dur > 0 && pos >= 0) dur - pos else Long.MAX_VALUE
            if (remaining < 4000) {
                val delay = remaining + 500
                Log.w(TAG, "Deferring setShuffleMode for $delay ms to avoid gapless pre-buffering crash")
                mainHandler.postDelayed({ player?.setShuffleMode(mode) }, delay)
            } else {
                player?.setShuffleMode(mode)
            }
        }
    }

    @ReactMethod
    fun setRepeatMode(mode: Int) {
        mainHandler.post { 
            if (!isSafeForQueueModification()) {
                Log.w(TAG, "Ignored setRepeatMode to prevent Apple Music SDK race condition during track transition")
                return@post
            }
            val pos = player?.currentPosition ?: -1L
            val dur = player?.duration ?: -1L
            val remaining = if (dur > 0 && pos >= 0) dur - pos else Long.MAX_VALUE
            if (remaining < 4000) {
                val delay = remaining + 500
                Log.w(TAG, "Deferring setRepeatMode for $delay ms to avoid gapless pre-buffering crash")
                mainHandler.postDelayed({ player?.setRepeatMode(mode) }, delay)
            } else {
                player?.setRepeatMode(mode)
            }
        }
    }

    // ── Query state ─────────────────────────────────────────────

    @ReactMethod
    fun getPlaybackState(promise: Promise) {
        val p = player
        if (p == null) {
            promise.resolve(null)
            return
        }
        val map =
                Arguments.createMap().apply {
                    putString("state", playbackStateName(p.playbackState))
                    putDouble("position", p.currentPosition.toDouble())
                    putDouble("duration", p.duration.toDouble())
                    putInt("shuffleMode", p.shuffleMode)
                    putInt("repeatMode", p.repeatMode)
                    putInt("queueCount", p.playbackQueueItemCount)
                    putInt("queueIndex", p.playbackQueueIndex)
                    p.currentItem?.let { putLong("playbackQueueId", it.playbackQueueId) }
                }
        val item = p.currentItem
        if (item != null) {
            val media = item.item
            map.putString("id", media.subscriptionStoreId)
            map.putString("title", media.title)
            map.putString("artistName", media.artistName)
            map.putString("albumTitle", media.albumTitle)
            map.putString("artworkUrl", media.getArtworkUrl(ARTWORK_SIZE, ARTWORK_SIZE))
            map.putDouble("trackDuration", media.duration.toDouble())
        }
        promise.resolve(map)
    }
    @ReactMethod
    fun getQueue(promise: Promise) {
        val array = Arguments.createArray()
        val p = player ?: run {
            promise.resolve(array)
            return
        }
        val currentItem = p.currentItem
        val upcomingItems = p.getQueueItems() ?: currentQueueItems

        // Build display queue: current item + upcoming items only.
        // Previous items are derived on the JS side using containerTracks + containerIndex.
        val displayList = mutableListOf<PlayerQueueItem>()
        if (currentItem != null) {
            displayList.add(currentItem)
        }
        val existingIds = displayList.map { it.playbackQueueId }.toSet()
        upcomingItems.forEach { item ->
            if (item.playbackQueueId !in existingIds) {
                displayList.add(item)
            }
        }

        displayList.forEachIndexed { index, queueItem ->
            val media = queueItem.item
            val map = Arguments.createMap().apply {
                putString("id", media.subscriptionStoreId)
                putString("title", media.title)
                putString("artistName", media.artistName)
                putString("albumTitle", media.albumTitle)
                putString("artworkUrl", media.getArtworkUrl(ARTWORK_SIZE, ARTWORK_SIZE))
                putDouble("duration", media.duration.toDouble())
                putInt("trackIndex", index)
                putLong("playbackQueueId", queueItem.playbackQueueId)
            }
            array.pushMap(map)
        }
        promise.resolve(array)
    }

    // ── Listener callbacks ──────────────────────────────────────

    override fun onPlaybackStateChanged(
            controller: MediaPlayerController,
            previousState: Int,
            currentState: Int
    ) {
        Log.d(
                TAG,
                "onPlaybackStateChanged: ${playbackStateName(previousState)} -> ${playbackStateName(currentState)}"
        )
        val map =
                Arguments.createMap().apply {
                    putString("state", playbackStateName(currentState))
                    putString("previousState", playbackStateName(previousState))
                }
        sendEvent("onPlaybackStateChanged", map)

        if (currentState == PlaybackState.PLAYING) {
            setKeepAwake(true)
            startProgressUpdates()
        } else {
            setKeepAwake(false)
            stopProgressUpdates()
        }
    }

    override fun onCurrentItemChanged(
            controller: MediaPlayerController,
            previousItem: PlayerQueueItem?,
            currentItem: PlayerQueueItem?
    ) {
        Log.d(
                TAG,
            "onCurrentItemChanged: prev=${previousItem?.item?.title} -> cur=${currentItem?.item?.title}"
        )

        val containerStoreId = controller.currentContainerStoreId
        val map = Arguments.createMap()
        if (currentItem != null) {
            val media = currentItem.item
            map.putString("id", media.subscriptionStoreId)
            map.putString("title", media.title)
            map.putString("artistName", media.artistName)
            map.putString("albumTitle", media.albumTitle)
            map.putString("artworkUrl", media.getArtworkUrl(ARTWORK_SIZE, ARTWORK_SIZE))
            map.putDouble("duration", media.duration.toDouble())
            map.putInt("trackIndex", controller.playbackQueueIndex)
            map.putInt("containerIndex", controller.currentContainerIndex)
            map.putLong("playbackQueueId", currentItem.playbackQueueId)
        }
        // Always send container + capability info regardless of track
        if (containerStoreId != null) {
            map.putString("containerStoreId", containerStoreId)
        }
        map.putBoolean("canSkipToPrevious", controller.canSkipToPreviousItem())
        map.putBoolean("canSkipToNext", controller.canSkipToNextItem())
        sendEvent("onCurrentItemChanged", map)
    }

    override fun onPlaybackStateUpdated(controller: MediaPlayerController) {
        // Covered by progress timer
    }

    override fun onItemEnded(
            controller: MediaPlayerController,
            queueItem: PlayerQueueItem,
            endPosition: Long
    ) {
        val map =
                Arguments.createMap().apply {
                    putString("title", queueItem.item.title)
                    putDouble("endPosition", endPosition.toDouble())
                }
        sendEvent("onItemEnded", map)
    }

    override fun onPlaybackError(controller: MediaPlayerController, error: MediaPlayerException) {
        val msg = error.message ?: "Unknown playback error"
        Log.e(TAG, "onPlaybackError: $msg", error)

        var friendlyMessage = msg
        if (msg.contains("v1/me/storefront")) {
            friendlyMessage =
                    "Failed to resolve storefront. Please check your Apple Music subscription or sign in again."
        }

        val map =
                Arguments.createMap().apply {
                    putString("message", friendlyMessage)
                    putString("rawMessage", msg)
                }
        sendEvent("onPlaybackError", map)
    }

    override fun onPlaybackQueueChanged(
            controller: MediaPlayerController,
            queueItems: MutableList<PlayerQueueItem>
    ) {
        Log.d(TAG, "onPlaybackQueueChanged: count=${queueItems.size}")
        currentQueueItems = queueItems
        val map = Arguments.createMap().apply { putInt("count", controller.playbackQueueItemCount) }
        sendEvent("onPlaybackQueueChanged", map)
    }

    override fun onPlaybackQueueItemsAdded(
            controller: MediaPlayerController,
            insertionType: Int,
            containerType: Int,
            itemType: Int
    ) {}

    override fun onPlaybackRepeatModeChanged(
            controller: MediaPlayerController,
            currentRepeatMode: Int
    ) {
        val map = Arguments.createMap().apply { putInt("repeatMode", currentRepeatMode) }
        sendEvent("onRepeatModeChanged", map)
    }

    override fun onPlaybackShuffleModeChanged(
            controller: MediaPlayerController,
            currentShuffleMode: Int
    ) {
        val map = Arguments.createMap().apply { putInt("shuffleMode", currentShuffleMode) }
        sendEvent("onShuffleModeChanged", map)
    }

    override fun onBufferingStateChanged(controller: MediaPlayerController, buffering: Boolean) {
        Log.d(TAG, "onBufferingStateChanged: buffering=$buffering")
        val map = Arguments.createMap().apply { putBoolean("buffering", buffering) }
        sendEvent("onBufferingStateChanged", map)
    }

    override fun onMetadataUpdated(
            controller: MediaPlayerController,
            currentItem: PlayerQueueItem
    ) {}

    override fun onPlayerStateRestored(controller: MediaPlayerController) {}

    // ── Progress updates ────────────────────────────────────────

    private fun startProgressUpdates() {
        stopProgressUpdates()
        val runnable =
                object : Runnable {
                    override fun run() {
                        val p = player ?: return
                        if (p.playbackState == PlaybackState.PLAYING) {
                            val pos = p.currentPosition
                            val dur = p.duration
                            val buf = p.bufferedPosition
                            Log.d(
                                    TAG,
                                    "progress: pos=$pos dur=$dur buf=$buf state=${p.playbackState}"
                            )
                            val map =
                                    Arguments.createMap().apply {
                                        putDouble("position", pos.toDouble())
                                        putDouble("duration", dur.toDouble())
                                        putDouble("buffered", buf.toDouble())
                                    }
                            sendEvent("onPlaybackProgress", map)
                            mainHandler.postDelayed(this, PROGRESS_INTERVAL_MS)
                        }
                    }
                }
        progressRunnable = runnable
        mainHandler.post(runnable)
    }

    private fun stopProgressUpdates() {
        progressRunnable?.let { mainHandler.removeCallbacks(it) }
        progressRunnable = null
    }

    // ── Cleanup ─────────────────────────────────────────────────

    @ReactMethod
    fun release() {
        stopProgressUpdates()
        player?.let {
            it.stop()
            it.removeListener(this)
            it.release()
        }
        player = null
    }

    override fun onCatalystInstanceDestroy() {
        release()
    }

    // ── Helpers ─────────────────────────────────────────────────

    private fun sendEvent(name: String, params: WritableMap) {
        Log.d(TAG, "sendEvent: $name")
        if (reactContext.hasActiveReactInstance()) {
            reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit(name, params)
        } else {
            Log.w(TAG, "sendEvent: no active react instance, dropping event $name")
        }
    }

    private fun playbackStateName(state: Int): String =
            when (state) {
                PlaybackState.PLAYING -> "playing"
                PlaybackState.PAUSED -> "paused"
                PlaybackState.STOPPED -> "stopped"
                else -> "unknown"
            }

    // Required for NativeEventEmitter
    @ReactMethod fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

    @ReactMethod fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {}
}
