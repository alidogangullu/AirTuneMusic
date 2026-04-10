# 🎵 AirTune Music

<p align="center">
  <b>An Apple Music client for Android TV</b><br>
  Built with React Native
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Android%20TV-green.svg" alt="Android TV">
  <img src="https://img.shields.io/badge/React%20Native-0.83.0-blue.svg" alt="React Native">
  <img src="https://img.shields.io/badge/TypeScript-Ready-blue.svg" alt="TypeScript">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License">
</p>

---

## ✨ Features

- **📺 Native TV Experience**: Fully optimized for D-pad navigation and remote control interaction.
- **💎 Native UI**: Modern native-like interface with dynamic background color extraction from artwork.
- **📱 TV Link Pairing**: Easy sign-in using your phone or PC via a local pairing server—no clunky TV keyboard required.
- **🎼 Full Library Access**: Browse your playlists, albums, and "Listen Now" recommendations.
- **📻 Apple Music Radio**: Stream your favorite stations and algorithmic radio.
- **🚀 Performance**: Built on `react-native-tvos` for smooth performance on hardware.

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

---

## 🔗 Download

<p align="center">
  <a href="https://play.google.com/store/apps/details?id=com.airtunemusic">
    <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" width="240">
  </a>
</p>

---

## 🛠 Technical Overview

| Area      | Technology                             |
| --------- | -------------------------------------- |
| Framework | React Native (`react-native-tvos`)     |
| Language  | TypeScript                             |
| API       | Apple Music API (REST)                 |
| Auth      | MusicKit JS (via Local Pairing Server) |

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
