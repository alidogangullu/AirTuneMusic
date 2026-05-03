#!/usr/bin/env bash
# AirPlay Emulator Bridge
# Emülatördeki AirPlay sunucusunu Mac üzerinden iPhone'a köprüler.
#
# Gereksinimler: adb, socat, dns-sd (macOS built-in)
#   socat yoksa: brew install socat

set -uo pipefail

extract() {
  # extract KEY from "...KEY=value..." — macOS uyumlu sed
  echo "$1" | sed -n "s/.*${2}=\([^ ]*\).*/\1/p" | head -1
}

MAC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
if [[ -z "$MAC_IP" ]]; then
  echo "HATA: Mac'in LAN IP'si bulunamadı. Wi-Fi bağlı mı?"
  exit 1
fi
echo "Mac IP: $MAC_IP"

if ! command -v socat &>/dev/null; then
  echo "HATA: socat bulunamadı. Yüklemek için: brew install socat"
  exit 1
fi

if ! adb get-state &>/dev/null; then
  echo "HATA: ADB cihazı bulunamadı. Emülatör açık mı?"
  exit 1
fi

echo ""
echo "Logcat'ten köprü bilgileri bekleniyor..."
echo "(Uygulamada AirPlay alıcısını henüz başlatmadıysanız şimdi başlatın)"
echo ""

RAOP_NAME=""
AIRPLAY_NAME=""
PORT=""
RAOP_TXT=""
AIRPLAY_TXT=""

DEADLINE=$((SECONDS + 90))
while [[ $SECONDS -lt $DEADLINE ]]; do
  LINES=$(adb logcat -d 2>/dev/null | grep "BRIDGE_" || true)

  if [[ -n "$LINES" ]]; then
    RAOP_NAME=$(extract   "$LINES" "BRIDGE_RAOP_NAME")
    AIRPLAY_NAME=$(extract "$LINES" "BRIDGE_AIRPLAY_NAME")
    PORT=$(extract        "$LINES" "BRIDGE_PORT")
    # TXT satırları logcat'te her biri ayrı satırda — boşluk içerebilir
    RAOP_TXT=$(echo "$LINES"    | grep "BRIDGE_RAOP_TXT="    | sed 's/.*BRIDGE_RAOP_TXT=//'    | head -1 || true)
    AIRPLAY_TXT=$(echo "$LINES" | grep "BRIDGE_AIRPLAY_TXT=" | sed 's/.*BRIDGE_AIRPLAY_TXT=//' | head -1 || true)
  fi

  if [[ -n "$PORT" && -n "$RAOP_NAME" ]]; then
    break
  fi
  sleep 2
  echo -n "."
done

if [[ -z "$PORT" ]]; then
  echo ""
  echo "HATA: 90 saniye içinde köprü bilgileri alınamadı."
  echo "Uygulamada AirPlay alıcısını başlattığınızdan emin olun."
  echo ""
  echo "Debug için: adb logcat -d | grep BRIDGE_"
  exit 1
fi

echo ""
echo "Alındı:"
echo "  RAOP adı     : $RAOP_NAME"
echo "  AirPlay adı  : $AIRPLAY_NAME"
echo "  Port         : $PORT"

cleanup() {
  echo ""
  echo "Temizleniyor..."
  kill "$SOCAT_PID" 2>/dev/null || true
  kill "$RAOP_DNS_PID" 2>/dev/null || true
  kill "$AIRPLAY_DNS_PID" 2>/dev/null || true
  adb forward --remove "tcp:$PORT" 2>/dev/null || true
  echo "Köprü kapatıldı."
}
trap cleanup EXIT INT TERM

# 1. adb forward: Mac localhost:PORT → emülatör:PORT
echo ""
echo "[1/3] adb forward tcp:$PORT tcp:$PORT"
adb forward "tcp:$PORT" "tcp:$PORT"

# 2. socat: Mac LAN IP:PORT → localhost:PORT
echo "[2/3] socat $MAC_IP:$PORT → localhost:$PORT"
socat "TCP-LISTEN:$PORT,fork,reuseaddr,bind=$MAC_IP" "TCP:127.0.0.1:$PORT" &
SOCAT_PID=$!

# 3. mDNS — TXT record'ları "|" ile ayrılmış, dns-sd'ye ayrı argüman olarak geç
build_txt_args() {
  local IFS='|'
  local args=()
  for pair in $1; do
    args+=("$pair")
  done
  echo "${args[@]+"${args[@]}"}"
}

echo "[3/3] mDNS kaydı yayınlanıyor..."

RAOP_ARGS=$(build_txt_args "$RAOP_TXT")
dns-sd -R "$RAOP_NAME" _raop._tcp local "$PORT" $RAOP_ARGS &
RAOP_DNS_PID=$!

AIRPLAY_ARGS=$(build_txt_args "$AIRPLAY_TXT")
dns-sd -R "$AIRPLAY_NAME" _airplay._tcp local "$PORT" $AIRPLAY_ARGS &
AIRPLAY_DNS_PID=$!

echo ""
echo "==========================================="
echo "  Köprü aktif!"
echo "  iPhone'da AirPlay listesinde '$AIRPLAY_NAME' görünmeli"
echo "  Mac IP: $MAC_IP  Port: $PORT"
echo "  Durdurmak için Ctrl+C"
echo "==========================================="

wait "$SOCAT_PID"
