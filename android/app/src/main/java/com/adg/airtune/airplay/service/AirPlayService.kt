package com.adg.airtune.airplay.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Binder
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import androidx.core.app.NotificationCompat
import androidx.media.app.NotificationCompat as MediaNotificationCompat
import androidx.core.content.ContextCompat
import android.util.Log
import android.view.Surface
import android.content.BroadcastReceiver
import android.content.IntentFilter
import com.adg.airtune.MainActivity
//removed
import com.adg.airtune.R
import com.adg.airtune.airplay.audio.DacpController
import com.adg.airtune.airplay.audio.DmapParser
import com.adg.airtune.airplay.audio.TrackInfo
//removed
import com.adg.airtune.airplay.bridge.NativeBridge
import com.adg.airtune.airplay.bridge.RaopCallbackHandler
import com.adg.airtune.airplay.discovery.NsdServiceManager
import com.adg.airtune.airplay.renderer.AudioRenderer
import com.adg.airtune.airplay.renderer.VideoRenderer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.net.NetworkInterface

class AirPlayService : Service(), RaopCallbackHandler {

    private var nativeHandle = 0L
    private var nsdManager: NsdServiceManager? = null
    private var wakeLock: PowerManager.WakeLock? = null

    val videoRenderer = VideoRenderer()
    val audioRenderer = AudioRenderer()

    private val _serverState = MutableStateFlow(ServerState.STOPPED)
    val serverState = _serverState.asStateFlow()

    private val _connectionCount = MutableStateFlow(0)
    val connectionCount = _connectionCount.asStateFlow()

    private val _videoAspect = MutableStateFlow(16f / 9f)
    val videoAspect = _videoAspect.asStateFlow()

    private val _videoResolution = MutableStateFlow("")
    val videoResolution = _videoResolution.asStateFlow()

    private val _audioOnly = MutableStateFlow(false)
    val audioOnly = _audioOnly.asStateFlow()

    private val _trackInfo = MutableStateFlow(TrackInfo())
    val trackInfo = _trackInfo.asStateFlow()

    private val _positionMs = MutableStateFlow(0L)
    val positionMs = _positionMs.asStateFlow()

    private val _durationMs = MutableStateFlow(0L)
    val durationMs = _durationMs.asStateFlow()

    private val _playing = MutableStateFlow(true)
    val playing = _playing.asStateFlow()

    @Volatile private var _progressBaseMs = 0L
    @Volatile private var _progressBaseTime = 0L
    @Volatile private var _lastAudioDataTime = 0L

    fun currentPositionMs(): Long {
        if (_progressBaseTime == 0L || !_playing.value) return _positionMs.value
        val now = SystemClock.elapsedRealtime()
        
        // Watchdog: If no audio data for > 2s, the sender has likely paused or disconnected.
        if (_lastAudioDataTime > 0 && now - _lastAudioDataTime > 2000) {
            val lastElapsed = now - _progressBaseTime
            _positionMs.value = (_progressBaseMs + lastElapsed).coerceIn(0, _durationMs.value)
            _playing.value = false
            _progressBaseTime = 0
            return _positionMs.value
        }

        val elapsed = now - _progressBaseTime
        // No watchdog on progress here because some senders don't send periodic updates.
        // Just advance based on elapsed time.
        return (_progressBaseMs + elapsed).coerceIn(0, _durationMs.value)
    }

    var dacpController: DacpController? = null; private set
    private var mediaSession: MediaSessionCompat? = null
    private var mediaReceiver: BroadcastReceiver? = null

    var logCallback: ((String) -> Unit)? = null
    var pinCallback: ((String?) -> Unit)? = null
    var modeCallback: ((Boolean) -> Unit)? = null

    private fun log(msg: String) {
        Log.i(TAG, msg)
        logCallback?.invoke(msg)
    }

    inner class LocalBinder : Binder() {
        val service: AirPlayService get() = this@AirPlayService
    }

