# 🎵 AirTune Music

<p align="center">
  <b>An Apple Music client for Android TV</b><br>
  Built with React Native
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Android%20TV-green.svg" alt="Android TV">
  <img src="https://img.shields.io/badge/React%20Native-0.83.0-blue.svg" alt="React Native">
  <img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript">
</p>

---

## ✨ Features

- **🌟 Personalized Discovery**: Quickly find recommendations and global hits via the "Listen Now" and "Browse" sections.
- **🔎 Search**: Find any song, album, artist, or playlist in the Apple Music catalog instantly — right from your TV.
- **📂 Library Access**: Your songs, albums, and playlists are synced and ready at your fingertips.
- **🎵 Real-Time Lyrics**: Sing along with perfectly synced, beautiful lyrics on the big screen.
- **🛜 AirPlay**: Stream audio from iPhone's Apple Music directly to the TV via AirPlay.
- **📻 Radio**: Listen to Apple Music Radio stations and your personal Apple Music radio directly on your TV.
- **📺 Music Videos**: Enjoy high-quality music videos from your library and the Apple Music catalog directly on your TV.
- **🎨 Dynamic Backgrounds**: Stunning visuals that adapt and change color based on the current album art.
- **📲 Quick Sign-in (TV-Link)**: Sign in securely in seconds using a QR code — no typing passwords with a remote!
- **🖥️ TV-Optimized Interface**: Navigate effortlessly with a UI designed specifically for Android TV remotes (D-pad).
- **🌙 Dark Mode Support**: A beautiful, eye-friendly dark interface designed for comfortable night-time viewing.
- **🌐 Multi-Language Support**: Use the app in your preferred language with comprehensive localization.

---

## 📸 Screenshots

<p align="center">
  <img src="src/assets/images/Screenshot_1774223677.png" width="400">
  <img src="src/assets/images/Screenshot_1774223689.png" width="400">
</p>
<p align="center">
  <img src="src/assets/images/Screenshot_1774223696.png" width="400">
  <img src="src/assets/images/Screenshot_1774223726.png" width="400">
</p>
<p align="center">
  <img src="src/assets/images/screenshot.png" width="400">
</p>

---

## 📲 Download

Available on the **Google Play Store**:

[<img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" width="200">](https://play.google.com/store/apps/details?id=com.adg.airtune)

~~## 🧪 Testing (Closed Beta)~~

~~AirTune is currently in **Closed Beta**. To install the app on your Android TV, please follow these steps:~~

~~1. **Join the Testers Group**: [Join our Google Group](https://groups.google.com/g/airtune-testers/) first. You must join using the same Google account you use for the Play Store.~~
~~2. **Opt-in to Testing**: After joining the group, [Opt-in to the Testing Program](https://play.google.com/apps/testing/com.adg.airtune) here.~~
~~3. **Download the app**: Once opted in, download it directly from the [Play Store](https://play.google.com/store/apps/details?id=com.adg.airtune).~~

~~> If you were a tester of the previous version, you're already in the Google Group — you can skip step 1 and download the new listing directly once it's live.~~

---

## 🛠 Technical Overview

| Area      | Technology                             |
| --------- | -------------------------------------- |
| Framework   | React Native (`react-native-tvos`)     |
| Language    | TypeScript                             |
| API         | Apple Music API (REST)                 |
| Auth        | MusicKit JS (via Local Pairing Server) |
| Lyrics      | [LRCLIB](https://lrclib.net/)          |
| AirPlay     | UxPlay-based native AirPlay receiver   |
### Local Pairing Server (TV Link)

Because Android TV lacks a convenient keyboard, this app uses a dedicated **pairing flow**:

1. The TV app starts a **built-in local web server**.
2. User goes to the TV's IP (e.g., `http://192.168.1.50:8080/tv`) on a phone.
3. User signs in via Apple MusicKit JS on the mobile browser.
4. The token is sent back to the TV instantly.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: >= 20.x
- **Yarn**: Recommended
- **Java**: Version 17 (for Android builds)
- **Apple Music Developer Token**: Required for API access.

### Installation

1. Clone the repository: `git clone https://github.com/alidogangullu/AirTuneMusic.git`
2. Install dependencies: `yarn install`
3. Configure environment: Copy `.env.example` to `.env.local` and add your `APPLE_MUSIC_DEVELOPER_TOKEN`.
4. Build for Android TV: `yarn android`

For detailed setup instructions, see:

- [🚀 Run & Debug Guide](docs/ANDROID_TV_RUN_DEBUG.md)
- [🔑 Developer Token Setup](docs/DEVELOPER_TOKEN_SETUP.md)
- [📂 Project Structure](docs/PROJECT_STRUCTURE.md)
