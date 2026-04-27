# MusicKit Android Playback – Implementation Guide & Findings

> **Project**: AirTuneMusic (React Native Android TV)  
> **Date**: March 2026  
> **Stack**: React Native (react-native-tvos 0.83), Kotlin, MusicKit Android SDK v1.1.2

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [SDK Setup & Configuration](#sdk-setup--configuration)
3. [Native Module (Kotlin)](#native-module-kotlin)
4. [JS Service Layer](#js-service-layer)
5. [React Hook & Provider](#react-hook--provider)
6. [Screen Integration](#screen-integration)
7. [Crashes Resolved](#crashes-resolved)
8. [SDK API Reference (Decompiled)](#sdk-api-reference-decompiled)
9. [Emulator Limitations](#emulator-limitations)
10. [Deploying to a Real Android TV](#deploying-to-a-real-android-tv)
11. [File Inventory](#file-inventory)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  ContentDetailScreen.tsx                            │
│  (handlePlay / handleShuffle / handleTrackPress)    │
└──────────────────┬──────────────────────────────────┘
                   │ usePlayer() hook
┌──────────────────▼──────────────────────────────────┐
│  usePlayer.tsx — PlayerProvider (React Context)      │
│  Subscribes to all native events, exposes state      │
└──────────────────┬──────────────────────────────────┘
                   │ musicPlayer service calls
┌──────────────────▼──────────────────────────────────┐
│  musicPlayer.ts — JS service wrapper                 │
│  ensureConfigured() → getDeveloperToken + userToken  │
│  playAlbum / playPlaylist / playSong / transport      │
└──────────────────┬──────────────────────────────────┘
                   │ NativeModules.MusicPlayer (bridge)
┌──────────────────▼──────────────────────────────────┐
│  MusicPlayerModule.kt — Native Kotlin Module         │
│  MediaPlayerController + Listener callbacks          │
│  Events → DeviceEventManagerModule.RCTDeviceEventEmitter │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│  Apple MusicKit Android SDK (AAR)                    │
│  mediaplayback-release-1.1.1.aar (playback)          │
│  musickitauth-release-1.1.2.aar (auth/token)         │
└─────────────────────────────────────────────────────┘
```

---

## SDK Setup & Configuration

### AAR Files

Place in `android/app/libs/`:
- `musickitauth-release-1.1.2.aar` (~220KB) — Auth + TokenProvider interface
- `mediaplayback-release-1.1.1.aar` (~10.2MB) — Playback controller + native JNI libs (`libappleMusicSDK.so` for `arm64-v8a` and `armeabi-v7a` only)

### build.gradle (app-level)

```groovy
dependencies {
    implementation fileTree(dir: 'libs', include: ['*.aar'])
    // ... other deps
}
```

### gradle.properties

```properties
# CRITICAL: MusicKit AAR only contains ARM native libs.
# Including x86/x86_64 causes UnsatisfiedLinkError because Android
# only looks for native libs in the ABI folder that matches the device.
# If an x86_64 folder exists (from other libs) but doesn't have
# libappleMusicSDK.so, loading fails even on ARM emulators.
reactNativeArchitectures=armeabi-v7a,arm64-v8a
```

### AndroidManifest.xml

```xml
<application
    android:allowBackup="false"
    tools:replace="android:allowBackup"
    ...>

    <!-- Required by MusicKit SDK — must declare or manifest merger fails -->
    <activity
        android:name="com.apple.android.sdk.authentication.SDKUriHandlerActivity"
        android:exported="false"
        tools:node="merge" />
</application>
```

Don't forget `xmlns:tools="http://schemas.android.com/tools"` on the `<manifest>` tag.

### MainApplication.kt

```kotlin
override fun getPackages(): List<ReactPackage> =
    PackageList(this).packages.apply {
        add(MusicPlayerPackage())
    }
```

---

## Native Module (Kotlin)

### Key File: `MusicPlayerModule.kt`

**Location**: `android/app/src/main/java/com/airtunemusic/musicplayer/MusicPlayerModule.kt`

### Critical Implementation Details

#### 1. Native Library Loading

The SDK does **NOT** call `System.loadLibrary()` itself. You must load it manually before creating the controller:

```kotlin
companion object {
    private var nativeLibLoaded = false

    private fun ensureNativeLib() {
        if (!nativeLibLoaded) {
            System.loadLibrary("appleMusicSDK")
            nativeLibLoaded = true
        }
    }
}
```

#### 2. Main Thread Requirement

`MediaPlayerControllerFactory.createLocalController()` uses JavaCPP under the hood. The JNI initialization overflows the limited stack size (~1MB) of the React Native NativeModules background thread. **Must run on the main thread**:

```kotlin
private val mainHandler = Handler(Looper.getMainLooper())

@ReactMethod
fun configure(devToken: String, usrToken: String, promise: Promise) {
    storedDevToken = devToken
    storedUsrToken = usrToken

    if (player != null) {
        promise.resolve(true)
        return
    }

    mainHandler.post {
        try {
            ensureNativeLib()

            val tokenProvider = object : TokenProvider {
                override fun getDeveloperToken(): String = storedDevToken ?: ""
                override fun getUserToken(): String = storedUsrToken ?: ""
            }

            player = MediaPlayerControllerFactory.createLocalController(
                reactContext.applicationContext,
                mainHandler,      // Handler overload — important!
                tokenProvider
            )
            player?.addListener(this)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CONFIGURE_ERROR", e.message, e)
        }
    }
}
```

#### 3. Kotlin Property Name Clash (Infinite Recursion Bug)

**DO NOT** name your token fields `developerToken` or `userToken`. Kotlin generates getter methods `getDeveloperToken()` and `getUserToken()` for private properties. When you implement `TokenProvider` as an anonymous object inside the same class, `getDeveloperToken()` resolves to `this.getDeveloperToken()` — the TokenProvider method — which then calls the property getter, which calls the TokenProvider method → **infinite recursion → StackOverflow crash**.

```kotlin
// ❌ BAD — causes infinite recursion
private var developerToken: String? = null  // generates getDeveloperToken()
val tokenProvider = object : TokenProvider {
    override fun getDeveloperToken(): String = developerToken ?: ""  // calls this.getDeveloperToken() → recursion!
}

// ✅ GOOD — use different names
private var storedDevToken: String? = null
private var storedUsrToken: String? = null
val tokenProvider = object : TokenProvider {
    override fun getDeveloperToken(): String = storedDevToken ?: ""
    override fun getUserToken(): String = storedUsrToken ?: ""
}
```

#### 4. Playing Content

```kotlin
private fun playContainer(containerType: Int, containerId: String, startIndex: Int, shuffle: Boolean, promise: Promise) {
    val p = player ?: run {
        promise.reject("NOT_CONFIGURED", "Call configure() first")
        return
    }
    mainHandler.post {
        try {
            val builder = CatalogPlaybackQueueItemProvider.Builder()
                .containers(containerType, containerId)
                .startItemIndex(startIndex)
            if (shuffle) {
                builder.shuffleMode(PlaybackShuffleMode.SHUFFLE_MODE_SONGS)
            }
            p.prepare(builder.build(), true)  // true = autoPlay
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PLAY_ERROR", e.message, e)
        }
    }
}

private fun playItem(itemType: Int, itemId: String, promise: Promise) {
    val p = player ?: run {
        promise.reject("NOT_CONFIGURED", "Call configure() first")
        return
    }
    mainHandler.post {
        try {
            val queue = CatalogPlaybackQueueItemProvider.Builder()
                .items(itemType, itemId)
                .build()
            p.prepare(queue, true)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PLAY_ERROR", e.message, e)
        }
    }
}
```

#### 5. NativeEventEmitter on Android

On Android, `NativeEventEmitter` uses `DeviceEventEmitter` under the hood. Pass `undefined` to avoid bridge issues:

```typescript
// JS side
const emitter = Platform.OS === 'android' ? new NativeEventEmitter() : null;
```

The native module must implement `addListener` and `removeListeners` to suppress warnings:

```kotlin
@ReactMethod
fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

@ReactMethod
fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Int) {}
```

Emit events via:

```kotlin
private fun sendEvent(name: String, params: WritableMap) {
    if (reactContext.hasActiveReactInstance()) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(name, params)
    }
}
```

---

## JS Service Layer

### Key File: `src/services/musicPlayer.ts`

- `ensureConfigured()` — fetches developer token + music user token, calls `MusicPlayer.configure()`, caches with `configured` flag
- All play methods (`playAlbum`, `playPlaylist`, `playSong`, `playStation`, `playMusicVideo`) await `ensureConfigured()` first
- Transport controls (`play`, `pause`, `stop`, `skipToNext`, `skipToPrevious`, `seekTo`) use `MusicPlayer?.method()` null guards
- `addEventListener<E>()` — typed event subscription using `NativeEventEmitter`
- `release()` — stops player and resets `configured = false`

### Music User Token Persistence

- Stored in MMKV under `@AirTuneMusic/music_user_token`
- `loadMusicUserToken()` called on app startup in `App.tsx`
- `getMusicUserToken()` returns in-memory cached value (synchronous)

---

## React Hook & Provider

### Key File: `src/features/player/hooks/usePlayer.tsx`

- `PlayerProvider` wraps the app (inside `ThemeProvider` in `App.tsx`)
- Subscribes to all native events on mount, unsubscribes on unmount
- Maintains `PlayerState` with: `playbackState`, `currentTrack`, `position`, `duration`, `buffered`, `isBuffering`, `shuffleMode`, `repeatMode`, `queueCount`
- `usePlayer()` hook returns state + all control functions with stable `useCallback` refs

---

## Screen Integration

### Key File: `src/features/content/ContentDetailScreen.tsx`

```typescript
const {
    playAlbum, playPlaylist, playStation, playSong, playMusicVideo,
    play, pause, /* ... */
} = usePlayer();

const handlePlay = useCallback(() => {
    (async () => {
        switch (contentType) {
            case 'album':    await playAlbum(contentId); break;
            case 'playlist': await playPlaylist(contentId); break;
            case 'station':  await playStation(contentId); break;
            default:         await playSong(contentId); break;
        }
    })().catch(e => console.warn('Play failed:', e));
}, [contentId, contentType, /* deps */]);

const handleTrackPress = useCallback((index: number) => {
    (async () => {
        switch (contentType) {
            case 'album':    await playAlbum(contentId, index); break;
            case 'playlist': await playPlaylist(contentId, index); break;
        }
    })().catch(e => console.warn('Track play failed:', e));
}, [contentId, contentType, /* deps */]);
```

---

## Crashes Resolved

### Crash 1: StackOverflow on JS Bridge Thread

**Error**: `Exception in HostFunction: stack size 1037KB`  
**Cause**: `createLocalController` and `player.prepare` running on NativeModules background thread with limited stack; JavaCPP JNI initialization overflows it.  
**Fix**: Move to `mainHandler.post { }` (main thread). Use the `createLocalController(context, mainHandler, tokenProvider)` overload.

### Crash 2: Infinite Recursion in getDeveloperToken

**Error**: Stack trace shows `getDeveloperToken` calling itself infinitely  
**Cause**: Kotlin property accessor name clash — `private var developerToken` generates `getDeveloperToken()` getter, which clashes with `TokenProvider.getDeveloperToken()`. The anonymous `object : TokenProvider` calling `developerToken` resolves to `this.getDeveloperToken()` → infinite recursion.  
**Fix**: Rename fields to `storedDevToken` / `storedUsrToken`.

### Crash 3: UnsatisfiedLinkError (Architecture)

**Error**: `No implementation found for com.apple.android.music.foothill.javanative.FootHillConfig.config`  
**Cause**: `reactNativeArchitectures` included `x86`/`x86_64`. When the APK has an `x86_64` folder (from other React Native libs), Android only looks for native libs in that ABI-specific folder. Since MusicKit AAR only ships ARM libs, `libappleMusicSDK.so` isn't found.  
**Fix**: Set `reactNativeArchitectures=armeabi-v7a,arm64-v8a` in `gradle.properties`.

### Crash 4: UnsatisfiedLinkError (Library Not Loaded)

**Error**: Same `FootHillConfig.config` JNI error even after architecture fix  
**Cause**: The SDK's JavaCPP layer doesn't call `System.loadLibrary()` itself.  
**Fix**: Add explicit `System.loadLibrary("appleMusicSDK")` call before `createLocalController`.

### Crash 5: Manifest Merger — allowBackup

**Error**: Manifest merger failed: `android:allowBackup` conflict  
**Fix**: Add `tools:replace="android:allowBackup"` to `<application>` tag.

### Crash 6: Manifest Merger — android:exported

**Error**: `SDKUriHandlerActivity` missing `android:exported`  
**Fix**: Declare the activity in your manifest with `android:exported="false"` and `tools:node="merge"`.

---

## SDK API Reference (Decompiled)

These were discovered by decompiling the AAR files with `javap`. The SDK has no public documentation for many of these.

### MediaContainerType (constants)

| Constant | Value |
|----------|-------|
| `NONE` | 0 |
| `ALBUM` | 1 |
| `PLAYLIST` | 2 |

> **No RADIO_STATION type exists.** For stations, use `playItem` with `MediaItemType.SONG`.

### MediaItemType (constants)

| Constant | Value |
|----------|-------|
| `UNKNOWN` | 0 |
| `SONG` | 1 |
| `UPLOADED_AUDIO` | 2 |

> **No MUSIC_VIDEO type exists.** Use `SONG` as fallback.

### PlaybackShuffleMode

| Constant | Value |
|----------|-------|
| `SHUFFLE_MODE_OFF` | 0 |
| `SHUFFLE_MODE_SONGS` | 1 |

> Note: It's `SHUFFLE_MODE_SONGS`, not `SONGS`.

### PlaybackRepeatMode

| Constant | Value |
|----------|-------|
| `REPEAT_MODE_OFF` | 0 |
| `REPEAT_MODE_ONE` | 1 |
| `REPEAT_MODE_ALL` | 2 |

### PlaybackState

| Constant | Value |
|----------|-------|
| `STOPPED` | 0 |
| `PLAYING` | 1 |
| `PAUSED` | 2 |

### MediaPlayerController.Listener (12 methods)

```
onPlaybackStateChanged(controller, previousState, currentState)
onPlaybackStateUpdated(controller)
onCurrentItemChanged(controller, previousItem, currentItem)
onItemEnded(controller, queueItem, endPosition)
onPlaybackError(controller, error)
onPlaybackQueueChanged(controller, queueItems)
onPlaybackQueueItemsAdded(controller, insertionType, containerType, itemType)
onPlaybackRepeatModeChanged(controller, currentRepeatMode)
onPlaybackShuffleModeChanged(controller, currentShuffleMode)
onBufferingStateChanged(controller, buffering)
onMetadataUpdated(controller, currentItem)
onPlayerStateRestored(controller)
```

> **No** `onAvailableTracksChanged` or `onVideoSizeChanged` methods exist.

### MediaPlayerController Key Methods

```
play(), pause(), stop()
skipToNextItem(), skipToPreviousItem()
seekToPosition(positionMs: Long)
setShuffleMode(mode: Int), setRepeatMode(mode: Int)
prepare(queueProvider, autoPlay: Boolean)
addListener(listener), removeListener(listener)
release()
currentPosition: Long, duration: Long, bufferedPosition: Long
playbackState: Int, shuffleMode: Int, repeatMode: Int
currentItem: PlayerQueueItem?, playbackQueueItemCount: Int, playbackQueueIndex: Int
```

### PlayerQueueItem

```
item: MediaItem  (has title, artistName, albumTitle, duration, getArtworkUrl(w, h))
playbackQueueId: Long
```

### CatalogPlaybackQueueItemProvider.Builder

```
containers(containerType: Int, containerId: String)
items(itemType: Int, vararg itemIds: String)
startItemIndex(index: Int)
shuffleMode(mode: Int)
build(): CatalogPlaybackQueueItemProvider
```

### createLocalController Overloads

```kotlin
// Basic — uses internal handler
MediaPlayerControllerFactory.createLocalController(context: Context, tokenProvider: TokenProvider)

// With Handler — recommended to avoid thread issues
MediaPlayerControllerFactory.createLocalController(context: Context, handler: Handler, tokenProvider: TokenProvider)
```

---

## Emulator Limitations

### DRM / Widevine

Apple Music content is DRM-protected (FairPlay/Widevine). The standard Android TV emulator images (`sdk_google_atv64_arm64`) ship with **only `libdrmclearkeyplugin.so`** — no Widevine.

**Symptoms on emulator:**
- SDK initializes successfully ✅
- `requestAudioFocus(USAGE_MEDIA)` called ✅
- `acquireWifiLock` called ✅
- `onPlaybackStateChanged: stopped -> playing` ✅
- `onCurrentItemChanged` fires with correct track info ✅
- `onPlaybackQueueChanged` fires with correct count ✅
- Progress timer runs ✅
- **BUT**: `currentPosition = -1`, `duration = -1`, `bufferedPosition = -1`
- `onBufferingStateChanged: buffering=true` fires but **never** transitions to `false`
- No audio output
- `pcm_writei failed with 'cannot read/write stream data: I/O error'` in HAL logs

**Verification commands:**
```bash
# Check DRM plugins — should show libwidevinecdm.so for real playback
adb shell "ls /vendor/lib64/mediadrm/ /vendor/lib/mediadrm/ /system/lib64/mediadrm/ /system/lib/mediadrm/ 2>/dev/null"

# Check emulator image type
adb shell getprop ro.build.flavor
# sdk_google_atv64_arm64 = no Widevine
# google_atv_playstore = has Widevine (if available)
```

**Solution**: Test on a **real Android device** with Google Play Services (any Android phone/tablet/TV with Widevine L1 or L3).

### Audio HAL Errors

The emulator's audio HAL (`android.hardware.audio@7.1-impl.ranchu`) produces `pcm_writei failed` errors. These are **unrelated to the app** — it's an emulator-level audio driver issue. Button/click sounds work because they use a different audio path.

---

## Deploying to a Real Android TV

### Prerequisites

- Mac and Android TV must be on the **same WiFi network**.
- TV must have **Developer options** enabled (Settings → About → tap "Build number" 7 times).

### Step 1: Connect via ADB over WiFi

On the TV, go to **Settings → Developer options → Wireless debugging** (Android 11+):

1. Enable **Wireless debugging**.
2. Tap **Pair device with pairing code** — note the **IP:port** and **6-digit code** shown.
3. On Mac:
   ```bash
   adb pair <IP>:<PAIRING_PORT>
   # Enter the 6-digit code when prompted
   ```
4. After pairing succeeds, connect:
   ```bash
   adb connect <IP>:<DEBUG_PORT>
   # The debug port is shown on the Wireless debugging screen (different from pairing port)
   ```
5. Verify:
   ```bash
   adb devices
   # Should show the device as "device" (not "offline")
   ```

> **If the device shows "offline"**: check the TV screen for an "Allow USB debugging?" prompt and accept it.

### Step 2: Port Forwarding

The debug APK loads JS from Metro bundler (port 8081) and uses the TV-link server (port 8080). Since the TV connects over WiFi, use `adb reverse` to forward these ports from the TV to your Mac:

```bash
adb reverse tcp:8081 tcp:8081   # Metro bundler
adb reverse tcp:8080 tcp:8080   # TV-link server
```

> **Without this**, the app shows a red "Unable to load script" error because the TV can't reach `localhost:8081`.

### Step 3: Start Metro Bundler

If Metro isn't already running:

```bash
cd /path/to/AirTuneMusic
npx react-native start
```

### Step 4: Start TV-Link Server

```bash
node tv-link-page/server.mjs
```

This serves the auth page and provides the developer token + code-to-token exchange endpoints.

### Step 5: Install & Launch

```bash
# Build (if not already built)
cd android && ./gradlew assembleDebug && cd ..

# Install
adb install -r android/app/build/outputs/apk/debug/app-debug.apk

# Launch
adb shell am start -n com.airtunemusic/.MainActivity
```

### Step 6: Apple Music Authentication

1. On the TV app, navigate to the auth screen — a **6-digit code** will appear.
2. On your **phone or computer browser**, open: `http://<MAC_IP>:8080/tv`  
   (e.g., `http://192.168.1.243:8080/tv`)
3. Enter the 6-digit code → Sign in with Apple Music.
4. The TV app automatically receives the Music User Token and proceeds.

### Network Configuration (`src/config/devServer.ts`)

The app auto-detects whether it's running on an emulator or a real device:

- **Emulator**: uses `10.0.2.2` (Android emulator's alias for host localhost)
- **Real device**: uses `LAN_HOST` (your Mac's local IP)

```typescript
const LAN_HOST = '192.168.1.243';  // ← Update this when your Mac's IP changes
```

On a real device, the API client talks **directly** to `api.music.apple.com` (no proxy needed). The proxy is only used on emulators that can't reach external hosts.

### Quick Reference (all commands in order)

```bash
# 1. Pair (one time only)
adb pair 192.168.1.154:<PAIR_PORT>

# 2. Connect
adb connect 192.168.1.154:<DEBUG_PORT>

# 3. Port forwarding
adb reverse tcp:8081 tcp:8081
adb reverse tcp:8080 tcp:8080

# 4. Start servers (in separate terminals)
npx react-native start          # Metro
node tv-link-page/server.mjs    # TV-link

# 5. Install & run
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.airtunemusic/.MainActivity

# 6. Auth: open http://<MAC_IP>:8080/tv on phone, enter code from TV
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| Red screen "Unable to load script" | Run `adb reverse tcp:8081 tcp:8081` and restart the app |
| `adb connect` fails with "No route to host" | ADB debugging not enabled on TV, or wrong port |
| Device shows "offline" in `adb devices` | Accept the USB debugging prompt on the TV screen |
| `adb pair` command not found | Update to ADB 30+ (`adb --version`) |
| TV-link page can't be opened from phone | Ensure Mac firewall allows port 8080, use Mac's LAN IP not localhost |

---

## File Inventory

| File | Purpose |
|------|---------|
| `android/app/libs/mediaplayback-release-1.1.1.aar` | MusicKit playback SDK with native JNI libs |
| `android/app/libs/musickitauth-release-1.1.2.aar` | MusicKit auth SDK + TokenProvider interface |
| `android/app/src/main/java/com/airtunemusic/musicplayer/MusicPlayerModule.kt` | Native bridge module — wraps MediaPlayerController |
| `android/app/src/main/java/com/airtunemusic/musicplayer/MusicPlayerPackage.kt` | ReactPackage registration |
| `android/app/src/main/java/com/airtunemusic/MainApplication.kt` | App entry — registers MusicPlayerPackage |
| `android/app/src/main/AndroidManifest.xml` | Manifest with SDK activity + tools:replace |
| `android/gradle.properties` | ARM-only architectures |
| `android/app/build.gradle` | AAR fileTree dependency |
| `src/services/musicPlayer.ts` | Typed JS wrapper for NativeModules.MusicPlayer |
| `src/features/player/hooks/usePlayer.tsx` | PlayerProvider context + usePlayer hook |
| `src/api/apple-music/musicUserToken.ts` | MMKV-persisted music user token store |
| `src/api/apple-music/getDeveloperToken.ts` | Developer token fetch/cache |
| `src/features/content/ContentDetailScreen.tsx` | Play/shuffle/track-press handlers |
| `App.tsx` | Wraps app with PlayerProvider |

---

## Events Emitted (Native → JS)

| Event Name | Payload |
|------------|---------|
| `onPlaybackStateChanged` | `{ state, previousState }` |
| `onCurrentItemChanged` | `{ title, artistName, albumTitle, artworkUrl, duration, trackIndex, playbackQueueId }` |
| `onPlaybackProgress` | `{ position, duration, buffered }` (every 1s while playing) |
| `onPlaybackError` | `{ message }` |
| `onBufferingStateChanged` | `{ buffering }` |
| `onPlaybackQueueChanged` | `{ count }` |
| `onShuffleModeChanged` | `{ shuffleMode }` |
| `onRepeatModeChanged` | `{ repeatMode }` |
| `onItemEnded` | `{ title, endPosition }` |

---

## Debugging Checklist

1. **No crash but no audio?** → Check Widevine: `adb shell ls /vendor/lib64/mediadrm/`
2. **pos=-1, dur=-1?** → DRM issue, test on real device
3. **StackOverflow on configure?** → Ensure `createLocalController` runs on main thread via `Handler`
4. **Infinite recursion in getDeveloperToken?** → Rename token fields to avoid Kotlin accessor clash
5. **UnsatisfiedLinkError?** → (a) Remove x86/x86_64 from architectures, (b) Call `System.loadLibrary("appleMusicSDK")` manually
6. **Manifest merger fails?** → Add `tools:replace` and declare `SDKUriHandlerActivity`
7. **NativeEventEmitter warning?** → Implement `addListener`/`removeListeners` in native module
8. **Multiple playContainer calls?** → Check for re-render issues in ContentDetailScreen (useCallback deps)
