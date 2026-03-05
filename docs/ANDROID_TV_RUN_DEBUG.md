# Android TV Emulator — Run & Debug

## Requirements

- `ANDROID_HOME` or `ANDROID_SDK_ROOT` must be set (e.g. in `~/.zshrc`).
- AVD `Android_TV_API36` (or your TV AVD) must be created.
- **Java 17** must be installed for Android build (AGP 8.x).

## Run

1. **Start the TV emulator** (in one terminal):
   ```bash
   npm run emulator:tv
   ```
   or:
   ```bash
   emulator -avd Android_TV_API36
   ```

2. After the emulator is up, **deploy the app** (in another terminal):
   ```bash
   npm run android
   ```
   If only one device/emulator is connected, the app is installed there.

3. **If multiple devices/emulators are connected**, select the TV emulator:
   ```bash
   npm run android:tv
   ```
   Choose the Android TV emulator from the list.

## Debug (Cursor / VS Code)

1. Ensure **React Native Tools** extension is installed.
2. Start the TV emulator: `npm run emulator:tv`.
3. In Cursor: **Run and Debug** (Ctrl+Shift+D / Cmd+Shift+D) → **Debug Android (Expo)** and start with F5; or run the app with `npm run android` first, then **Attach to Android** to attach the debugger.

## Command summary

| Goal | Command |
|------|---------|
| Start TV emulator | `npm run emulator:tv` |
| Run app | `npm run android` |
| Run app (choose device) | `npm run android:tv` |
