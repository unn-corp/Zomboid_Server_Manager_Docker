#!/bin/bash
# Wrapper entrypoint for the AMD64 game server image (renegademaster).
# Patches run_server.sh to inject ZomboidManager files and run configure-server.sh
# AFTER SteamCMD validate but BEFORE start_server.
#
# ZomboidManager is a server-only bridge mod. Its Lua files are injected directly
# into the base game's media/lua/server/ directory (not loaded as a PZ mod) to
# avoid client checksum errors. The source files are mounted read-only at
# /home/steam/Zomboid/mods/ZomboidManager/.

CONFIGURE_SCRIPT="/home/steam/configure-server.sh"
ZM_SOURCE="/home/steam/Zomboid/mods/ZomboidManager/media/lua/server"
ZM_TARGET="/home/steam/ZomboidDedicatedServer/media/lua/server"

# Create a small injection script that runs after SteamCMD but before start_server
cat > /home/steam/inject-zm.sh << 'EOSCRIPT'
#!/bin/bash
ZM_SOURCE="/home/steam/Zomboid/mods/ZomboidManager/media/lua/server"
ZM_TARGET="/home/steam/ZomboidDedicatedServer/media/lua/server"
if [ -d "$ZM_SOURCE" ] && [ -d "$ZM_TARGET" ]; then
    cp "$ZM_SOURCE"/ZM_*.lua "$ZM_TARGET/"
    echo "[inject-zm] Injected ZomboidManager Lua files into base game server dir"
else
    echo "[inject-zm] WARNING: source ($ZM_SOURCE) or target ($ZM_TARGET) not found"
fi
EOSCRIPT
chmod +x /home/steam/inject-zm.sh

# Patch run_server.sh to run injection + configure AFTER SteamCMD but BEFORE start_server
# Order: SteamCMD validate -> inject ZM files -> configure-server.sh -> start_server
sed -i '/^start_server$/i bash /home/steam/inject-zm.sh' /home/steam/run_server.sh
echo "[entrypoint] Patched run_server.sh to inject ZM files before start"

if [ -f "$CONFIGURE_SCRIPT" ]; then
    sed -i '/^start_server$/i bash '"$CONFIGURE_SCRIPT" /home/steam/run_server.sh
    echo "[entrypoint] Patched run_server.sh to run configure-server.sh before start"
fi

# Prevent renegademaster image from overwriting Mods=/WorkshopItems= with empty values.
# When these env vars are set to "" the image clears mods added via the web UI.
if [ -z "${MOD_NAMES:-}" ]; then
    unset MOD_NAMES
fi
if [ -z "${MOD_WORKSHOP_IDS:-}" ]; then
    unset MOD_WORKSHOP_IDS
fi

exec /home/steam/run_server.sh
