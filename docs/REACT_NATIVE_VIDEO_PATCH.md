# react-native-video Patch — Motion Artwork on Android TV

This document explains `patches/react-native-video+6.19.2.patch` so future changes
to **motion artwork** or **video clip playback** don't accidentally break it (or
mistakenly assume it applies to the wrong feature).

## TL;DR — which feature uses what

| Feature | Renderer | Touched by this patch? |
|---------|----------|------------------------|
| **Motion artwork** (looping muted cover videos on cards / now playing) | `react-native-video` (ExoPlayer/media3) — see `src/components/MotionArtworkCover.tsx` | **YES** |
| **Video clips / music videos** (full MV playback) | **WebView** running MusicKit JS — see `src/features/player/components/MusicKitVideoWebView.tsx` (used by `VideoPlayerModal.tsx`) | **NO** |

`react-native-video` is imported in **exactly one place**: `MotionArtworkCover.tsx`.
Video clips never touch ExoPlayer — they run inside `react-native-webview`. So
**this patch cannot affect video clip playback.** If you change the video clip
feature, this patch is irrelevant; if you change motion artwork, read on.

## Why the patch exists

All issues below were **Android TV / HDMI-only** (never reproduced on the
emulator, which has no real HDMI audio/video plane). Symptoms appeared when a
motion artwork video started **while music was playing**.

Every hunk is **gated on a prop** so non-motion players (and any hypothetical
future `react-native-video` use with sound/controls) are unaffected:

| Gate (prop from JS) | What the patch does | Problem it fixes |
|---------------------|---------------------|------------------|
| `selectedAudioTrack={type:'disabled'}` (`audioTrackType=="disabled"`) | Pre-disable the audio track in the `DefaultTrackSelector` **before** `prepare()`, and **skip `changeAudioOutput()`** entirely | ExoPlayer briefly opened a 2nd AudioTrack / touched audio routing on HDMI → momentary music dropout |
| `viewType={ViewType.TEXTURE}` (`VIEW_TYPE_TEXTURE`) | Implement the previously no-op `ExoPlayerView.updateSurfaceView`: route player output to a **TextureView** instead of PlayerView's SurfaceView; hide the SurfaceView via `INVISIBLE` (destroys its surface → no HDMI plane, but no layout reflow) | A SurfaceView opens a dedicated HDMI video plane; creating it on video start forced an HDMI composition/color-space **re-handshake** → audible music dropout **and** washed-out colors |
| `focusable={false}` | Set `playerView.descendantFocusability = FOCUS_BLOCK_DESCENDANTS` (vs default `FOCUS_BEFORE_DESCENDANTS` when focusable) | media3 PlayerView's controller button (`exo_play_pause`) is a **separate focusable descendant**. It grabbed D-pad focus when a motion video mounted; when the video unmounted, the focused button was removed → focus fell back to the first focusable (top-bar profile icon). `focusable={false}` alone only disabled PlayerView itself, not its controller children |

There are also two pre-existing hunks (older work, same file):
- `setMaxVideoSize(1920, 1080)` — cap HLS rendition; stops a 4K HEVC decoder
  spin-up that reconfigured the TV's AV pipeline.
- `setVideoChangeFrameRateStrategy(OFF)` — never call `Surface.setFrameRate()`;
  a 60→30 Hz mode switch resynced the HDMI/ARC link (dropout on soundbars) and
  could kick D-pad focus off the card.

## Files in the patch

- `android/.../exoplayer/ReactExoplayerView.java` — track selector audio disable,
  skip `changeAudioOutput`, max video size, frame-rate strategy, removed
  `AudioManager.setMode()/setSpeakerphoneOn()`.
- `android/.../exoplayer/ExoPlayerView.kt` — `updateSurfaceView` TextureView
  routing, `setFocusable` → `descendantFocusability`.

## Rules for future changes

- **Touching motion artwork (`MotionArtworkCover.tsx`)?** Keep these props or you
  reintroduce the bugs: `viewType={ViewType.TEXTURE}`, `focusable={false}`,
  `selectedAudioTrack={type:'disabled'}`, `muted`, `disableFocus`. The
  static-image overlay + reveal-on-progress choreography hides ExoPlayer's black
  start frames — don't remove it.
- **Touching video clips?** This patch is unrelated (WebView path). Don't look
  here for MV bugs.
- **Regenerating the patch:** edit files under `node_modules/react-native-video`,
  then `rm -rf node_modules/react-native-video/android/buildOutput_*` (so Gradle
  build artifacts don't pollute the diff) and run
  `npx patch-package react-native-video`. Verify the diff only contains the two
  files above.
- **Verifying on device:** the issues are HDMI-only — **test on a real Android TV,
  not the emulator.** Useful: a temporary `OnGlobalFocusChangeListener` in
  `MainActivity` logs every focus change (that's how the `exo_play_pause` focus
  theft was found); remove it after diagnosing.
