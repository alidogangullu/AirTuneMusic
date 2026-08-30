package com.adg.airtune.imagecolors

import android.graphics.BitmapFactory
import android.util.Log
import androidx.palette.graphics.Palette
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.net.HttpURLConnection
import java.net.URL

class ImageColorsModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "ImageColors"
        private const val TAG = "ImageColors"
    }

    override fun getName(): String = NAME

    private fun calculateInSampleSize(options: BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
        val (height: Int, width: Int) = options.outHeight to options.outWidth
        var inSampleSize = 1

        if (height > reqHeight || width > reqWidth) {
            val halfHeight: Int = height / 2
            val halfWidth: Int = width / 2
            while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                inSampleSize *= 2
            }
        }
        return inSampleSize
    }

    private fun decodeSampledBitmapFromBytes(bytes: ByteArray, reqWidth: Int, reqHeight: Int): android.graphics.Bitmap? {
        val options = BitmapFactory.Options().apply {
            inJustDecodeBounds = true
        }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)

        options.inSampleSize = calculateInSampleSize(options, reqWidth, reqHeight)
        options.inJustDecodeBounds = false

        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
    }

    @ReactMethod
    fun getColors(uri: String, promise: Promise) {
        Thread {
            try {
                // We only need a small image to extract colors accurately
                val targetSize = 200

                val bitmap = if (uri.startsWith("data:")) {
                    val base64Data = uri.substringAfter(",")
                    val bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                    decodeSampledBitmapFromBytes(bytes, targetSize, targetSize)
                } else {
                    val connection = URL(uri).openConnection() as HttpURLConnection
                    connection.connectTimeout = 10_000
                    connection.readTimeout = 10_000
                    connection.doInput = true
                    connection.connect()

                    val bytes = connection.inputStream.readBytes()
                    connection.disconnect()

                    decodeSampledBitmapFromBytes(bytes, targetSize, targetSize)
                }

                if (bitmap == null) {
                    promise.reject("DECODE_ERROR", "Failed to decode image")
                    return@Thread
                }

                val palette = Palette.from(bitmap)
                    .maximumColorCount(24)
                    .generate()
                bitmap.recycle()

                val map = Arguments.createMap().apply {
                    putString("dominant", intToHex(palette.getDominantColor(0)))
                    putString("vibrant", intToHex(palette.getVibrantColor(0)))
                    putString("darkVibrant", intToHex(palette.getDarkVibrantColor(0)))
                    putString("lightVibrant", intToHex(palette.getLightVibrantColor(0)))
                    putString("muted", intToHex(palette.getMutedColor(0)))
                    putString("darkMuted", intToHex(palette.getDarkMutedColor(0)))
                    putString("lightMuted", intToHex(palette.getLightMutedColor(0)))
                }

                promise.resolve(map)
            } catch (e: Exception) {
                Log.e(TAG, "Error extracting colors", e)
                promise.reject("EXTRACT_ERROR", e.message, e)
            }
        }.start()
    }

    private fun intToHex(color: Int): String {
        return String.format("#%06X", 0xFFFFFF and color)
    }
}
