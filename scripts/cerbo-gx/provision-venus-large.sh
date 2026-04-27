#!/bin/sh
set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 022

PAYLOAD_DIR="${PAYLOAD_DIR:-/data}"
NODE_RED_MODE="${NODE_RED_MODE:-1}"
BACKUP_ROOT="${BACKUP_ROOT:-/data/provision-backups}"

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

user_home() {
    user_name="$1"
    home_dir="$(awk -F: -v user_name="$user_name" '$1 == user_name { print $6; exit }' /etc/passwd)"
    [ -n "$home_dir" ] || fail "User '$user_name' was not found in /etc/passwd"
    printf '%s\n' "$home_dir"
}

dbus_get() {
    dbus -y "$1" "$2" GetValue
}

dbus_set() {
    dbus -y "$1" "$2" SetValue "$3"
}

ensure_file() {
    [ -f "$1" ] || fail "Required file not found: $1"
}

ensure_dir_owned() {
    dir_path="$1"
    owner_name="$2"
    group_name="$3"

    mkdir -p "$dir_path"
    chown "$owner_name:$group_name" "$dir_path"
}

backup_if_present() {
    source_path="$1"
    backup_dir="$2"

    if [ -f "$source_path" ]; then
        mkdir -p "$backup_dir"
        cp -p "$source_path" "$backup_dir/$(basename "$source_path")"
    fi
}

install_owned_file() {
    source_path="$1"
    target_path="$2"
    owner_name="$3"
    group_name="$4"

    mkdir -p "$(dirname "$target_path")"
    cp "$source_path" "$target_path"
    chown "$owner_name:$group_name" "$target_path"
    chmod 0644 "$target_path"
}

wait_for_state() {
    service_dir="$1"
    desired_state="$2"
    timeout_seconds="${3:-60}"
    elapsed=0

    while [ "$elapsed" -lt "$timeout_seconds" ]; do
        state_line="$(svstat "$service_dir" 2>/dev/null || true)"
        case "$desired_state" in
            up)
                printf '%s\n' "$state_line" | grep -q ": up " && return 0
                ;;
            down)
                printf '%s\n' "$state_line" | grep -q ": down " && return 0
                ;;
            *)
                fail "Unsupported desired state: $desired_state"
                ;;
        esac

        sleep 1
        elapsed=$((elapsed + 1))
    done

    fail "Timed out waiting for $service_dir to become $desired_state"
}

restart_service() {
    service_dir="$1"

    svc -d "$service_dir"
    wait_for_state "$service_dir" down 90
    svc -u "$service_dir"
    wait_for_state "$service_dir" up 180
}

optional_install() {
    source_path="$1"
    target_path="$2"
    owner_name="$3"
    group_name="$4"

    if [ -f "$source_path" ]; then
        install_owned_file "$source_path" "$target_path" "$owner_name" "$group_name"
    fi
}

case "$NODE_RED_MODE" in
    0|1|2) ;;
    *) fail "NODE_RED_MODE must be 0 (disabled), 1 (enabled), or 2 (safe mode)" ;;
esac

require_cmd awk
require_cmd cp
require_cmd dbus
require_cmd grep
require_cmd mkdir
require_cmd svc
require_cmd svstat
require_cmd chown
require_cmd chmod
require_cmd date

FLOWS_SRC="$PAYLOAD_DIR/master_flows.json"
SK_SETTINGS_SRC="$PAYLOAD_DIR/master_sk_settings.json"
FLOWS_CRED_SRC="$PAYLOAD_DIR/master_flows_cred.json"
NODE_RED_SETTINGS_USER_SRC="$PAYLOAD_DIR/master_nodered_settings_user.js"
NODE_RED_RUNTIME_SRC="$PAYLOAD_DIR/master_nodered_config_runtime.json"

ensure_file "$FLOWS_SRC"
ensure_file "$SK_SETTINGS_SRC"

[ -d /service/node-red-venus ] || fail "Missing /service/node-red-venus. This device does not appear to have Venus OS Large installed."
[ -d /service/signalk-server ] || fail "Missing /service/signalk-server. This device does not appear to have Venus OS Large installed."

