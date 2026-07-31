package com.adg.airtune.tv

import android.content.Context
import android.net.Uri
import androidx.tvprovider.media.tv.PreviewChannel
import androidx.tvprovider.media.tv.PreviewChannelHelper
import androidx.tvprovider.media.tv.PreviewProgram
import androidx.tvprovider.media.tv.TvContractCompat
import com.facebook.react.bridge.*
import kotlin.concurrent.thread

class AndroidTVChannelsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AndroidTVChannelsModule"

    @ReactMethod
    fun publishChannel(
        channelKey: String,
        channelTitle: String,
        items: ReadableArray,
        promise: Promise
    ) {
        thread {
            try {
                val context: Context = reactContext.applicationContext
                val helper = PreviewChannelHelper(context)
                val allChannels = try { helper.allChannels } catch (e: Exception) { emptyList() }

                val existing = allChannels.find { it.internalProviderId == channelKey }
                val builder = if (existing != null) PreviewChannel.Builder(existing) else PreviewChannel.Builder()

                val logoBitmap = android.graphics.BitmapFactory.decodeResource(context.resources, com.adg.airtune.R.drawable.tv_banner)

                builder.setInternalProviderId(channelKey)
                    .setDisplayName(channelTitle)
                    .setLogo(logoBitmap)
                    .setAppLinkIntentUri(Uri.parse("airtune://home"))

                val channel = builder.build()

                val channelId = if (existing != null) {
                    try {
                        context.contentResolver.delete(
                            TvContractCompat.buildPreviewProgramsUriForChannel(existing.id), null, null
                        )
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    helper.updatePreviewChannel(existing.id, channel)
                    existing.id
                } else {
                    helper.publishChannel(channel)
                }

                // Request browsability for the first channel automatically
                if (allChannels.none { it.isBrowsable }) {
                    try {
                        TvContractCompat.requestChannelBrowsable(context, channelId)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                // Publish PreviewPrograms into this channel
                for (i in 0 until items.size()) {
                    val map = items.getMap(i) ?: continue
                    val id = if (map.hasKey("id")) map.getString("id") else null ?: continue
                    val title = if (map.hasKey("title")) map.getString("title") else ""
                    val subtitle = if (map.hasKey("subtitle")) map.getString("subtitle") else ""
                    val artworkUrl = if (map.hasKey("artworkUrl")) map.getString("artworkUrl") else ""
                    val deepLinkUri = if (map.hasKey("deepLinkUri")) map.getString("deepLinkUri") else "airtune://play?id=$id"

                    val progBuilder = PreviewProgram.Builder()
                        .setChannelId(channelId)
                        .setType(TvContractCompat.PreviewPrograms.TYPE_CLIP)
                        .setTitle(title ?: "")
                        .setDescription(subtitle ?: "")
                        .setInternalProviderId(id)
                        .setIntentUri(Uri.parse(deepLinkUri))

                    if (!artworkUrl.isNullOrEmpty()) {
                        progBuilder.setPosterArtUri(Uri.parse(artworkUrl))
                        progBuilder.setPosterArtAspectRatio(TvContractCompat.PreviewPrograms.ASPECT_RATIO_1_1)
                    }

                    try {
                        helper.publishPreviewProgram(progBuilder.build())
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }

                promise.resolve(channelId.toDouble())
            } catch (e: Exception) {
                promise.reject("CHANNEL_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun removeChannel(channelKey: String, promise: Promise) {
        thread {
            try {
                val context = reactContext.applicationContext
                val helper = PreviewChannelHelper(context)
                val allChannels = try { helper.allChannels } catch (e: Exception) { emptyList() }
                val existing = allChannels.find { it.internalProviderId == channelKey }
                if (existing != null) {
                    try {
                        context.contentResolver.delete(
                            TvContractCompat.buildPreviewProgramsUriForChannel(existing.id), null, null
                        )
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    try {
                        context.contentResolver.delete(
                            TvContractCompat.buildChannelUri(existing.id), null, null
                        )
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("REMOVE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun clearAllChannels(promise: Promise) {
        thread {
            try {
                val context = reactContext.applicationContext
                val helper = PreviewChannelHelper(context)
                val allChannels = try { helper.allChannels } catch (e: Exception) { emptyList() }
                for (channel in allChannels) {
                    try {
                        context.contentResolver.delete(
                            TvContractCompat.buildPreviewProgramsUriForChannel(channel.id), null, null
                        )
                        context.contentResolver.delete(
                            TvContractCompat.buildChannelUri(channel.id), null, null
                        )
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("CLEAR_ERROR", e.message, e)
            }
        }
    }
}
