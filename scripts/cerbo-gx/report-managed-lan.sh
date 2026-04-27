#!/bin/sh
set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 022

CONFIG_FILE="${CONFIG_FILE:-/data/conf/managed-network-monitor.conf}"
TARGETS_FILE="${TARGETS_FILE:-/data/conf/managed-network-targets.txt}"
API_PATH="${API_PATH:-/api/cerbo/network-scan}"

log() {
    printf '%s\n' "$*"
}

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

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
}

trim() {
    printf '%s' "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//'
}

json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

ping_target() {
    ip="$1"
    if ping -c 1 -W 1 "$ip" >/tmp/managed-ping.out 2>/tmp/managed-ping.err; then
        latency="$(sed -n 's/.*time=\([0-9.]*\).*/\1/p' /tmp/managed-ping.out | tail -n 1)"
        if [ -n "$latency" ]; then
            printf 'online|%s|ping ok\n' "$latency"
        else
            printf 'online||ping ok\n'
        fi
    else
        detail="$(tail -n 1 /tmp/managed-ping.err 2>/dev/null || true)"
        [ -n "$detail" ] || detail="ping failed"
        printf 'offline||%s\n' "$(json_escape "$detail")"
    fi
}

build_payload() {
    [ -f "$TARGETS_FILE" ] || fail "Targets file not found: $TARGETS_FILE"

    observed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    payload_devices=""
    first=1

    while IFS= read -r raw_line || [ -n "$raw_line" ]; do
        line="$(trim "$raw_line")"
        case "$line" in
            ""|\#*) continue ;;
        esac

        ip="${line%%,*}"
        ip="$(trim "$ip")"
        [ -n "$ip" ] || continue

        result="$(ping_target "$ip")"
        status="$(printf '%s' "$result" | cut -d'|' -f1)"
        latency_ms="$(printf '%s' "$result" | cut -d'|' -f2)"
        detail="$(printf '%s' "$result" | cut -d'|' -f3-)"

        entry="{\"ipAddress\":\"$(json_escape "$ip")\",\"status\":\"$status\""
        if [ -n "$latency_ms" ]; then
            entry="$entry,\"latencyMs\":$latency_ms"
        fi
        if [ -n "$detail" ]; then
            entry="$entry,\"detail\":\"$(json_escape "$detail")\""
        fi
        entry="$entry}"

        if [ "$first" -eq 1 ]; then
            payload_devices="$entry"
            first=0
        else
            payload_devices="$payload_devices,$entry"
        fi
    done < "$TARGETS_FILE"

    printf '{"vrmSiteId":"%s","observedAt":"%s","devices":[%s]}\n' \
        "$(json_escape "$VRM_SITE_ID")" \
        "$observed_at" \
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
            "$endpoint" >/tmp/managed-post.out
        cat /tmp/managed-post.out
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
require_cmd tail
load_config

payload="$(build_payload)"
log "Posting managed LAN status for site $VRM_SITE_ID"
post_payload "$payload"
