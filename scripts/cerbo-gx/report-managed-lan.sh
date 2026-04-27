#!/bin/sh
set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 022

CONFIG_FILE="${CONFIG_FILE:-/data/conf/managed-network-monitor.conf}"
TARGETS_FILE="${TARGETS_FILE:-/data/conf/managed-network-targets.txt}"
API_PATH="${API_PATH:-/api/cerbo/network-scan}"
TMP_DIR=""
DETECTED_IFACE=""

log() {
    printf '%s\n' "$*"
}

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
        rm -rf "$TMP_DIR"
    fi
}

trap cleanup EXIT HUP INT TERM

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || fail "Missing command: $1"
}

load_config() {
    [ -f "$CONFIG_FILE" ] || fail "Config file not found: $CONFIG_FILE"
    # shellcheck disable=SC1090
    . "$CONFIG_FILE"
    : "${SITE_URL:?SITE_URL must be set in $CONFIG_FILE}"
    : "${CERBO_INGEST_TOKEN:?CERBO_INGEST_TOKEN must be set in $CONFIG_FILE}"
    : "${VRM_SITE_ID:?VRM_SITE_ID must be set in $CONFIG_FILE}"

    SCAN_MODE="${SCAN_MODE:-auto}"
    SCAN_CIDR="${SCAN_CIDR:-}"
    MAX_PARALLEL="${MAX_PARALLEL:-32}"
    PING_TIMEOUT="${PING_TIMEOUT:-1}"

    case "$SCAN_MODE" in
        auto|targets) ;;
        *) fail "SCAN_MODE must be 'auto' or 'targets'" ;;
    esac

    case "$MAX_PARALLEL" in
        ''|*[!0-9]*) fail "MAX_PARALLEL must be a positive integer" ;;
    esac
    [ "$MAX_PARALLEL" -ge 1 ] || fail "MAX_PARALLEL must be at least 1"
}

trim() {
    printf '%s' "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

json_escape() {
    printf '%s' "$1" | tr '\r\n' '  ' | sed 's/\\/\\\\/g; s/"/\\"/g'
}

is_ipv4() {
    printf '%s\n' "$1" | awk -F. '
        NF != 4 { exit 1 }
        {
            for (i = 1; i <= 4; i++) {
                if ($i !~ /^[0-9]+$/ || $i < 0 || $i > 255) exit 1
            }
        }
    '
}

detect_default_iface() {
    ip -4 route show default 2>/dev/null | awk '{
        for (i = 1; i <= NF; i++) {
            if ($i == "dev") {
                print $(i + 1)
                exit
            }
        }
    }'
}

detect_scan_cidr() {
    if [ -n "$SCAN_CIDR" ]; then
        printf '%s\n' "$SCAN_CIDR"
        return 0
    fi

    DETECTED_IFACE="$(detect_default_iface)"
    [ -n "$DETECTED_IFACE" ] || fail "Could not detect default IPv4 interface. Set SCAN_CIDR in $CONFIG_FILE."

    ip -4 route show dev "$DETECTED_IFACE" scope link 2>/dev/null | awk '$1 ~ /^[0-9]+\./ { print $1; exit }'
}

detect_own_ip() {
    if [ -z "$DETECTED_IFACE" ]; then
        DETECTED_IFACE="$(detect_default_iface)"
    fi
    [ -n "$DETECTED_IFACE" ] || return 0

    ip -4 addr show dev "$DETECTED_IFACE" 2>/dev/null | awk '/inet / {
        split($2, parts, "/")
        print parts[1]
        exit
    }'
}

cidr_base_24() {
    cidr="$1"
    network="${cidr%/*}"
    prefix="${cidr#*/}"

    [ "$prefix" = "24" ] || fail "Automatic scan supports /24 IPv4 networks only. Set SCAN_CIDR to a /24 or use SCAN_MODE=targets."
    is_ipv4 "$network" || fail "Invalid SCAN_CIDR network: $cidr"

    printf '%s\n' "$network" | awk -F. '{ print $1 "." $2 "." $3 }'
}

lookup_mac() {
    [ -r /proc/net/arp ] || return 0
    awk -v ip_addr="$1" '$1 == ip_addr && $4 != "00:00:00:00:00:00" { print $4; exit }' /proc/net/arp
}

lookup_hostname() {
    ip_addr="$1"
    if command -v getent >/dev/null 2>&1; then
        getent hosts "$ip_addr" 2>/dev/null | awk '{ print $2; exit }' | sed 's/\.$//'
        return 0
    fi
    if command -v nslookup >/dev/null 2>&1; then
        nslookup "$ip_addr" 2>/dev/null | awk -F'= ' '/name =/ { gsub(/\.$/, "", $2); print $2; exit }'
        return 0
    fi
    return 0
}

json_device_entry() {
    ip_addr="$1"
    status="$2"
    latency_ms="$3"
    detail="$4"
    mac_addr="$(lookup_mac "$ip_addr")"
    hostname="$(lookup_hostname "$ip_addr")"

    entry="{\"ipAddress\":\"$(json_escape "$ip_addr")\",\"status\":\"$status\""
    if [ -n "$mac_addr" ]; then
        entry="$entry,\"macAddress\":\"$(json_escape "$mac_addr")\""
    fi
    if [ -n "$hostname" ]; then
        entry="$entry,\"hostname\":\"$(json_escape "$hostname")\""
    fi
    if [ -n "$latency_ms" ]; then
        entry="$entry,\"latencyMs\":$latency_ms"
    fi
    if [ -n "$detail" ]; then
        entry="$entry,\"detail\":\"$(json_escape "$detail")\""
    fi
    printf '%s}\n' "$entry"
}

