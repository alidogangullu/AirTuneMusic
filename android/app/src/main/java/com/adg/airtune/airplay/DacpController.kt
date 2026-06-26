package com.adg.airtune.airplay

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Sends DACP (Digital Audio Control Protocol) commands back to the AirPlay sender.
 * Resolves the sender's control port via mDNS, then sends HTTP GET requests.
 */
class DacpController(ctx: Context) {

    private val nsdManager = ctx.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val exec = Executors.newSingleThreadExecutor()

    @Volatile var dacpId = ""
    @Volatile var activeRemote = ""
    @Volatile private var host = ""
    @Volatile private var port = 0

    fun update(dacpId: String, activeRemote: String) {
        this.dacpId = dacpId
        this.activeRemote = activeRemote
        resolve()
    }

    fun playPause() = send("/ctrl-int/1/playpause")
    fun nextItem()  = send("/ctrl-int/1/nextitem")
    fun prevItem()  = send("/ctrl-int/1/previtem")

    fun release() {
        exec.shutdownNow()
    }

    private fun resolve() {
        if (dacpId.isEmpty()) return
        val info = NsdServiceInfo().apply {
            serviceType = "_dacp._tcp"
            serviceName = "iTunes_Ctrl_$dacpId"
        }
        try {
            nsdManager.resolveService(info, object : NsdManager.ResolveListener {
                override fun onResolveFailed(si: NsdServiceInfo, code: Int) {
                    Log.w(TAG, "DACP resolve failed: $code")
                }
                override fun onServiceResolved(si: NsdServiceInfo) {
                    host = si.host?.hostAddress ?: return
                    port = si.port
                    Log.i(TAG, "DACP resolved: $host:$port")
                }
            })
        } catch (e: Exception) {
            Log.w(TAG, "DACP resolve error: ${e.message}")
        }
    }

    private fun send(path: String) {
        if (host.isEmpty() || activeRemote.isEmpty()) {
            Log.w(TAG, "DACP not ready (host='$host', activeRemote='$activeRemote')")
            return
        }
        exec.execute {
            try {
                val conn = URL("http://$host:$port$path").openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.setRequestProperty("Active-Remote", activeRemote)
                conn.setRequestProperty("Host", "$host:$port")
                conn.connectTimeout = 2000
                conn.readTimeout    = 2000
                val code = conn.responseCode
                try { conn.inputStream.readBytes() } catch (_: Exception) {}
                conn.disconnect()
                if (code !in 200..299) Log.w(TAG, "DACP $path -> HTTP $code")
            } catch (e: Exception) {
                Log.w(TAG, "DACP send failed: $path — ${e.message}")
            }
        }
    }

    companion object {
        private const val TAG = "DacpController"
    }
}
