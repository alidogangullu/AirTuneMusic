package com.adg.airtune.musicplayer

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.io.*
import java.net.ServerSocket
import java.net.Socket
import java.net.InetAddress
import java.net.NetworkInterface
import java.util.*
import java.util.concurrent.Executors

class TVLinkServerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private var serverSocket: ServerSocket? = null
    private var isRunning = false
    private val executor = Executors.newSingleThreadExecutor()
    private val TAG = "TVLinkServer"
    private var developerToken: String = ""

    override fun getName(): String = "TVLinkServer"

    @ReactMethod
    fun startServer(port: Int, devToken: String, promise: Promise) {
        if (isRunning) {
            this.developerToken = devToken
            promise.resolve(getIpAddress())
            return
        }

        this.developerToken = devToken
        executor.execute {
            try {
                serverSocket = ServerSocket(port)
                isRunning = true
                val ip = getIpAddress()
                Log.d(TAG, "Server started on $ip:$port")
                
                promise.resolve(ip)

                while (isRunning) {
                    val client = serverSocket?.accept() ?: break
                    handleClient(client)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Server error: ${e.message}")
                if (isRunning) {
                    try {
                        promise.reject("SERVER_ERROR", e.message)
                    } catch (pe: Exception) {
                        // Promise might already be resolved
                    }
                }
                isRunning = false
            }
        }
    }

    @ReactMethod
    fun stopServer() {
        isRunning = false
        try {
            serverSocket?.close()
        } catch (e: Exception) {
            Log.e(TAG, "Error closing server: ${e.message}")
        }
        serverSocket = null
    }

    @ReactMethod
    fun getLocalIpAddress(promise: Promise) {
        promise.resolve(getIpAddress())
    }

    private fun handleClient(socket: Socket) {
        Thread {
            try {
                val inputStream = socket.getInputStream()
                val reader = BufferedReader(InputStreamReader(inputStream))
                val output = PrintWriter(socket.getOutputStream(), true)

                val line = reader.readLine() ?: return@Thread
                val parts = line.split(" ")
                if (parts.size < 2) return@Thread
                
                val method = parts[0]
                val fullPath = parts[1]
                val pathOnly = fullPath.split("?")[0]

                Log.d(TAG, "Request: $method $fullPath")

                when {
                    pathOnly == "/tv" || pathOnly == "/" -> serveHtml(output)
                    pathOnly == "/api/tv-link" && method == "POST" -> handlePost(reader, output)
                    pathOnly == "/api/tv-link/developer-token" -> handleGetToken(output)
                    else -> sendResponse(output, "404 Not Found", "text/plain", "Not Found")
                }
                socket.close()
            } catch (e: Exception) {
                Log.e(TAG, "Client error: ${e.message}")
            }
        }.start()
    }

    private fun serveHtml(output: PrintWriter) {
        try {
            val html = reactContext.assets.open("tv-link-page/index.html").bufferedReader().use { it.readText() }
            sendResponse(output, "200 OK", "text/html", html)
        } catch (e: Exception) {
            Log.e(TAG, "Error serving HTML: ${e.message}")
            sendResponse(output, "500 Internal Server Error", "text/plain", "Error loading index.html: ${e.message}")
        }
    }

    private fun handlePost(reader: BufferedReader, output: PrintWriter) {
        try {
            var contentLength = 0
            var line: String?
            while (reader.readLine().also { line = it } != null && line != "") {
                if (line?.startsWith("Content-Length:", ignoreCase = true) == true) {
                    contentLength = line!!.substring(15).trim().toInt()
                }
            }

            if (contentLength > 0) {
                val body = CharArray(contentLength)
                var totalRead = 0
                while (totalRead < contentLength) {
                    val read = reader.read(body, totalRead, contentLength - totalRead)
                    if (read == -1) break
                    totalRead += read
                }
                
                val jsonBody = String(body)
                val json = JSONObject(jsonBody)
                val code = json.getString("code")
                val token = json.getString("musicUserToken")

                val params = Arguments.createMap().apply {
                    putString("code", code)
                    putString("musicUserToken", token)
                }
                sendEvent("onTokenReceived", params)
                sendResponse(output, "200 OK", "application/json", "{\"ok\": true}")
            } else {
                sendResponse(output, "400 Bad Request", "application/json", "{\"error\": \"Empty body\"}")
            }
        } catch (e: Exception) {
            Log.e(TAG, "POST error: ${e.message}")
            sendResponse(output, "400 Bad Request", "application/json", "{\"error\": \"Invalid request\"}")
        }
    }

    private fun handleGetToken(output: PrintWriter) {
        if (developerToken.isNotEmpty()) {
            sendResponse(output, "200 OK", "application/json", "{\"developerToken\": \"$developerToken\"}")
        } else {
            sendResponse(output, "500 Error", "application/json", "{\"error\": \"Developer token not set\"}")
        }
    }

    private fun sendResponse(output: PrintWriter, status: String, contentType: String, content: String) {
        output.println("HTTP/1.1 $status")
        output.println("Content-Type: $contentType")
        output.println("Content-Length: ${content.toByteArray().size}")
        output.println("Access-Control-Allow-Origin: *")
        output.println("Connection: close")
        output.println("")
        output.print(content)
        output.flush()
    }

    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    private fun getIpAddress(): String {
        try {
            val interfaces = NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val networkInterface = interfaces.nextElement()
                val addresses = networkInterface.inetAddresses
                while (addresses.hasMoreElements()) {
                    val address = addresses.nextElement()
                    if (!address.isLoopbackAddress && address is InetAddress && address.hostAddress != null && address.hostAddress.indexOf(':') < 0) {
                        return address.hostAddress
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error getting IP: ${e.message}")
        }
        return "127.0.0.1"
    }

    // Required for NativeEventEmitter
    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}
}
