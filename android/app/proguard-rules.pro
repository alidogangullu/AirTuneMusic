# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# AirPlay (UxPlay JNI bridge) — native methods and the callback methods invoked
# by name from android_raop_callbacks.c must not be stripped or renamed.
-keep class com.adg.airtunemusic.airplay.AirPlayModule { *; }
-keep class com.adg.airtunemusic.airplay.AudioRenderer { *; }
-keepclasseswithmembernames class * {
    native <methods>;
}

# Unity Ads
-keep class com.unity3d.ads.** { *; }
-keep interface com.unity3d.ads.** { *; }
-keep class com.unity3d.services.** { *; }
-keep interface com.unity3d.services.** { *; }
