#!/bin/bash
# Wrapper entrypoint for the AMD64 game server image (renegademaster).
# Patches run_server.sh to run configure-server.sh AFTER SteamCMD validate
# but BEFORE start_server.
#
# ZomboidManager is loaded as a proper PZ mod (added to Mods= line by
# configure-server.sh). This ensures both server and client Lua files are
# distributed to connecting players. DoLuaChecksum=false prevents checksum
# errors. Source files are mounted at /home/steam/Zomboid/mods/ZomboidManager/.

CONFIGURE_SCRIPT="/home/steam/configure-server.sh"

# Clean up previously injected ZM files and empty mod directory from base game.
# ZomboidManager is loaded from Zomboid/mods/, not the base game directory.
# An empty ZomboidManager dir in the base game mods shadows the real mod.
for dir in /home/steam/ZomboidDedicatedServer/media/lua/server /home/steam/ZomboidDedicatedServer/media/lua/client; do
    if ls "$dir"/ZM_*.lua 1>/dev/null 2>&1; then
        rm -f "$dir"/ZM_*.lua
        echo "[entrypoint] Cleaned up old injected ZM files from $dir"
    fi
done
# Note: ZomboidManager Workshop cache at steamapps/workshop/content/108600/3685323705
# is populated by configure-server.sh — do NOT delete it here.

if [ -f "$CONFIGURE_SCRIPT" ]; then
    # Remove ALL previous insertions first (clean slate on every boot)
    sed -i "\|bash $CONFIGURE_SCRIPT|d" /home/steam/run_server.sh

    # Insert exactly once before start_server
    sed -i '/^\s*start_server\b/i bash '"$CONFIGURE_SCRIPT" /home/steam/run_server.sh

    if grep -q "bash $CONFIGURE_SCRIPT" /home/steam/run_server.sh; then
        echo "[entrypoint] Patched run_server.sh (1 insertion)"
    else
        echo "[entrypoint] WARNING: Could not patch run_server.sh — running configure-server.sh directly"
        bash "$CONFIGURE_SCRIPT"
    fi
fi

# Branch override from shared volume (written by web UI)
OVERRIDE_FILE="/home/steam/Zomboid/.steam_branch"
if [ -f "$OVERRIDE_FILE" ]; then
    GAME_VERSION=$(cat "$OVERRIDE_FILE")
    export GAME_VERSION
    echo "[entrypoint] Branch override: $GAME_VERSION"
fi

# SteamCMD public branch fix: "-beta public" is invalid — SteamCMD needs
# the -beta flag removed entirely to download the default (public) branch.
# The base image's apply_preinstall_config always does:
#   sed -i "s/beta .* /beta $GAME_VERSION /g" install_server.scmd
# which produces "-beta public" when GAME_VERSION=public. We override
# apply_preinstall_config with our own version that handles public correctly.
if [ "${GAME_VERSION:-}" = "public" ]; then
    # Replace apply_preinstall_config to strip -beta entirely for public branch
    sed -i '/# public-branch-fixup/d' /home/steam/run_server.sh
    sed -i 's/^apply_preinstall_config$/apply_preinstall_config; sed -i "s| -beta [^ ]* | |g" \/home\/steam\/install_server.scmd # public-branch-fixup/' /home/steam/run_server.sh
    echo "[entrypoint] Patched run_server.sh to strip -beta for public branch"
else
    # Remove fixup if switching back to a beta branch
    sed -i '/# public-branch-fixup/d' /home/steam/run_server.sh
fi

# Force update flag from shared volume (written by web UI)
FORCE_FILE="/home/steam/Zomboid/.force_update"
if [ -f "$FORCE_FILE" ]; then
    echo "[entrypoint] Force update flag detected"
    rm -f "$FORCE_FILE"
    # Remove server binary to force SteamCMD re-download
    rm -f /home/steam/ZomboidDedicatedServer/ProjectZomboid64
fi

# Prevent renegademaster image from overwriting Mods=/WorkshopItems= with empty values.
# When these env vars are set to "" the image clears mods added via the web UI.
if [ -z "${MOD_NAMES:-}" ]; then
    unset MOD_NAMES
fi
if [ -z "${MOD_WORKSHOP_IDS:-}" ]; then
    unset MOD_WORKSHOP_IDS
fi

# Snapshot current mod lines BEFORE the base image can wipe them.
# configure-server.sh will restore these if the base image clears them.
SERVER_NAME_VAL="${SERVER_NAME:-${SERVERNAME:-ZomboidServer}}"
INI="/home/steam/Zomboid/Server/${SERVER_NAME_VAL}.ini"
MOD_SNAPSHOT="/tmp/.mod_snapshot"
if [ -f "$INI" ]; then
    grep "^Mods=" "$INI" > "$MOD_SNAPSHOT" 2>/dev/null || true
    grep "^WorkshopItems=" "$INI" >> "$MOD_SNAPSHOT" 2>/dev/null || true
    echo "[entrypoint] Saved mod snapshot from INI ($(wc -l < "$MOD_SNAPSHOT") lines)"
fi

exec /home/steam/run_server.sh