probe_target_json() {
    ip_addr="$1"
    include_offline="$2"
    ping_out="$TMP_DIR/ping-$ip_addr.out"
    ping_err="$TMP_DIR/ping-$ip_addr.err"

    if ping -c 1 -W "$PING_TIMEOUT" "$ip_addr" >"$ping_out" 2>"$ping_err"; then
        latency="$(sed -n 's/.*time[=<]\([0-9.]*\).*/\1/p' "$ping_out" | tail -n 1)"
        json_device_entry "$ip_addr" "online" "$latency" "ping ok"
        return 0
    fi

    [ "$include_offline" = "1" ] || return 0
    detail="$(tail -n 1 "$ping_err" 2>/dev/null || true)"
    [ -n "$detail" ] || detail="ping failed"
    json_device_entry "$ip_addr" "offline" "" "$detail"
}

write_auto_candidates() {
    candidates_file="$1"
    cidr="$(detect_scan_cidr)"
    [ -n "$cidr" ] || fail "Could not detect LAN CIDR. Set SCAN_CIDR in $CONFIG_FILE."
    base="$(cidr_base_24 "$cidr")"
    own_ip="$(detect_own_ip)"

    i=1
    while [ "$i" -le 254 ]; do
        ip_addr="$base.$i"
        if [ "$ip_addr" != "$own_ip" ]; then
            printf '%s\n' "$ip_addr" >>"$candidates_file"
        fi
        i=$((i + 1))
    done
}

write_target_candidates() {
    candidates_file="$1"
    [ -f "$TARGETS_FILE" ] || fail "Targets file not found: $TARGETS_FILE"

    while IFS= read -r raw_line || [ -n "$raw_line" ]; do
        line="$(trim "$raw_line")"
        case "$line" in
            ""|\#*) continue ;;
        esac

        ip_addr="${line%%,*}"
        ip_addr="$(trim "$ip_addr")"
        is_ipv4 "$ip_addr" || fail "Invalid target IP in $TARGETS_FILE: $ip_addr"
        printf '%s\n' "$ip_addr" >>"$candidates_file"
    done < "$TARGETS_FILE"
}

scan_candidates() {
    candidates_file="$1"
    include_offline="$2"
    running=0

    while IFS= read -r ip_addr || [ -n "$ip_addr" ]; do
        [ -n "$ip_addr" ] || continue
        (
            probe_target_json "$ip_addr" "$include_offline" >"$TMP_DIR/$ip_addr.json"
        ) &
        running=$((running + 1))
        if [ "$running" -ge "$MAX_PARALLEL" ]; then
            wait
            running=0
        fi
    done < "$candidates_file"
    wait

    payload_devices=""
    first=1
    while IFS= read -r ip_addr || [ -n "$ip_addr" ]; do
        entry_file="$TMP_DIR/$ip_addr.json"
        [ -s "$entry_file" ] || continue
        entry="$(cat "$entry_file")"
        [ -n "$entry" ] || continue

        if [ "$first" -eq 1 ]; then
            payload_devices="$entry"
            first=0
        else
            payload_devices="$payload_devices,$entry"
        fi
    done < "$candidates_file"

    printf '%s' "$payload_devices"
}

build_payload() {
    TMP_DIR="/tmp/managed-lan-scan.$$"
    mkdir -p "$TMP_DIR"

    observed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    candidates_file="$TMP_DIR/candidates.txt"
    : > "$candidates_file"

    if [ "$SCAN_MODE" = "targets" ]; then
        write_target_candidates "$candidates_file"
        scan_mode="targets"
        include_offline="1"
    else
        write_auto_candidates "$candidates_file"
        scan_mode="full"
        include_offline="0"
    fi

    payload_devices="$(scan_candidates "$candidates_file" "$include_offline")"

    printf '{"vrmSiteId":"%s","observedAt":"%s","scanMode":"%s","devices":[%s]}\n' \
        "$(json_escape "$VRM_SITE_ID")" \
        "$observed_at" \
        "$scan_mode" \
        "$payload_devices"
}

post_payload() {
    body="$1"
    endpoint="${SITE_URL%/}${API_PATH}"

    if command -v curl >/dev/null 2>&1; then
        curl -fsS \
            -H "Authorization: Bearer $CERBO_INGEST_TOKEN" \
            -H "Content-Type: application/json" \
            -X POST \
            --data "$body" \
            "$endpoint" >"$TMP_DIR/managed-post.out"
        cat "$TMP_DIR/managed-post.out"
        return 0
    fi

    if command -v wget >/dev/null 2>&1; then
        wget -qO- \
            --header="Authorization: Bearer $CERBO_INGEST_TOKEN" \
            --header="Content-Type: application/json" \
            --post-data="$body" \
            "$endpoint"
        return 0
    fi

    fail "Neither curl nor wget is available for HTTP POST"
}

require_cmd date
require_cmd ping
require_cmd sed
require_cmd awk
require_cmd tail
require_cmd tr
require_cmd ip
load_config

payload="$(build_payload)"
log "Posting Cerbo LAN scan for site $VRM_SITE_ID with SCAN_MODE=$SCAN_MODE"
post_payload "$payload"
