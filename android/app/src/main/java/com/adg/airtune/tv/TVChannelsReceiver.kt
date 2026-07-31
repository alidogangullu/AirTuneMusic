package com.adg.airtune.tv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class TVChannelsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "android.media.tv.action.INITIALIZE_PROGRAMS") {
            // Android TV Home Launcher broadcasts this to discover and initialize app channels
        }
    }
}
