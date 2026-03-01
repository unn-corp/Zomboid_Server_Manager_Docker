--
-- ZM_SafeZone.lua — PvP Safe Zone enforcement with violation tracking.
-- Uses file-based IPC: reads zone config from Laravel, writes violations for DB import.
--

local JSON = require("ZM_JSON")

ZM_SafeZone = {}

local CONFIG_FILE = "safezone_config.json"
local VIOLATIONS_FILE = "safezone_violations.json"

-- In-memory state
local config = { enabled = false, zones = {} }
local strikes = {} -- { attackerUsername = count }
local pendingViolations = {} -- queued for flush to disk

--- Read a JSON file and return parsed data or nil
local function readJsonFile(path)
    local reader = getFileReader(path, false)
    if not reader then
        return nil
    end

    local lines = {}
    local line = reader:readLine()
    while line ~= nil do
        table.insert(lines, line)
        line = reader:readLine()
    end
    reader:close()

    local content = table.concat(lines, "")
    if content == "" then
        return nil
    end

    local ok, data = pcall(JSON.decode, content)
    if not ok then
        print("[ZomboidManager] ERROR parsing " .. path .. ": " .. tostring(data))
        return nil
    end

    return data
end

--- Write data to a JSON file
local function writeJsonFile(path, data)
    local ok, jsonStr = pcall(JSON.encode, data)
    if not ok then
        print("[ZomboidManager] ERROR encoding " .. path .. ": " .. tostring(jsonStr))
        return false
    end

    local writer = getFileWriter(path, true, false)
    if not writer then
        print("[ZomboidManager] ERROR: cannot write " .. path)
        return false
    end

    writer:write(jsonStr)
    writer:close()
    return true
end

--- Load zone config from safezone_config.json
local function loadConfig()
    local data = readJsonFile(CONFIG_FILE)
    if data then
        if data.enabled ~= nil then
            config.enabled = data.enabled
        end
        if data.zones ~= nil then
            config.zones = data.zones
        end
    end
end

--- Check if coordinates are inside a safe zone, returns zone or nil
local function getZoneAt(x, y)
    for _, zone in ipairs(config.zones) do
        if x >= zone.x1 and x <= zone.x2 and y >= zone.y1 and y <= zone.y2 then
            return zone
        end
    end
    return nil
end

--- Flush pending violations to disk (appends to existing file)
local function flushViolations()
    if #pendingViolations == 0 then
        return
    end

    -- Read existing violations from file
    local existing = readJsonFile(VIOLATIONS_FILE)
    local list = {}
    if existing and existing.violations then
        list = existing.violations
    end

    -- Append new violations
    for _, v in ipairs(pendingViolations) do
        table.insert(list, v)
    end

    writeJsonFile(VIOLATIONS_FILE, { violations = list })
    print("[ZomboidManager] SafeZone: flushed " .. #pendingViolations .. " violation(s) to disk")
    pendingViolations = {}
end

--- Called when a weapon hits a character
function ZM_SafeZone.onWeaponHitCharacter(attacker, target, weapon, damage)
    -- Guard: system must be enabled
    if not config.enabled then
        return
    end

    -- Guard: both must be IsoPlayer instances
    local ok1, isPlayerA = pcall(function() return instanceof(attacker, "IsoPlayer") end)
    local ok2, isPlayerT = pcall(function() return instanceof(target, "IsoPlayer") end)
    if not ok1 or not isPlayerA or not ok2 or not isPlayerT then
        return
    end

    -- Check if victim is in a safe zone
    local targetX = target:getX()
    local targetY = target:getY()
    local zone = getZoneAt(targetX, targetY)

    if not zone then
        return
    end

    -- Restore victim health (undo the damage)
    local ok, err = pcall(function()
        local newHealth = math.min(1.0, target:getHealth() + damage)
        target:setHealth(newHealth)
    end)
    if not ok then
        print("[ZomboidManager] SafeZone: ERROR restoring health: " .. tostring(err))
    end

    -- Track strikes for attacker
    local attackerName = attacker:getUsername()
    if not attackerName then
        return
    end

    if not strikes[attackerName] then
        strikes[attackerName] = 0
    end
    strikes[attackerName] = strikes[attackerName] + 1
    local strikeCount = strikes[attackerName]

    local targetName = target:getUsername() or "unknown"
    local zoneName = zone.name or zone.id or "unknown"

    if strikeCount <= 1 then
        -- Strike 1: warning only
        local warnOk, warnErr = pcall(function()
            attacker:Say("[Safe Zone] PvP is not allowed here. Warning 1/2")
        end)
        if not warnOk then
            print("[ZomboidManager] SafeZone: ERROR sending warning: " .. tostring(warnErr))
        end
        print("[ZomboidManager] SafeZone: warned " .. attackerName .. " (strike 1) in zone " .. zoneName)
    else
        -- Strike 2+: warn + queue violation
        local warnOk, warnErr = pcall(function()
            attacker:Say("[Safe Zone] Violation reported to admins.")
        end)
        if not warnOk then
            print("[ZomboidManager] SafeZone: ERROR sending warning: " .. tostring(warnErr))
        end

        table.insert(pendingViolations, {
            attacker = attackerName,
            victim = targetName,
            zone_id = zone.id or "",
            zone_name = zoneName,
            attacker_x = math.floor(attacker:getX()),
            attacker_y = math.floor(attacker:getY()),
            strike_number = strikeCount,
            occurred_at = os.time(),
        })
        print("[ZomboidManager] SafeZone: violation queued for " .. attackerName .. " (strike " .. strikeCount .. ") in zone " .. zoneName)
    end
end

--- Called every minute: reload config, flush pending violations
function ZM_SafeZone.tick()
    loadConfig()

    if config.enabled then
        flushViolations()
    end
end

--- Called on server start: load config
function ZM_SafeZone.init()
    loadConfig()
    print("[ZomboidManager] SafeZone: initialized (enabled=" .. tostring(config.enabled) .. ", zones=" .. #config.zones .. ")")
end

return ZM_SafeZone
