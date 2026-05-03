# AirPlay Emulator Bridge

A development tool that makes the AirPlay receiver running inside an Android emulator discoverable and connectable from a real iPhone on the same Wi-Fi network.

---

## The Problem

The Android emulator runs behind NAT with the internal IP `10.0.2.15`. This address is only reachable from the host Mac — not from an iPhone on the same Wi-Fi. On top of that, the AirPlay receiver registers itself via mDNS (Bonjour) using NSD, but the emulator's mDNS traffic never reaches the local network. As a result:

- The iPhone cannot discover the receiver in the AirPlay list.
- Even with a manual connection attempt, the IP is unreachable.

---

## How It Works

The bridge solves both problems in three steps:

```
iPhone
  │  (1) mDNS discovery (_raop._tcp, _airplay._tcp)
  │       registered by dns-sd on the Mac
  ▼
Mac LAN IP (e.g. 192.168.1.123):7100
  │  (2) socat TCP proxy
  │       listens on the Mac's LAN interface, forwards to localhost
  ▼
localhost:7100
  │  (3) adb forward
  │       tunnels the connection over USB/ADB into the emulator
  ▼
Emulator 10.0.2.15:7100  ←  AirPlay native server (libairplay_native.so)
```

### Step 1 — Read service metadata from logcat

When the AirPlay receiver starts, `AirPlayService.kt` logs the exact service name, port, and TXT records produced by the native library:

```
BRIDGE_RAOP_NAME=AABBCCDDEEFF@AirTune
BRIDGE_AIRPLAY_NAME=AirTune
BRIDGE_PORT=7100
BRIDGE_RAOP_TXT=vv=2|ch=2|pk=<ed25519-pubkey>|...
BRIDGE_AIRPLAY_TXT=features=0x...|deviceid=aa:bb:cc:dd:ee:ff|pk=<ed25519-pubkey>|...
```

The script reads these from `adb logcat` and uses them verbatim. This is critical — the `pk` (Ed25519 public key) and `deviceid` fields must match the running server or the iPhone will reject the pairing handshake.

### Step 2 — TCP port forwarding (`adb forward` + `socat`)

```bash
adb forward tcp:7100 tcp:7100
```

This makes `localhost:7100` on the Mac tunnel into the emulator's port 7100 over the existing ADB connection.

```bash
socat TCP-LISTEN:7100,fork,reuseaddr,bind=192.168.1.123 TCP:127.0.0.1:7100
```

`adb forward` only binds to `127.0.0.1`, which is not reachable from the iPhone. `socat` bridges the Mac's external LAN interface to `localhost`, so iPhone TCP connections arrive at the emulator.

### Step 3 — mDNS advertisement (`dns-sd`)

```bash
dns-sd -R "AABBCCDDEEFF@AirTune" _raop._tcp local 7100 vv=2 ch=2 pk=... ...
dns-sd -R "AirTune" _airplay._tcp local 7100 features=0x... deviceid=... pk=... ...
```

`dns-sd` registers two Bonjour services on the Mac. The iPhone's AirPlay stack browses for `_raop._tcp` and `_airplay._tcp` on the local network, finds the Mac's entry, and connects to `192.168.1.123:7100` — which socat forwards into the emulator.

---

## Prerequisites

| Tool | Install |
|------|---------|
| `adb` | Android SDK Platform Tools |
| `socat` | `brew install socat` |
| `dns-sd` | Built into macOS |

---

## Usage

**1. Build and run the app on the emulator.**

**2. Start the AirPlay receiver inside the app** (Settings → AirPlay or the receiver toggle).

**3. Run the bridge:**

```bash
./scripts/airplay-emulator-bridge.sh
```

The script polls logcat for up to 90 seconds waiting for the `BRIDGE_` lines. Once found, it sets up forwarding and mDNS and prints:

```
[1/3] adb forward tcp:7100 tcp:7100
[2/3] socat 192.168.1.123:7100 → localhost:7100
[3/3] mDNS kaydı yayınlanıyor...
===========================================
  Bridge active!
  Look for 'AirTune' in the iPhone AirPlay list
  Mac IP: 192.168.1.123  Port: 7100
  Press Ctrl+C to stop
===========================================
```

**4. On iPhone:** Control Center → tap the AirPlay icon → select **AirTune** (or whatever device name was configured).

**5. Press `Ctrl+C` to shut down.** The script cleans up `adb forward`, socat, and the dns-sd registrations automatically.

---

## Troubleshooting

**Script exits saying "bridge info not found"**

The `BRIDGE_` log lines haven't appeared yet. Check whether the AirPlay receiver was actually started in the app:

```bash
adb logcat -d | grep "BRIDGE_"
```

If empty, start the receiver first, then re-run the script.

**Device appears in AirPlay list but connection fails**

- Make sure Mac and iPhone are on the same Wi-Fi network.
- Check that no firewall is blocking port 7100 on the Mac (`System Settings → Network → Firewall`).
- Verify socat is running: `ps aux | grep socat`

**Device does not appear in AirPlay list at all**

- Confirm dns-sd processes are running: `ps aux | grep dns-sd`
- Check for port conflict — another process may already be using port 7100 on the Mac.

---

## Android-side instrumentation

The log lines are emitted in `AirPlayService.kt` immediately after the native server starts:

```kotlin
log("BRIDGE_RAOP_NAME=$raopName")
log("BRIDGE_AIRPLAY_NAME=$serverName")
log("BRIDGE_PORT=$port")
log("BRIDGE_RAOP_TXT=${raopTxt.entries.joinToString("|") { "${it.key}=${it.value}" }}")
log("BRIDGE_AIRPLAY_TXT=${airplayTxt.entries.joinToString("|") { "${it.key}=${it.value}" }}")
```

These lines are development-only. They do not affect production behaviour — the TXT records are already sent to NSD regardless. The `log()` helper maps to `Log.d(TAG, ...)`.

---

## Why not use the emulator's own mDNS?

Android's `NsdManager` does register the services inside the emulator, but the emulator's virtual network interface (`10.0.2.15`) is isolated. mDNS packets sent from it never reach the host's Wi-Fi interface, so they are invisible to any other device on the LAN. Registering from the Mac with `dns-sd` is the only way to make the service visible network-wide without modifying the emulator's network configuration.
