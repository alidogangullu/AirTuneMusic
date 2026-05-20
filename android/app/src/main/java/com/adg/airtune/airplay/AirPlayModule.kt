package com.adg.airtune.airplay

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import android.util.Base64
import android.util.Log
import com.adg.airtune.airplay.service.AirPlayService
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class AirPlayModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "AirPlayReceiver"
        private const val TAG = "AirPlayModule"
    }

    override fun getName() = NAME

    private var service: AirPlayService? = null
    private val scope = CoroutineScope(Dispatchers.Main + Job())
    private var listenerCount = 0

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName, binder: IBinder) {
            service = (binder as AirPlayService.LocalBinder).service
            attachCallbacks()
            Log.d(TAG, "AirPlayService connected")
        }

        override fun onServiceDisconnected(name: ComponentName) {
            service = null
            Log.d(TAG, "AirPlayService disconnected")
        }
    }

    private fun attachCallbacks() {
        val svc = service ?: return

        svc.logCallback = { msg -> sendEvent("onAirPlayLog", Arguments.createMap().apply { putString("message", msg) }) }
        svc.pinCallback = { pin ->
            val map = Arguments.createMap()
            if (pin != null) map.putString("pin", pin) else map.putNull("pin")
            sendEvent("onAirPlayPin", map)
        }
        svc.modeCallback = { audioOnly ->
            sendEvent("onAirPlayModeChange", Arguments.createMap().apply { putBoolean("audioOnly", audioOnly) })
        }

        scope.launch {
            svc.trackInfo.collect { info ->
                val map = Arguments.createMap().apply {
                    putString("title", info.title)
                    putString("artist", info.artist)
                    putString("album", info.album)
                    putString("genre", info.genre)
                    putDouble("durationMs", info.durationMs.toDouble())
                    info.coverArt?.let { bmp ->
                        val stream = java.io.ByteArrayOutputStream()
                        bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 90, stream)
                        putString("coverArtBase64", Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP))
                    }
                }
                sendEvent("onAirPlayTrackChanged", map)
            }
        }

        scope.launch {
            svc.serverState.collect { state ->
                sendEvent("onAirPlayStateChanged", Arguments.createMap().apply {
                    putString("state", state.name.lowercase())
                })
            }
        }

        scope.launch {
            while (true) {
                kotlinx.coroutines.delay(1000)
                val s = service ?: continue
                if (!s.playing.value) continue
                sendEvent("onAirPlayProgress", Arguments.createMap().apply {
                    putDouble("positionMs", s.currentPositionMs().toDouble())
                    putDouble("durationMs", s.durationMs.value.toDouble())
                })
            }
        }

        scope.launch {
            svc.connectionCount.collect { count ->
                sendEvent("onAirPlayConnectionCount", Arguments.createMap().apply {
                    putInt("count", count)
                })
            }
        }
    }

    @ReactMethod
    fun startReceiver(deviceName: String, promise: Promise) {
        try {
            Log.d(TAG, "startReceiver() called for deviceName=$deviceName")
            val ctx = reactApplicationContext
            val intent = Intent(ctx, AirPlayService::class.java)
            ctx.bindService(intent, connection, Context.BIND_AUTO_CREATE)
            // Start service so it keeps running when unbound
            ctx.startService(intent)
            // Give service time to bind then call startServer
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                service?.startServer(deviceName)
                promise.resolve(true)
            }, 300)
        } catch (e: Exception) {
            promise.reject("AIRPLAY_START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun stopReceiver(promise: Promise) {
        try {
            Log.d(TAG, "stopReceiver() called")
            service?.stopServer()
            try { reactApplicationContext.unbindService(connection) } catch (_: Exception) {}
            service = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AIRPLAY_STOP_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun disconnect() {
        Log.d(TAG, "disconnect() called")
        val svc = service ?: return
        // To drop the client, we stop and restart the native server.
        svc.stopServer()
        android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
            svc.startServer("AirTune")
        }, 500)
    }

    @ReactMethod
    fun pause() {
        Log.d(TAG, "pause() called")
        service?.dacpController?.pause()
    }

    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount++
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount = (listenerCount - count).coerceAtLeast(0)
    }

    private fun sendEvent(name: String, params: com.facebook.react.bridge.WritableMap) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
    }

    override fun invalidate() {
        scope.cancel()
        try { reactApplicationContext.unbindService(connection) } catch (_: Exception) {}
        super.invalidate()
    }
}
