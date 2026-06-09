package com.adg.airtunemusic.airplay

import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * AirPlay (RAOP) audio receiver, backed by the direct-UxPlay native engine
 * (libairtune_jni.so). Audio-only: video / screen-mirroring callbacks are
 * intentionally no-ops. Re-exposes AirPipe's stable RTP-anchored timing.
 *
 * The RN module name is "AirPlayReceiver" and the emitted event names match the
 * existing JS bridge (airPlayReceiver.ts) so the React layer is unchanged.
 */
class AirPlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "AirPlayModule"

        // Shared instance so AudioRenderer can reach ALAC JNI without a direct ref
        @Volatile var instance: AirPlayModule? = null; private set

        init {
            try {
                System.loadLibrary("airtune_jni")
                Log.d(TAG, "airtune_jni loaded")
            } catch (e: UnsatisfiedLinkError) {
                Log.w(TAG, "airtune_jni not available: ${e.message}")
            }
        }

        fun nativeAlacInitStatic(frameLength: Int, numChannels: Int, bitDepth: Int, pb: Int, mb: Int, kb: Int): Long =
            instance?.nativeAlacInit(frameLength, numChannels, bitDepth, pb, mb, kb) ?: 0L

        fun nativeAlacDecodeStatic(handle: Long, input: ByteArray): ByteArray? =
            instance?.nativeAlacDecode(handle, input)

        fun nativeAlacDestroyStatic(handle: Long) {
            instance?.nativeAlacDestroy(handle)
        }
    }

    init { instance = this }

    // ── Server state ──────────────────────────────────────────────────────────

    private var serverHandle = 0L
    private var deviceName = "AirTune"
    private val audioRenderer = AudioRenderer()
    private var nsdManager: NsdManager? = null
    private var raopListener: NsdManager.RegistrationListener? = null
    private var airplayListener: NsdManager.RegistrationListener? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private val dacpController = DacpController(reactContext)

    // Anchor from last onProgress; used to emit interpolated position from onAudioData
    @Volatile private var progressPositionSec = 0.0
    @Volatile private var progressDurationSec = 0.0
    @Volatile private var progressBaseTimeMs = 0L
    @Volatile private var lastProgressEmitMs = 0L

    // Merged "now playing" metadata (metadata + cover art arrive separately)
    private val lastTags = mutableMapOf<String, String>()
    private var lastCoverB64: String? = null

    override fun getName(): String = "AirPlayReceiver"

    // ── React Native methods ──────────────────────────────────────────────────

    @ReactMethod
    fun startReceiver(deviceName: String, promise: Promise) {
        this.deviceName = deviceName.ifBlank { "AirTune" }
        try {
            val port = startEngine()
            if (port < 0) {
                emitState("error")
                promise.reject("START_FAILED", "engine start returned $port")
                return
            }
            emitState("running")
            Log.i(TAG, "AirPlay server started on port $port")
            promise.resolve(true)
        } catch (e: UnsatisfiedLinkError) {
            Log.w(TAG, "JNI not available: ${e.message}")
            promise.resolve(false)
        } catch (e: Exception) {
            emitState("error")
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopReceiver(promise: Promise) {
        stopEngine()
        emitState("stopped")
        promise.resolve(true)
    }

    /** Drop the currently connected client by restarting the RAOP server. */
    @ReactMethod
    fun disconnect() {
        try {
            stopEngine()
            startEngine()
        } catch (e: Exception) {
            Log.w(TAG, "disconnect restart failed: ${e.message}")
        }
    }

    @ReactMethod fun dacpPlayPause(promise: Promise?) { dacpController.playPause(); promise?.resolve(null) }
    @ReactMethod fun dacpNext(promise: Promise?)      { dacpController.nextItem();  promise?.resolve(null) }
    @ReactMethod fun dacpPrev(promise: Promise?)      { dacpController.prevItem();  promise?.resolve(null) }

    /** Backward-compatible: old JS pause() maps to DACP play/pause toggle. */
    @ReactMethod fun pause() { dacpController.playPause() }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    // ── Engine lifecycle ───────────────────────────────────────────────────────

    private fun startEngine(): Int {
        val hwAddr  = getHwAddrBytes()
        val keyfile = reactContext.filesDir.absolutePath + "/airtune.key"

        serverHandle = nativeInit(
            callback   = this,
            hwAddr     = hwAddr,
            name       = deviceName,
            keyFile    = keyfile,
            nohold     = true,
            requirePin = false,
        )
        if (serverHandle == 0L) return -1

        // Audio-only defaults — display size / H265 are unused (no video render).
        nativeSetDisplaySize(serverHandle, 1920, 1080, 30)
        nativeSetH265Enabled(serverHandle, false)

        val port = nativeStart(serverHandle, 0)
        if (port < 0) return port

        acquireMulticastLock()
        registerNsdServices(serverHandle, port)
        return port
    }

    private fun stopEngine() {
        try {
            if (serverHandle != 0L) {
                nativeStop(serverHandle)
                nativeDestroy(serverHandle)
                serverHandle = 0L
            }
        } catch (e: UnsatisfiedLinkError) { /* stub mode */ }
        audioRenderer.stop()
        unregisterNsd()
        releaseMulticastLock()
        progressBaseTimeMs = 0L
        lastTags.clear()
        lastCoverB64 = null
    }

    // ── NSD registration ──────────────────────────────────────────────────────

    private fun acquireMulticastLock() {
        val wifi = reactContext.applicationContext
            .getSystemService(android.content.Context.WIFI_SERVICE) as WifiManager
        multicastLock = wifi.createMulticastLock("airtune_mdns").apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseMulticastLock() {
        multicastLock?.release()
        multicastLock = null
    }

    private fun registerNsdServices(handle: Long, port: Int) {
        val nm = reactContext.getSystemService(NsdManager::class.java)
            .also { nsdManager = it }

        @Suppress("UNCHECKED_CAST")
        val raopTxt    = nativeGetRaopTxtRecords(handle)    as? Map<String, String> ?: emptyMap()
        @Suppress("UNCHECKED_CAST")
        val airplayTxt = nativeGetAirplayTxtRecords(handle) as? Map<String, String> ?: emptyMap()

        val raopName    = nativeGetRaopServiceName(handle) ?: deviceName
        val serverName  = raopName.substringAfter("@", deviceName)

        val raopInfo = NsdServiceInfo().apply {
            serviceName = raopName
            serviceType = "_raop._tcp"
            this.port   = port
            raopTxt.forEach { (k, v) -> setAttribute(k, v) }
        }

        val airplayInfo = NsdServiceInfo().apply {
            serviceName = serverName
            serviceType = "_airplay._tcp"
            this.port   = port
            airplayTxt.forEach { (k, v) -> setAttribute(k, v) }
        }

        raopListener = makeListener("RAOP")
        airplayListener = makeListener("AirPlay")

        nm.registerService(raopInfo,    NsdManager.PROTOCOL_DNS_SD, raopListener)
        nm.registerService(airplayInfo, NsdManager.PROTOCOL_DNS_SD, airplayListener)
    }

    private fun makeListener(tag: String) = object : NsdManager.RegistrationListener {
        override fun onServiceRegistered(i: NsdServiceInfo) { Log.i(TAG, "$tag registered: ${i.serviceName}") }
        override fun onRegistrationFailed(i: NsdServiceInfo, code: Int) { Log.e(TAG, "$tag failed: $code") }
        override fun onServiceUnregistered(i: NsdServiceInfo) { Log.i(TAG, "$tag unregistered") }
        override fun onUnregistrationFailed(i: NsdServiceInfo, code: Int) { Log.e(TAG, "$tag unreg failed: $code") }
    }

    private fun unregisterNsd() {
        val nm = nsdManager ?: return
        raopListener?.let    { try { nm.unregisterService(it) } catch (_: Exception) {} }
        airplayListener?.let { try { nm.unregisterService(it) } catch (_: Exception) {} }
        raopListener    = null
        airplayListener = null
    }

    // ── JNI callbacks (called by name from android_raop_callbacks.c) ───────────

    // Video is not supported (music-only app). Keep the methods so JNI
    // GetMethodID succeeds, but drop all frames / size events.
    fun onVideoData(data: ByteArray, ntpTimeNs: Long, isH265: Boolean) {}
    fun onVideoSize(wSrc: Float, hSrc: Float, w: Float, h: Float) {}

    fun onAudioData(data: ByteArray, ct: Int, ntpTimeNs: Long, seqNum: Int) {
        audioRenderer.feedAudio(data, ct, ntpTimeNs)
        // Emit interpolated playback position ~once per second while audio flows.
        // JS uses a silence timeout to detect pause when these stop arriving.
        if (progressBaseTimeMs == 0L) return
        val now = System.currentTimeMillis()
        // Gap detection: if audio was silent for >2 s (paused/resumed), re-anchor
        // so elapsed restarts from 0 instead of jumping forward.
        if (lastProgressEmitMs > 0L && now - lastProgressEmitMs > 2000L) {
            val frozenPos = (progressPositionSec + (lastProgressEmitMs - progressBaseTimeMs) / 1000.0)
                .coerceAtLeast(0.0)
            progressPositionSec = frozenPos
            progressBaseTimeMs  = now
        }
        if (now - lastProgressEmitMs < 1000L) return
        lastProgressEmitMs = now
        val elapsed = (now - progressBaseTimeMs) / 1000.0
        val map = WritableNativeMap()
        map.putDouble("positionMs", (progressPositionSec + elapsed) * 1000.0)
        map.putDouble("durationMs", progressDurationSec * 1000.0)
        emit("onAirPlayProgress", map)
    }

    fun onAudioFormat(ct: Int, spf: Int, usingScreen: Boolean) {
        Log.d(TAG, "onAudioFormat ct=$ct spf=$spf screen=$usingScreen")
    }

    fun onVolumeChange(volume: Float) {
        audioRenderer.setVolume(volume)
    }

    fun onConnectionInit() {
        // A client connected — this is an audio session (video frames are dropped).
        emitConnectionCount(1)
        val mode = WritableNativeMap()
        mode.putBoolean("audioOnly", true)
        emit("onAirPlayModeChange", mode)
    }

    fun onConnectionDestroy() {
        audioRenderer.stop()
        progressBaseTimeMs = 0L
        lastTags.clear()
        lastCoverB64 = null
        emitConnectionCount(0)
    }

    fun onConnectionReset(reason: Int) {
        Log.d(TAG, "onConnectionReset reason=$reason")
    }

    fun onDisplayPin(pin: String) {
        val map = WritableNativeMap()
        map.putString("pin", pin)
        emit("onAirPlayPin", map)
    }

    fun onMetadata(data: ByteArray) {
        val tags = parseDaap(data)
        if (tags["minm"] == null) return
        lastTags.clear()
        lastTags.putAll(tags)
        emitTrack()
    }

    fun onCoverArt(data: ByteArray) {
        lastCoverB64 = android.util.Base64.encodeToString(data, android.util.Base64.NO_WRAP)
        emitTrack()
    }

    fun onProgress(start: Long, curr: Long, end: Long) {
        val sr = 44100.0
        // RTP timestamps are unsigned 32-bit; mask to treat as unsigned when cast to Long
        val s = start and 0xFFFFFFFFL
        val c = curr  and 0xFFFFFFFFL
        val e = end   and 0xFFFFFFFFL
        // Handle 32-bit wrap-around: if curr < start, add 2^32 to curr
        val elapsed = if (c >= s) c - s else (0x100000000L - s + c)
        val total   = if (e >= s) e - s else (0x100000000L - s + e)
        val pos = elapsed / sr
        val dur = if (total > 0) total / sr else pos
        progressPositionSec = pos
        progressDurationSec = dur
        progressBaseTimeMs  = System.currentTimeMillis()
        lastProgressEmitMs  = progressBaseTimeMs
        // Don't emit here — only onAudioData drives position updates.
    }

    fun onClientName(name: String) {
        Log.d(TAG, "onClientName: $name")
    }

    fun onDacpId(dacpId: String, activeRemote: String) {
        Log.d(TAG, "onDacpId: $dacpId / $activeRemote")
        dacpController.update(dacpId, activeRemote)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun emitTrack() {
        val title = lastTags["minm"] ?: return
        val map = WritableNativeMap()
        map.putString("title",  title)
        map.putString("artist", lastTags["asar"] ?: "")
        map.putString("album",  lastTags["asal"] ?: "")
        map.putString("genre",  lastTags["asgn"] ?: "")
        map.putDouble("durationMs", (lastTags["astm"]?.toDoubleOrNull() ?: 0.0))
        lastCoverB64?.let { map.putString("coverArtBase64", it) }
        emit("onAirPlayTrackChanged", map)
    }

    private fun emitConnectionCount(count: Int) {
        val map = WritableNativeMap()
        map.putInt("count", count)
        emit("onAirPlayConnectionCount", map)
    }

    private fun emitState(state: String) {
        val map = WritableNativeMap()
        map.putString("state", state)
        emit("onAirPlayStateChanged", map)
    }

    private fun parseDaap(data: ByteArray): Map<String, String> {
        val result = mutableMapOf<String, String>()
        var i = 0
        while (i + 8 <= data.size) {
            val tag = String(data, i, 4, Charsets.US_ASCII)
            val len = ((data[i+4].toInt() and 0xFF) shl 24) or
                      ((data[i+5].toInt() and 0xFF) shl 16) or
                      ((data[i+6].toInt() and 0xFF) shl  8) or
                       (data[i+7].toInt() and 0xFF)
            i += 8
            if (len < 0 || i + len > data.size) break
            when (tag) {
                "minm", "asar", "asal", "asgn" ->
                    result[tag] = String(data, i, len, Charsets.UTF_8)
                "astm" -> if (len == 4) {
                    val ms = ((data[i].toInt() and 0xFF) shl 24) or
                             ((data[i+1].toInt() and 0xFF) shl 16) or
                             ((data[i+2].toInt() and 0xFF) shl 8) or
                              (data[i+3].toInt() and 0xFF)
                    result[tag] = ms.toString()
                }
                "mlit", "mlcl", "mdcl", "mccr" ->
                    result.putAll(parseDaap(data.copyOfRange(i, i + len)))
            }
            i += len
        }
        return result
    }

    private fun emit(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun getHwAddrBytes(): ByteArray {
        return try {
            val wifiMgr = reactContext.applicationContext
                .getSystemService(android.content.Context.WIFI_SERVICE) as WifiManager
            @Suppress("DEPRECATION")
            val raw = wifiMgr.connectionInfo?.macAddress ?: ""
            if (raw.isNotEmpty() && raw != "02:00:00:00:00:00") {
                raw.split(":").map { it.toInt(16).toByte() }.toByteArray()
            } else pseudoMacBytes()
        } catch (_: Exception) { pseudoMacBytes() }
    }

    private fun pseudoMacBytes(): ByteArray {
        val id = android.provider.Settings.Secure.getString(
            reactContext.contentResolver, android.provider.Settings.Secure.ANDROID_ID
        ) ?: "DEADBEEF0001"
        val hex = id.padEnd(12, '0').substring(0, 12)
        return ByteArray(6) { i -> hex.substring(i * 2, i * 2 + 2).toInt(16).toByte() }
    }

    // ── JNI declarations ─────────────────────────────────────────────────────

    private external fun nativeInit(
        callback: Any, hwAddr: ByteArray, name: String,
        keyFile: String, nohold: Boolean, requirePin: Boolean
    ): Long

    private external fun nativeStart(handle: Long, requestedPort: Int): Int
    private external fun nativeStop(handle: Long)
    private external fun nativeDestroy(handle: Long)
    private external fun nativeSetDisplaySize(handle: Long, w: Int, h: Int, fps: Int)
    private external fun nativeSetH265Enabled(handle: Long, enabled: Boolean)
    private external fun nativeGetRaopTxtRecords(handle: Long): Any?
    private external fun nativeGetAirplayTxtRecords(handle: Long): Any?
    private external fun nativeGetRaopServiceName(handle: Long): String?

    private external fun nativeAlacInit(frameLength: Int, numChannels: Int, bitDepth: Int, pb: Int, mb: Int, kb: Int): Long
    private external fun nativeAlacDecode(handle: Long, input: ByteArray): ByteArray?
    private external fun nativeAlacDestroy(handle: Long)
}