    override fun onBind(intent: Intent?): IBinder = LocalBinder()

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        dacpController = DacpController(this)
        mediaSession = MediaSessionCompat(this, "AirPlay").apply {
            setCallback(object : MediaSessionCompat.Callback() {
                override fun onPlay() { _setPlaying(true); dacpController?.play() }
                override fun onPause() { _setPlaying(false); dacpController?.pause() }
                override fun onSkipToNext() { dacpController?.nextItem() }
                override fun onSkipToPrevious() { dacpController?.prevItem() }
            })
        }
        mediaReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                when (intent.action) {
                    ACTION_PLAY_PAUSE -> togglePlayPause()
                    ACTION_NEXT -> dacpController?.nextItem()
                    ACTION_PREV -> dacpController?.prevItem()
                }
            }
        }
        val filter = IntentFilter().apply {
            addAction(ACTION_PLAY_PAUSE)
            addAction(ACTION_NEXT)
            addAction(ACTION_PREV)
        }
        ContextCompat.registerReceiver(this, mediaReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_NOT_STICKY

    fun startServer(name: String) {
        if (_serverState.value == ServerState.RUNNING) return
        val name = name.ifBlank { "AirTune" }

        
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "airplay:server").apply { acquire() }

        nsdManager = NsdServiceManager(this).apply { acquireMulticastLock() }

        val hwAddr = getHwAddr()
        val keyFile = filesDir.resolve("airplay.pem").absolutePath
        val nohold = false
        val requirePin = false

        nativeHandle = NativeBridge.nativeInit(this, hwAddr, name, keyFile, nohold, requirePin)
        if (nativeHandle == 0L) {
            log("Native init failed")
            _failStart()
            return
        }

        // Apply settings from preferences
        val audioLatencyMs = -1
        val h265 = false // Disable video codecs
        val alac = true // Enable Lossless support since we have a software decoder
        val aac = true

        audioRenderer.swAlacEnabled = true
        NativeBridge.nativeSetH265Enabled(nativeHandle, h265)
        NativeBridge.nativeSetCodecs(nativeHandle, alac, aac)
        NativeBridge.nativeSetPlist(nativeHandle, "maxFPS", 0) // No video FPS
        NativeBridge.nativeSetPlist(nativeHandle, "overscanned", 0)
        if (audioLatencyMs >= 0) NativeBridge.nativeSetPlist(nativeHandle, "audio_delay_micros", audioLatencyMs * 1000)

        // Set display params
        val dm = resources.displayMetrics
        val res = "auto"
        val (w, h) = if (res != "auto" && res.contains("x")) {
            val parts = res.split("x")
            parts[0].toInt() to parts[1].toInt()
        } else {
            dm.widthPixels to dm.heightPixels
        }
        videoRenderer.setResolution(w, h)
        _videoResolution.value = "${w}x${h}"
        _videoAspect.value = w.toFloat() / h
        NativeBridge.nativeSetDisplaySize(nativeHandle, w, h, 60)

        val requestedPort = 7100
        val port = NativeBridge.nativeStart(nativeHandle, requestedPort)
        if (port < 0) {
            log("Failed to start on port $requestedPort")
            _failStart()
            return
        }

        // Register mDNS services
        val raopTxt = NativeBridge.nativeGetRaopTxtRecords(nativeHandle) ?: emptyMap()
        val airplayTxt = NativeBridge.nativeGetAirplayTxtRecords(nativeHandle)?.toMutableMap() ?: mutableMapOf()
        
        // Force audio-only by unsetting Video (0x4), Photo (0x80), and Screen Mirroring (0x800) bits
        airplayTxt["features"]?.let { f ->
            try {
                val features = f.removePrefix("0x").toLong(16)
                val audioOnlyFeatures = features and (0x4L or 0x80L or 0x800L).inv()
                airplayTxt["features"] = "0x${java.lang.Long.toHexString(audioOnlyFeatures)}"
                log("Modified features from $f to ${airplayTxt["features"]} for audio-only mode")
            } catch (_: Exception) {}
        }

        val raopName = NativeBridge.nativeGetRaopServiceName(nativeHandle) ?: "AirPlay"
        val serverName = NativeBridge.nativeGetServerName(nativeHandle) ?: name

        nsdManager?.registerRaop(raopName, port, raopTxt)
        nsdManager?.registerAirplay(serverName, port, airplayTxt)

        // EMULATOR_BRIDGE: log service info so the host can proxy mDNS
        log("BRIDGE_RAOP_NAME=$raopName")
        log("BRIDGE_AIRPLAY_NAME=$serverName")
        log("BRIDGE_PORT=$port")
        log("BRIDGE_RAOP_TXT=${raopTxt.entries.joinToString("|") { "${it.key}=${it.value}" }}")
        log("BRIDGE_AIRPLAY_TXT=${airplayTxt.entries.joinToString("|") { "${it.key}=${it.value}" }}")

        _serverState.value = ServerState.RUNNING
        ContextCompat.startForegroundService(this, Intent(this, AirPlayService::class.java))
        startForeground(NOTIFICATION_ID, buildNotification())
        log("Server started on port $port")
    }

    private fun _failStart() {
        if (nativeHandle != 0L) {
            NativeBridge.nativeDestroy(nativeHandle)
            nativeHandle = 0L
        }
        nsdManager?.release()
        nsdManager = null
        wakeLock?.release()
        wakeLock = null
        _serverState.value = ServerState.ERROR
    }

    fun stopServer() {
        if (nativeHandle != 0L) {
            NativeBridge.nativeStop(nativeHandle)
            NativeBridge.nativeDestroy(nativeHandle)
            nativeHandle = 0L
        }
        dacpController?.release()
        nsdManager?.release()
        nsdManager = null
        wakeLock?.release()
        wakeLock = null
        videoRenderer.release()
        audioRenderer.release()
        mediaSession?.isActive = false
        _audioOnly.value = false
        _trackInfo.value = TrackInfo()
        _positionMs.value = 0
        _durationMs.value = 0
        _serverState.value = ServerState.STOPPED
        _connectionCount.value = 0
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        log("Server stopped")
    }

    fun setVideoSurface(surface: Surface?) {
        videoRenderer.setSurface(surface)
    }

    override fun onDestroy() {
        stopServer()
        mediaReceiver?.let { try { unregisterReceiver(it) } catch (_: Exception) {} }
        mediaReceiver = null
        dacpController?.release()
        dacpController = null
        mediaSession?.release()
        mediaSession = null
        super.onDestroy()
    }

    // RaopCallbackHandler (called from native threads)

    override fun onVideoData(data: ByteArray, ntpTimeNs: Long, isH265: Boolean) {
        // Video devre dışı — sadece ses modu
    }

    override fun onAudioData(data: ByteArray, ct: Int, ntpTimeNs: Long, seqNum: Int) {
        _lastAudioDataTime = SystemClock.elapsedRealtime()
        audioRenderer.feedAudio(data, ct, ntpTimeNs)
    }

    override fun onAudioFormat(ct: Int, spf: Int, usingScreen: Boolean) {
        clearPin()
        if (!usingScreen && !_audioOnly.value) {
            // Pure music streaming (not screen mirroring audio)
            onAudioOnly(true)
        }
        log("Audio format: ct=$ct spf=$spf screen=$usingScreen")
    }

    override fun onVideoSize(srcW: Float, srcH: Float, w: Float, h: Float) {
        clearPin()
        // Video devre dışı — sadece ses modu
    }

    override fun onVolumeChange(volume: Float) {
        audioRenderer.setVolume(volume)
    }

    override fun onConnectionInit() {
        _connectionCount.value++
        log("Client connected (${_connectionCount.value})")
    }

    override fun onConnectionDestroy() {
        _connectionCount.value = (_connectionCount.value - 1).coerceAtLeast(0)
        if (_connectionCount.value == 0) {
            _audioOnly.value = false
            _trackInfo.value = TrackInfo()
            _positionMs.value = 0
            _durationMs.value = 0
            mediaSession?.isActive = false
        }
        log("Client disconnected (${_connectionCount.value})")
    }

    override fun onConnectionReset(reason: Int) {
        log("Connection reset: $reason")
    }

    override fun onDisplayPin(pin: String) {
        pinCallback?.invoke(pin)
    }

    override fun onMetadata(data: ByteArray) {
        val map = DmapParser.parse(data)
        val info = TrackInfo.fromDmap(map, _trackInfo.value.coverArt)
        _trackInfo.value = info
        _durationMs.value = info.durationMs
        _updateMediaMetadata()
        log("Track: ${info.artist} - ${info.title}")
    }

    override fun onCoverArt(data: ByteArray) {
        val bmp = BitmapFactory.decodeByteArray(data, 0, data.size) ?: return
        _trackInfo.value = _trackInfo.value.copy(coverArt = bmp)
        _updateMediaMetadata()
    }

    override fun onProgress(start: Long, curr: Long, end: Long) {
        val rate = 44100.0
        val posMs = ((curr - start) / rate * 1000).toLong().coerceAtLeast(0)
        val durMs = ((end - start) / rate * 1000).toLong().coerceAtLeast(0)
        _positionMs.value = posMs
        _durationMs.value = durMs
        _progressBaseMs = posMs
        _progressBaseTime = SystemClock.elapsedRealtime()
        _playing.value = true
        _updatePlaybackState()
    }

    override fun onDacpId(dacpId: String, activeRemote: String) {
        dacpController?.update(dacpId, activeRemote)
        log("DACP: $dacpId")
    }

    override fun onAudioOnly(audioOnly: Boolean) {
        val prev = _audioOnly.value
        _audioOnly.value = audioOnly
        if (audioOnly && !prev) {
            mediaSession?.isActive = true
            modeCallback?.invoke(true)
            log("Audio mode")
        } else if (!audioOnly && prev) {
            mediaSession?.isActive = false
            _trackInfo.value = TrackInfo()
            _positionMs.value = 0
            _durationMs.value = 0
            modeCallback?.invoke(false)
            log("Mirror mode")
        }
    }

    private fun _updateMediaMetadata() {
        val info = _trackInfo.value
        val builder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, info.title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, info.artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, info.album)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, _durationMs.value)
        info.coverArt?.let {
            builder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
        }
        mediaSession?.setMetadata(builder.build())
        _updateMediaNotification()
    }

    fun togglePlayPause() {
        val nowPlaying = !_playing.value
        _setPlaying(nowPlaying)
        dacpController?.playPause()
    }

    private fun _setPlaying(playing: Boolean) {
        _playing.value = playing
        if (playing) {
            // Resume extrapolation from current position
            _progressBaseMs = _positionMs.value
            _progressBaseTime = SystemClock.elapsedRealtime()
        } else {
            // Freeze position
            _positionMs.value = currentPositionMs()
            _progressBaseTime = 0
        }
        _updatePlaybackState()
    }

    private fun _updatePlaybackState() {
        val isPlaying = _playing.value
        val pbState = if (isPlaying) PlaybackStateCompat.STATE_PLAYING
                      else PlaybackStateCompat.STATE_PAUSED
        val speed = if (isPlaying) 1f else 0f
        val state = PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY or PlaybackStateCompat.ACTION_PAUSE or
                PlaybackStateCompat.ACTION_PLAY_PAUSE or
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT or
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
            )
            .setState(pbState, _positionMs.value, speed, SystemClock.elapsedRealtime())
            .build()
        mediaSession?.setPlaybackState(state)
        _updateMediaNotification()
    }

    private fun clearPin() {
        pinCallback?.invoke(null)
    }



    // Helpers

    private fun getHwAddr(): ByteArray {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            for (iface in interfaces) {
                if (iface.name.startsWith("wlan") || iface.name.startsWith("eth")) {
                    val mac = iface.hardwareAddress
                    if (mac != null && mac.size == 6) return mac
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Failed to get hardware address", e)
        }
        // Fallback: random-ish address
        return byteArrayOf(0xAA.toByte(), 0xBB.toByte(), 0xCC.toByte(), 0xDD.toByte(), 0xEE.toByte(), 0xFF.toByte())
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(CHANNEL_ID, getString(R.string.airplay_notification_channel),
            NotificationManager.IMPORTANCE_LOW)
        (getSystemService(NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return _buildMediaNotification()
    }

    private fun _buildMediaNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_IMMUTABLE)
        val info = _trackInfo.value
        val isAudio = _audioOnly.value && info.title.isNotEmpty()

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentIntent(pi)
            .setOngoing(true)

        if (isAudio) {
            builder.setContentTitle(info.title)
                .setContentText(info.artist)
                .setSubText(info.album)
            info.coverArt?.let { builder.setLargeIcon(it) }
            mediaSession?.sessionToken?.let { token ->
                builder.setStyle(
                    MediaNotificationCompat.MediaStyle()
                        .setMediaSession(token)
                        .setShowActionsInCompactView(0, 1, 2)
                )
                // Transport action buttons
                builder.addAction(android.R.drawable.ic_media_previous, "Prev",
                    _mediaAction(ACTION_PREV))
                builder.addAction(android.R.drawable.ic_media_pause, "Pause",
                    _mediaAction(ACTION_PLAY_PAUSE))
                builder.addAction(android.R.drawable.ic_media_next, "Next",
                    _mediaAction(ACTION_NEXT))
            }
        } else {
            builder.setContentTitle(getString(R.string.airplay_notification_title))
                .setContentText(getString(R.string.airplay_notification_text))
        }
        return builder.build()
    }

    private fun _mediaAction(action: String): PendingIntent {
        val intent = Intent(action).setPackage(packageName)
        return PendingIntent.getBroadcast(this, action.hashCode(), intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun _updateMediaNotification() {
        if (_serverState.value != ServerState.RUNNING) return
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, _buildMediaNotification())
    }

    enum class ServerState { STOPPED, RUNNING, ERROR }

    companion object {
        private const val TAG = "AirPlayService"
        private const val CHANNEL_ID = "airplay_service"
        private const val NOTIFICATION_ID = 1
        const val ACTION_PLAY_PAUSE = "com.adg.airtune.AIRPLAY_PLAY_PAUSE"
        const val ACTION_NEXT = "com.adg.airtune.AIRPLAY_NEXT"
        const val ACTION_PREV = "com.adg.airtune.AIRPLAY_PREV"
    }
}
