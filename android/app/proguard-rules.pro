# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Keep native methods (required for JNI/C++ bridging)
-keepclasseswithmembernames class * {
    native <methods>;
}

# AirPlay (UxPlay JNI bridge) & other custom Kotlin native modules for React Native.
# These are called via reflection by React Native or JNI, so they must not be stripped or renamed.
-keep class com.adg.airtune.airplay.** { *; }
-keep class com.adg.airtune.imagecolors.** { *; }
-keep class com.adg.airtune.musicplayer.** { *; }
-keep class com.adg.airtune.tv.** { *; }

# Keep Main application classes
-keep class com.adg.airtune.MainActivity { *; }
-keep class com.adg.airtune.MainApplication { *; }

# Ignore missing classes from bytedeco javacpp / Maven / SLF4J
-dontwarn org.apache.maven.**
-dontwarn org.slf4j.**
-dontwarn org.bytedeco.javacpp.**

# Ignore stack map table warnings from Apple MusicKit SDK
-dontwarn com.apple.**
