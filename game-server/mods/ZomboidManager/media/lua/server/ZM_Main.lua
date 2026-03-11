--
-- ZM_Main.lua — Entry point for ZomboidManager server-side mod
-- Registers PZ event hooks for inventory export, delivery queue, and position tracking.
--

require("ZM_Utils")
require("ZM_InventoryExporter")
require("ZM_DeliveryQueue")
require("ZM_PlayerTracker")
require("ZM_ItemCatalog")
require("ZM_GameState")
require("ZM_PlayerStats")
require("ZM_RespawnDelay")
require("ZM_SafeZone")

print("[ZomboidManager] Initializing server-side bridge mod...")

-- Tick counters for reduced-frequency operations.
-- NOTE: PZ EveryOneMinute fires every ~2.5 real seconds (one in-game minute),
-- NOT every 60 real seconds. Intervals below are in game-minute ticks.
local inventoryTickCounter = 0
local INVENTORY_EXPORT_INTERVAL = 120 -- ~5 real minutes (120 × 2.5s)

local positionTickCounter = 0
local POSITION_EXPORT_INTERVAL = 12 -- ~30 real seconds

local gameStateTickCounter = 0
local GAME_STATE_EXPORT_INTERVAL = 24 -- ~1 real minute

local deliveryTickCounter = 0
local DELIVERY_PROCESS_INTERVAL = 6 -- ~15 real seconds

--- OnCreatePlayer — triggered when a player connects/spawns
--- NOTE: On PZ dedicated servers, this event may not fire reliably.
--- Death detection and respawn blocking are handled via EveryOneMinute tick instead.
local function onCreatePlayer(playerIndex, player)
    if not player then
        return
    end
    print("[ZomboidManager] Player connected: " .. (player:getUsername() or "unknown"))

    -- Export this player's inventory
    ZM_InventoryExporter.exportPlayer(player)

    -- Process any pending deliveries for this player
    ZM_DeliveryQueue.process()
end

--- EveryTenMinutes — heavy periodic exports (stats)
local function onEveryTenMinutes()
    -- Export player stats (kills, hours, skills)
    local statsCount = ZM_PlayerStats.exportAll()
    if statsCount > 0 then
        print("[ZomboidManager] Exported stats for " .. statsCount .. " players")
    end
end

--- EveryOneMinute — inventory export, delivery queue, live positions, game state
--- NOTE: This fires every ~2.5 real seconds (one in-game minute), not every 60s.
local function onEveryOneMinute()
    -- Export inventories (heavy: serializes all players + writes JSON per player)
    inventoryTickCounter = inventoryTickCounter + 1
    if inventoryTickCounter >= INVENTORY_EXPORT_INTERVAL then
        inventoryTickCounter = 0
        local invCount = ZM_InventoryExporter.exportAll()
        if invCount > 0 then
            print("[ZomboidManager] Exported " .. invCount .. " player inventories")
        end
    end

    -- Process delivery queue
    deliveryTickCounter = deliveryTickCounter + 1
    if deliveryTickCounter >= DELIVERY_PROCESS_INTERVAL then
        deliveryTickCounter = 0
        local processed = ZM_DeliveryQueue.process()
        if processed > 0 then
            print("[ZomboidManager] Processed " .. processed .. " delivery entries")
        end
    end

    -- Export player positions for map updates
    positionTickCounter = positionTickCounter + 1
    if positionTickCounter >= POSITION_EXPORT_INTERVAL then
        positionTickCounter = 0
        ZM_PlayerTracker.exportPositions()
    end

    -- Export game state (time, weather, season)
    gameStateTickCounter = gameStateTickCounter + 1
    if gameStateTickCounter >= GAME_STATE_EXPORT_INTERVAL then
        gameStateTickCounter = 0
        ZM_GameState.export()
    end

    -- Respawn delay: reload config, process resets, clean expired
    ZM_RespawnDelay.tick()

    -- Safe zone: reload config, flush violations
    ZM_SafeZone.tick()
end

--- OnServerStarted — export game state and item catalog on server boot
local function onServerStarted()
    -- Initialize respawn delay system
    ZM_RespawnDelay.init()

    -- Initialize safe zone system
    ZM_SafeZone.init()

    -- Export game state immediately so it's available even when server is paused
    if ZM_GameState.export() then
        print("[ZomboidManager] Exported initial game state")
    end

    local ok, count = pcall(ZM_ItemCatalog.export)
    if ok and count and count > 0 then
        print("[ZomboidManager] Exported item catalog: " .. count .. " items")
    else
        print("[ZomboidManager] WARNING: item catalog export failed or returned 0 items")
    end
end

-- Register event hooks
Events.OnCreatePlayer.Add(onCreatePlayer)
Events.OnWeaponHitCharacter.Add(ZM_SafeZone.onWeaponHitCharacter)
Events.EveryTenMinutes.Add(onEveryTenMinutes)
Events.EveryOneMinute.Add(onEveryOneMinute)
Events.OnServerStarted.Add(onServerStarted)

print("[ZomboidManager] Event hooks registered: OnCreatePlayer, OnWeaponHitCharacter, EveryTenMinutes, EveryOneMinute, OnServerStarted")
