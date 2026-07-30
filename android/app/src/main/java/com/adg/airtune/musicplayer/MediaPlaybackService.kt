package com.adg.airtune.musicplayer

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

class MediaPlaybackService : Service() {

    override fun onBind(intent: Intent?): IBinder? {
        return null // We don't need binding, we communicate via MediaNotificationManager singleton
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val session = MediaNotificationManager.mediaSession
        
        if (session != null) {
            val notification = MediaNotificationManager.buildNotification(this, session)
            
            // Start foreground service
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(
                    MediaNotificationManager.NOTIFICATION_ID, 
                    notification, 
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                )
            } else {
                startForeground(MediaNotificationManager.NOTIFICATION_ID, notification)
            }
        } else {
            stopSelf()
        }

        return START_NOT_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        MediaNotificationManager.stop()
        stopSelf()
    }

    override fun onDestroy() {
        super.onDestroy()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }
}
