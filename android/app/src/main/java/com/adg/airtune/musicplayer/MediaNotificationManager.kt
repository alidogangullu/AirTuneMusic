package com.adg.airtune.musicplayer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.support.v4.media.MediaMetadataCompat
import android.support.v4.media.session.MediaSessionCompat
import android.support.v4.media.session.PlaybackStateCompat
import android.util.Base64
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.adg.airtune.R
import java.net.URL
import kotlin.concurrent.thread

object MediaNotificationManager {

    const val CHANNEL_ID = "airtune_playback_channel"
    const val NOTIFICATION_ID = 1001

    private var context: Context? = null
    var mediaSession: MediaSessionCompat? = null
        private set

    private var currentTitle: String = ""
    private var currentArtist: String = ""
    private var currentAlbum: String = ""
    private var currentArtworkBitmap: Bitmap? = null
    private var isPlaying: Boolean = false
    private var isServiceRunning: Boolean = false

    fun init(ctx: Context) {
        if (context != null) return
        context = ctx.applicationContext

        createNotificationChannel()

        mediaSession = MediaSessionCompat(context!!, "AirTuneMediaSession").apply {
            setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS or MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS)
            setCallback(object : MediaSessionCompat.Callback() {
                // TV OS requires callbacks to consider this a valid Now Playing session,
                // but we leave them empty to protect the quota logic (no external skipping)
                override fun onPlay() {}
                override fun onPause() {}
                override fun onSkipToNext() {}
                override fun onSkipToPrevious() {}
                override fun onStop() {}
            })
            isActive = true
        }
    }

    private var currentMetadataVersion: Long = 0

    fun updateMetadata(
        title: String,
        artist: String,
        album: String?,
        artworkUrl: String?,
        base64Art: String?
    ) {
        val version = ++currentMetadataVersion
        currentTitle = title
        currentArtist = artist
        currentAlbum = album ?: ""
        
        // Reset artwork first to avoid showing old artwork for a new song
        currentArtworkBitmap = null
        updateSessionMetadata()
        updateNotification()

        if (base64Art != null) {
            thread {
                try {
                    val decodedBytes = Base64.decode(base64Art, Base64.DEFAULT)
                    val bmp = BitmapFactory.decodeByteArray(decodedBytes, 0, decodedBytes.size)
                    if (version == currentMetadataVersion) {
                        currentArtworkBitmap = bmp
                        updateSessionMetadata()
                        updateNotification()
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        } else if (artworkUrl != null) {
            thread {
                try {
                    // Quick and dirty image fetch
                    val url = URL(artworkUrl)
                    val connection = url.openConnection()
                    connection.doInput = true
                    connection.connect()
                    val input = connection.inputStream
                    val bmp = BitmapFactory.decodeStream(input)
                    if (version == currentMetadataVersion) {
                        currentArtworkBitmap = bmp
                        updateSessionMetadata()
                        updateNotification()
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        } else {
            val ctx = context
            if (ctx != null) {
                currentArtworkBitmap = getBitmapFromDrawable(ctx, R.mipmap.ic_launcher)
                updateSessionMetadata()
                updateNotification()
            }
        }
    }

    private fun getBitmapFromDrawable(ctx: Context, resId: Int): Bitmap? {
        return try {
            val drawable = ContextCompat.getDrawable(ctx, resId) ?: return null
            val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 512
            val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 512
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(bitmap)
            drawable.setBounds(0, 0, canvas.width, canvas.height)
            drawable.draw(canvas)
            bitmap
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    fun updatePlaybackState(playing: Boolean) {
        isPlaying = playing
        val state = if (playing) PlaybackStateCompat.STATE_PLAYING else PlaybackStateCompat.STATE_PAUSED

        // Declare minimal actions so Google TV OS recognizes this as an active media session
        // and displays the "Now Playing" card, but avoid ACTION_SKIP_TO_NEXT to protect quota logic.
        val actions = if (playing) {
            PlaybackStateCompat.ACTION_PAUSE or PlaybackStateCompat.ACTION_STOP
        } else {
            PlaybackStateCompat.ACTION_PLAY
        }

        mediaSession?.setPlaybackState(
            PlaybackStateCompat.Builder()
                .setState(state, PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, 1.0f)
                .setActions(actions)
                .build()
        )

        if (playing && !isServiceRunning) {
            startService()
        }
        
        updateNotification()
    }

    fun stop() {
        isPlaying = false
        currentTitle = ""
        currentArtist = ""
        currentAlbum = ""
        currentArtworkBitmap = null
        
        mediaSession?.isActive = false
        mediaSession?.release()
        mediaSession = null
        
        context?.let { ctx ->
            val notificationManager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(NOTIFICATION_ID)
            val intent = Intent(ctx, MediaPlaybackService::class.java)
            ctx.stopService(intent)
        }
        isServiceRunning = false
        context = null
    }

    private fun updateSessionMetadata() {
        val metadataBuilder = MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, currentAlbum)

        currentArtworkBitmap?.let {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, it)
        }

        mediaSession?.setMetadata(metadataBuilder.build())
    }

    private fun startService() {
        context?.let { ctx ->
            val intent = Intent(ctx, MediaPlaybackService::class.java)
            ContextCompat.startForegroundService(ctx, intent)
            isServiceRunning = true
        }
    }

    private fun updateNotification() {
        if (!isServiceRunning) return
        val ctx = context ?: return
        val session = mediaSession ?: return

        val notificationManager = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val notification = buildNotification(ctx, session)
        notificationManager.notify(NOTIFICATION_ID, notification)
    }

    fun buildNotification(ctx: Context, session: MediaSessionCompat): Notification {
        // Intent to open the app when the notification is clicked
        val packageManager = ctx.packageManager
        val launchIntent = packageManager.getLaunchIntentForPackage(ctx.packageName)
        val pendingIntent = PendingIntent.getActivity(
            ctx, 0, launchIntent, 
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val smallIcon = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            R.mipmap.ic_launcher_monochrome
        } else {
            R.mipmap.ic_launcher_foreground
        }

        val builder = NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setContentTitle(currentTitle.ifEmpty { "AirTune" })
            .setContentText(currentArtist)
            .setSmallIcon(smallIcon)
            .setLargeIcon(currentArtworkBitmap)
            .setContentIntent(pendingIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(isPlaying)
            .setStyle(
                androidx.media.app.NotificationCompat.MediaStyle()
                    .setMediaSession(session.sessionToken)
                    // No actions passed to setShowActionsInCompactView since we have no buttons
                    .setShowActionsInCompactView() 
            )

        return builder.build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ctx = context ?: return
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Media Playback",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows currently playing track"
                setShowBadge(false)
            }
            val manager = ctx.getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }
}
