#!/bin/sh
set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
umask 022

EXPORT_DIR="${1:-/data/cerbo-golden-$(date +%Y%m%d-%H%M%S)}"

log() {
    printf '%s\n' "$*"
}

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

user_home() {
    user_name="$1"
    home_dir="$(awk -F: -v user_name="$user_name" '$1 == user_name { print $6; exit }' /etc/passwd)"
    [ -n "$home_dir" ] || fail "User '$user_name' was not found in /etc/passwd"
    printf '%s\n' "$home_dir"
}

copy_if_present() {
    source_path="$1"
    target_path="$2"

    if [ -f "$source_path" ]; then
        mkdir -p "$(dirname "$target_path")"
        cp -p "$source_path" "$target_path"
        log "Copied: $source_path"
    fi
}

NODE_RED_HOME="$(user_home nodered)"
SIGNALK_HOME="$(user_home signalk)"

NODE_RED_DIR="$NODE_RED_HOME/.node-red"
SIGNALK_DIR="$SIGNALK_HOME/.signalk"

log "Exporting golden Cerbo GX payload to $EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

copy_if_present "$NODE_RED_DIR/flows.json" "$EXPORT_DIR/master_flows.json"
copy_if_present "$NODE_RED_DIR/flows_cred.json" "$EXPORT_DIR/master_flows_cred.json"
copy_if_present "$NODE_RED_DIR/settings-user.js" "$EXPORT_DIR/master_nodered_settings_user.js"
copy_if_present "$NODE_RED_DIR/.config.runtime.json" "$EXPORT_DIR/master_nodered_config_runtime.json"
copy_if_present "$SIGNALK_DIR/settings.json" "$EXPORT_DIR/master_sk_settings.json"

[ -f "$EXPORT_DIR/master_flows.json" ] || fail "Node-RED flows.json was not found"
[ -f "$EXPORT_DIR/master_sk_settings.json" ] || fail "Signal K settings.json was not found"

log "Export complete"
log "Required:"
log "  $EXPORT_DIR/master_flows.json"
log "  $EXPORT_DIR/master_sk_settings.json"
if [ -f "$EXPORT_DIR/master_flows_cred.json" ]; then
    log "Optional but important for credentialed flows:"
    log "  $EXPORT_DIR/master_flows_cred.json"
fi
if [ -f "$EXPORT_DIR/master_nodered_settings_user.js" ]; then
    log "Optional Node-RED settings override:"
    log "  $EXPORT_DIR/master_nodered_settings_user.js"
fi
if [ -f "$EXPORT_DIR/master_nodered_config_runtime.json" ]; then
    log "Optional runtime encryption state:"
    log "  $EXPORT_DIR/master_nodered_config_runtime.json"
fi
