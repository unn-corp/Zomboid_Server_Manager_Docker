--
-- ZM_InventoryExporter.lua — Exports per-player inventory snapshots to JSON
-- Writes to: Lua/inventory/<username>.json
--

local JSON = require("ZM_JSON")

ZM_InventoryExporter = {}

local LUA_DIR = "Lua"
local INVENTORY_DIR = LUA_DIR .. "/inventory"

--- Get ISO 8601 timestamp using PZ's calendar
local function getTimestamp()
    if getGameTime then
        local gt = getGameTime()
        return string.format("%04d-%02d-%02dT%02d:%02d:%02d",
            gt:getYear(), gt:getMonth() + 1, gt:getDay(),
            gt:getHour(), gt:getMinutes(), 0)
    end
    -- Fallback if getGameTime not available
    local cal = Calendar.getInstance()
    return string.format("%04d-%02d-%02dT%02d:%02d:%02d",
        cal:get(Calendar.YEAR), cal:get(Calendar.MONTH) + 1, cal:get(Calendar.DAY_OF_MONTH),
        cal:get(Calendar.HOUR_OF_DAY), cal:get(Calendar.MINUTE), cal:get(Calendar.SECOND))
end

--- Serialize a single inventory item
local function serializeItem(item, containerName)
    local data = {
        full_type = item:getFullType(),
        name = item:getName(),
        category = tostring(item:getDisplayCategory() or "General"),
        count = 1,
        condition = 1.0,
        equipped = false,
        container = containerName or "inventory",
    }

    -- Condition (for drainables like water bottles, or weapons/clothing)
    if item.getCondition and item.getMaxCondition then
        local maxCond = item:getMaxCondition()
        if maxCond > 0 then
            data.condition = math.floor((item:getCondition() / maxCond) * 100) / 100
        end
    end

    -- Check if item is equipped (primary or secondary hand)
    if instanceof(item, "HandWeapon") or instanceof(item, "Clothing") then
        local player = item:getContainer() and item:getContainer():getParent()
        if player and instanceof(player, "IsoPlayer") then
            local primary = player:getPrimaryHandItem()
            local secondary = player:getSecondaryHandItem()
            if (primary and primary == item) or (secondary and secondary == item) then
                data.equipped = true
            end
        end
    end

    return data
end

--- Export a single player's inventory to JSON
function ZM_InventoryExporter.exportPlayer(player)
    if not player or not instanceof(player, "IsoPlayer") then
        return false
    end

    local username = player:getUsername()
    if not username or username == "" then
        return false
    end

    local inventory = player:getInventory()
    if not inventory then
        return false
    end

    local items = {}
    local totalWeight = 0

    -- Main inventory
    local allItems = inventory:getItems()
    if allItems then
        for i = 0, allItems:size() - 1 do
            local item = allItems:get(i)
            if item then
                table.insert(items, serializeItem(item, "inventory"))
                totalWeight = totalWeight + (item:getWeight() or 0)
            end
        end
    end

    -- Equipped bags / secondary containers
    local backpack = player:getClothingItem_Back()
    if backpack and backpack:getItemContainer() then
        local bagItems = backpack:getItemContainer():getItems()
        if bagItems then
            local bagName = backpack:getName() or "backpack"
            for i = 0, bagItems:size() - 1 do
                local item = bagItems:get(i)
                if item then
                    table.insert(items, serializeItem(item, bagName))
                    totalWeight = totalWeight + (item:getWeight() or 0)
                end
            end
        end
    end

    local data = {
        username = username,
        timestamp = getTimestamp(),
        items = items,
        weight = math.floor(totalWeight * 100) / 100,
        max_weight = player:getMaxWeight() or 15.0,
    }

    local ok, jsonStr = pcall(JSON.encode, data)
    if not ok then
        print("[ZomboidManager] ERROR encoding inventory for " .. username .. ": " .. tostring(jsonStr))
        return false
    end

    local writer = getFileWriter(INVENTORY_DIR .. "/" .. username .. ".json", true, false)
    if not writer then
        print("[ZomboidManager] ERROR: cannot open file writer for " .. username)
        return false
    end

    writer:write(jsonStr)
    writer:close()

    return true
end

--- Export all online players' inventories
function ZM_InventoryExporter.exportAll()
    local players = getOnlinePlayers()
    if not players then
        return 0
    end

    local count = 0
    for i = 0, players:size() - 1 do
        local player = players:get(i)
        if player and ZM_InventoryExporter.exportPlayer(player) then
            count = count + 1
        end
    end

    return count
end

return ZM_InventoryExporter
