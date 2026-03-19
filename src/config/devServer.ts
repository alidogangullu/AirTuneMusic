/**
 * Dev-server configuration for __DEV__ builds.
 *
 * The Android emulator uses 10.0.2.2 to reach the host machine's localhost.
 * A real device on the same WiFi needs the host's LAN IP.
 *
 * Detection: emulator model names contain "sdk" (e.g. "sdk_google_atv64_arm64").
 */
import {Platform} from 'react-native';

// ── Change this when your Mac's IP changes ──────────────────────
const LAN_HOST = '192.168.1.243';
// ─────────────────────────────────────────────────────────────────

const EMULATOR_HOST = '10.0.2.2';
const PORT = 8080;

function isEmulator(): boolean {
  if (Platform.OS !== 'android') return false;
  const model: string =
    (Platform.constants as Record<string, unknown>)?.Model as string ?? '';
  return /sdk|emulator|generic/i.test(model);
}

const HOST = isEmulator() ? EMULATOR_HOST : LAN_HOST;

/** Base URL of the local dev server (tv-link auth page, etc.) */
export const DEV_SERVER = `http://${HOST}:${PORT}`;