dbus_get com.victronenergy.settings /Settings/Services/NodeRed >/dev/null 2>&1 || fail "Node-RED setting path is not available on this Venus OS build."
dbus_get com.victronenergy.settings /Settings/Services/SignalK >/dev/null 2>&1 || fail "Signal K setting path is not available on this Venus OS build."
dbus_get com.victronenergy.platform /Services/NodeRed/Mode >/dev/null 2>&1 || fail "Node-RED platform path is not available on this Venus OS build."
dbus_get com.victronenergy.platform /Services/SignalK/Enabled >/dev/null 2>&1 || fail "Signal K platform path is not available on this Venus OS build."

NODE_RED_HOME="$(user_home nodered)"
SIGNALK_HOME="$(user_home signalk)"

NODE_RED_DIR="$NODE_RED_HOME/.node-red"
SIGNALK_DIR="$SIGNALK_HOME/.signalk"

NODE_RED_FLOWS_TARGET="$NODE_RED_DIR/flows.json"
NODE_RED_FLOWS_CRED_TARGET="$NODE_RED_DIR/flows_cred.json"
NODE_RED_SETTINGS_USER_TARGET="$NODE_RED_DIR/settings-user.js"
NODE_RED_RUNTIME_TARGET="$NODE_RED_DIR/.config.runtime.json"
SIGNALK_SETTINGS_TARGET="$SIGNALK_DIR/settings.json"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

log "Starting Cerbo GX Venus OS Large provisioning"
log "Payload directory: $PAYLOAD_DIR"
log "Backup directory: $BACKUP_DIR"
log "Requested Node-RED mode: $NODE_RED_MODE"

ensure_dir_owned "$NODE_RED_HOME" nodered nodered
ensure_dir_owned "$NODE_RED_DIR" nodered nodered
ensure_dir_owned "$SIGNALK_HOME" signalk signalk
ensure_dir_owned "$SIGNALK_DIR" signalk signalk

backup_if_present "$NODE_RED_FLOWS_TARGET" "$BACKUP_DIR/node-red"
backup_if_present "$NODE_RED_FLOWS_CRED_TARGET" "$BACKUP_DIR/node-red"
backup_if_present "$NODE_RED_SETTINGS_USER_TARGET" "$BACKUP_DIR/node-red"
backup_if_present "$NODE_RED_RUNTIME_TARGET" "$BACKUP_DIR/node-red"
backup_if_present "$SIGNALK_SETTINGS_TARGET" "$BACKUP_DIR/signalk"

log "Installing Node-RED and Signal K configuration payloads"
install_owned_file "$FLOWS_SRC" "$NODE_RED_FLOWS_TARGET" nodered nodered
install_owned_file "$SK_SETTINGS_SRC" "$SIGNALK_SETTINGS_TARGET" signalk signalk
optional_install "$FLOWS_CRED_SRC" "$NODE_RED_FLOWS_CRED_TARGET" nodered nodered
optional_install "$NODE_RED_SETTINGS_USER_SRC" "$NODE_RED_SETTINGS_USER_TARGET" nodered nodered
optional_install "$NODE_RED_RUNTIME_SRC" "$NODE_RED_RUNTIME_TARGET" nodered nodered

log "Enabling services through current Venus OS settings paths"
dbus_set com.victronenergy.settings /Settings/Services/NodeRed "$NODE_RED_MODE"
dbus_set com.victronenergy.settings /Settings/Services/SignalK 1

log "Restarting services so the new payload is loaded"
restart_service /service/node-red-venus
restart_service /service/signalk-server

NODE_RED_MODE_EFFECTIVE="$(dbus_get com.victronenergy.platform /Services/NodeRed/Mode)"
SIGNALK_ENABLED_EFFECTIVE="$(dbus_get com.victronenergy.platform /Services/SignalK/Enabled)"

[ "$NODE_RED_MODE_EFFECTIVE" = "$NODE_RED_MODE" ] || fail "Node-RED mode verification failed. Expected $NODE_RED_MODE, got $NODE_RED_MODE_EFFECTIVE"
[ "$SIGNALK_ENABLED_EFFECTIVE" = "1" ] || fail "Signal K enable verification failed. Expected 1, got $SIGNALK_ENABLED_EFFECTIVE"

log "Provisioning completed successfully"
log "Node-RED mode: $NODE_RED_MODE_EFFECTIVE"
log "Signal K enabled: $SIGNALK_ENABLED_EFFECTIVE"
log "Service status:"
svstat /service/node-red-venus
svstat /service/signalk-server
