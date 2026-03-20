package com.airtunemusic

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.airtunemusic.imagecolors.ImageColorsPackage
import com.airtunemusic.musicplayer.MusicPlayerPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(MusicPlayerPackage())
          add(ImageColorsPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Fix: Override JavaCPP default maxPhysicalBytes (which is tied to Java heap size)
    // Apple Music SDK decodes audio via JavaCPP buffers, which can temporarily spike
    // native memory during rapid track skips or seek operations. 
    // Setting to 1.5 GB (1610612736) instead of 0 to ensure GC still runs when memory gets too high.
    System.setProperty("org.bytedeco.javacpp.maxphysicalbytes", "1610612736")
    System.setProperty("org.bytedeco.javacpp.maxbytes", "1610612736")

    loadReactNative(this)
  }
}
