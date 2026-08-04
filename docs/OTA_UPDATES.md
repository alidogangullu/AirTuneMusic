# OTA Updates Guide (AirTune Music)

AirTune Music uses a **Self-Hosted Expo OTA Updates Server** deployed on Vercel. 
We do **not** use `eas update` directly to Expo's servers due to the free tier limits.

## Update Server
- **Infrastructure:** A custom Next.js application hosted on Vercel. 
- **Note on Open Source:** While AirTune Music is open source, the custom OTA update server (and its dashboard) is kept private as it manages production deployment traffic and analytics for the official Play Store release.

## How to Publish an OTA Update

Whenever you make a JavaScript or asset change that doesn't require native changes (i.e. you haven't touched Java/Kotlin/Objective-C/C++ or native dependencies), you can publish an OTA update.

### Step 1: Export the bundle
Inside the `AirTuneMusic` project directory:
```bash
npx expo export -p android
```
*(Note: We only build for Android TV, iOS is not supported)*

This generates a `dist` folder containing `metadata.json` and the `_expo/` assets.

### Step 2: Copy to the Server
Switch to the updates server directory and create a new timestamp folder under the current `runtimeVersion` (e.g. `1.18.0`).

```bash
cd ../airtune-updates-server
TIMESTAMP=$(date +%s)
mkdir -p updates/1.18.0/$TIMESTAMP
cp -R ../AirTuneMusic/dist/* updates/1.18.0/$TIMESTAMP/
```

### Step 3: Deploy
Commit the changes and push to Vercel:
```bash
git add updates
git commit -m "Deploy new OTA update"
git push
```
*(If Vercel CLI is set up, you can also run `vercel deploy --prod --yes`)*

Once deployed, any device running `runtimeVersion` `1.18.0` will download and apply this update on the next launch.

## Important Notes
- **Native Changes:** If you change native code, you **MUST** increment the `versionCode` in `android/app/build.gradle` and change the `runtimeVersion` in `app.json`. You cannot use OTA to deploy native changes.
## How to Remove / Delete an Update

If you pushed an update by mistake and want to remove it entirely from the server:
1. Navigate to the `updates/<runtimeVersion>/<timestamp>` directory in the `airtune-updates-server` project.
2. Delete the specific timestamp folder.
3. Commit and push the deletion to Vercel:
   ```bash
   rm -rf updates/1.18.0/<TIMESTAMP_TO_DELETE>
   git add updates
   git commit -m "Remove bad update"
   git push
   ```
*Note: Devices that already downloaded the bad update will keep it until a newer update is published or a rollback is issued.*

## Rollbacks (Forcing devices to revert)

If you pushed a broken update and users have already downloaded it, simply deleting it from the server won't remove it from devices. You must issue a **Rollback**.

A Rollback is a special directive that tells the Expo client to discard all downloaded OTA updates and revert to the version that was originally embedded inside the APK/AAB from the Play Store.

### How to issue a Rollback
1. Create a new timestamp folder just like a normal update.
2. Instead of copying the `dist` contents, create an empty file named `rollback` inside it.
   ```bash
   cd ../airtune-updates-server
   TIMESTAMP=$(date +%s)
   mkdir -p updates/1.18.0/$TIMESTAMP
   touch updates/1.18.0/$TIMESTAMP/rollback
   
   git add updates
   git commit -m "Emergency Rollback to embedded APK version"
   git push
   ```
When devices see this new timestamp, they will clear their cache and load the original code that shipped with the app.
