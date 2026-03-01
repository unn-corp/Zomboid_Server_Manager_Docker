--
-- ZM_DeliveryQueue.lua — Reads delivery_queue.json, processes give/remove actions,
-- writes results to delivery_results.json
--

local JSON = require("ZM_JSON")

ZM_DeliveryQueue = {}

local QUEUE_FILE = "delivery_queue.json"
local RESULTS_FILE = "delivery_results.json"

--- Read the delivery queue file
local function readQueue()
    local reader = getFileReader(QUEUE_FILE, false)
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
        print("[ZomboidManager] ERROR parsing delivery queue: " .. tostring(data))
        return nil
    end

    return data
end

--- Read existing results file
local function readResults()
    local reader = getFileReader(RESULTS_FILE, false)
    if not reader then
        return {version = 1, updated_at = "", results = {}}
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
        return {version = 1, updated_at = "", results = {}}
    end

    local ok, data = pcall(JSON.decode, content)
    if not ok then
        return {version = 1, updated_at = "", results = {}}
    end

    return data
end

--- Get ISO 8601 timestamp
local function getTimestamp()
    if getGameTime then
        local gt = getGameTime()
        return string.format("%04d-%02d-%02dT%02d:%02d:%02d",
            gt:getYear(), gt:getMonth() + 1, gt:getDay(),
            gt:getHour(), gt:getMinutes(), 0)
    end
    local cal = Calendar.getInstance()
    return string.format("%04d-%02d-%02dT%02d:%02d:%02d",
        cal:get(Calendar.YEAR), cal:get(Calendar.MONTH) + 1, cal:get(Calendar.DAY_OF_MONTH),
        cal:get(Calendar.HOUR_OF_DAY), cal:get(Calendar.MINUTE), cal:get(Calendar.SECOND))
end

--- Write results to file
local function writeResults(results)
    results.updated_at = getTimestamp()

    local ok, jsonStr = pcall(JSON.encode, results)
    if not ok then
        print("[ZomboidManager] ERROR encoding delivery results: " .. tostring(jsonStr))
        return false
    end

    local writer = getFileWriter(RESULTS_FILE, true, false)
    if not writer then
        print("[ZomboidManager] ERROR: cannot write delivery results")
        return false
    end

    writer:write(jsonStr)
    writer:close()
    return true
end

--- Find online player by username
local function findPlayer(username)
    local players = getOnlinePlayers()
    if not players then
        return nil
    end
    for i = 0, players:size() - 1 do
        local p = players:get(i)
        if p and p:getUsername() == username then
            return p
        end
    end
    return nil
end

--- Give item to player
local function giveItem(player, itemType, count)
    local inventory = player:getInventory()
    if not inventory then
        return false, "player has no inventory"
    end

    for i = 1, count do
        local item = inventory:AddItem(itemType)
        if not item then
            return false, "failed to add item " .. itemType .. " (attempt " .. i .. "/" .. count .. ")"
        end
    end

    return true, nil
end

--- Remove item from player
local function removeItem(player, itemType, count)
    local inventory = player:getInventory()
    if not inventory then
        return false, "player has no inventory"
    end

    local removed = 0
    for i = 1, count do
        local item = inventory:getFirstTypeRecurse(itemType)
        if item then
            local container = item:getContainer()
            if container then
                container:removeItemOnServer(item)
                removed = removed + 1
            else
                inventory:Remove(item)
                removed = removed + 1
            end
        end
    end

    if removed < count then
        return false, "only removed " .. removed .. "/" .. count .. " items"
    end
    return true, nil
end

--- Process all pending entries in the delivery queue
function ZM_DeliveryQueue.process()
    local queue = readQueue()
    if not queue or not queue.entries then
        return 0
    end

    local results = readResults()
    local processed = 0

    -- Build set of already-processed IDs
    local processedIds = {}
    if results.results then
        for _, r in ipairs(results.results) do
            processedIds[r.id] = true
        end
    end

    for _, entry in ipairs(queue.entries) do
        if entry.status == "pending" and not processedIds[entry.id] then
            local player = findPlayer(entry.username)
            local result = {
                id = entry.id,
                status = "failed",
                processed_at = getTimestamp(),
                message = nil,
            }

            if not player then
                result.message = "player '" .. entry.username .. "' not online"
            else
                local success, errMsg
                if entry.action == "give" then
                    success, errMsg = giveItem(player, entry.item_type, entry.count or 1)
                elseif entry.action == "remove" then
                    success, errMsg = removeItem(player, entry.item_type, entry.count or 1)
                else
                    errMsg = "unknown action: " .. tostring(entry.action)
                end

                if success then
                    result.status = "delivered"
                    print("[ZomboidManager] Delivered: " .. entry.action .. " " .. (entry.count or 1) .. "x " .. entry.item_type .. " for " .. entry.username)
                else
                    result.message = errMsg
                    print("[ZomboidManager] Failed delivery: " .. tostring(errMsg))
                end
            end

            table.insert(results.results, result)
            processed = processed + 1
        end
    end

    if processed > 0 then
        writeResults(results)
    end

    return processed
end

return ZM_DeliveryQueue
