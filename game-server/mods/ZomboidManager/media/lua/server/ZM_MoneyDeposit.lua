--
-- ZM_MoneyDeposit.lua — Reads deposit_requests.json, removes Base.Money/MoneyStack
-- from player inventories, writes deposit_results.json
--

require("ZM_Utils")
require("ZM_InventoryExporter")

ZM_MoneyDeposit = {}

local REQUESTS_FILE = "deposit_requests.json"
local RESULTS_FILE = "deposit_results.json"
local MAX_RESULTS = 200

--- Read existing results file
local function readResults()
    local data = ZM_Utils.readJsonFile(RESULTS_FILE)
    if data then
        return data
    end
    return {version = 1, updated_at = "", results = {}}
end

--- Write results to file, trimming oldest entries if over cap
local function writeResults(results)
    results.updated_at = ZM_Utils.getTimestamp()

    while results.results and #results.results > MAX_RESULTS do
        table.remove(results.results, 1)
    end

    ZM_Utils.writeJsonFile(RESULTS_FILE, results)
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

--- Count money items in a container (without removing)
local function countMoneyInContainer(container)
    local money = 0
    local stacks = 0
    if not container then
        return money, stacks
    end
    local allItems = container:getItems()
    if not allItems then
        return money, stacks
    end
    for i = 0, allItems:size() - 1 do
        local item = allItems:get(i)
        if item then
            local fullType = item:getFullType()
            if fullType == "Base.Money" then
                money = money + 1
            elseif fullType == "Base.MoneyStack" then
                stacks = stacks + 1
            end
        end
    end
    return money, stacks
end

--- Count total money items across all player containers
local function countAllMoney(player)
    local totalMoney = 0
    local totalStacks = 0

    local inventory = player:getInventory()
    local m, s = countMoneyInContainer(inventory)
    totalMoney = totalMoney + m
    totalStacks = totalStacks + s

    local backpack = player:getClothingItem_Back()
    if backpack and backpack:getItemContainer() then
        m, s = countMoneyInContainer(backpack:getItemContainer())
        totalMoney = totalMoney + m
        totalStacks = totalStacks + s
    end

    return totalMoney, totalStacks
end

--- Remove all items of a given type from a container using getFirstType loop.
--- Returns number actually removed.
local function removeAllOfType(container, fullType)
    if not container then
        return 0
    end
    local removed = 0
    -- Use getFirstType in a loop — each call finds the next instance
    -- This avoids index-shifting issues entirely
    while true do
        local item = container:getFirstType(fullType)
        if not item then
            break
        end
        -- DoRemoveItem is the reliable server-side removal method
        if container.DoRemoveItem then
            container:DoRemoveItem(item)
        else
            container:Remove(item)
        end
        removed = removed + 1
        -- Safety: prevent infinite loop if removal isn't working
        if removed > 10000 then
            print("[ZomboidManager] WARNING: hit safety limit removing " .. fullType)
            break
        end
    end
    return removed
end

--- Remove all Money and MoneyStack items from a player.
--- Returns money_removed, stacks_removed
local function removeMoney(player)
    local moneyRemoved = 0
    local stacksRemoved = 0

    local inventory = player:getInventory()
    moneyRemoved = moneyRemoved + removeAllOfType(inventory, "Base.Money")
    stacksRemoved = stacksRemoved + removeAllOfType(inventory, "Base.MoneyStack")

    local backpack = player:getClothingItem_Back()
    if backpack and backpack:getItemContainer() then
        local bagContainer = backpack:getItemContainer()
        moneyRemoved = moneyRemoved + removeAllOfType(bagContainer, "Base.Money")
        stacksRemoved = stacksRemoved + removeAllOfType(bagContainer, "Base.MoneyStack")
    end

    return moneyRemoved, stacksRemoved
end

--- Process all pending deposit requests
function ZM_MoneyDeposit.process()
    local requests = ZM_Utils.readJsonFile(REQUESTS_FILE)
    if not requests or not requests.requests then
        return 0
    end

    -- Early exit: check if any entries are pending
    local hasPending = false
    for _, req in ipairs(requests.requests) do
        if req.status == "pending" then
            hasPending = true
            break
        end
    end
    if not hasPending then
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

    for _, req in ipairs(requests.requests) do
        if req.status == "pending" and not processedIds[req.id] then
            local result = {
                id = req.id,
                username = req.username,
                status = "failed",
                money_count = 0,
                stack_count = 0,
                total_coins = 0,
                message = nil,
                processed_at = ZM_Utils.getTimestamp(),
            }

            local player = findPlayer(req.username)
            if not player then
                result.message = "player not online"
            else
                -- Step 1: Count money BEFORE removal
                local moneyBefore, stacksBefore = countAllMoney(player)

                if moneyBefore == 0 and stacksBefore == 0 then
                    result.message = "no money items found"
                else
                    -- Step 2: Remove all money items
                    local moneyRemoved, stacksRemoved = removeMoney(player)

                    -- Step 3: Verify removal — count money AFTER removal
                    local moneyAfter, stacksAfter = countAllMoney(player)

                    if moneyAfter > 0 or stacksAfter > 0 then
                        -- Some items were NOT removed — report failure
                        -- Do NOT credit coins since items are still in inventory
                        result.message = "removal failed: " .. moneyAfter .. " Money and " .. stacksAfter .. " MoneyStack still in inventory"
                        print("[ZomboidManager] WARNING: Money deposit removal incomplete for " .. req.username .. " — " .. moneyAfter .. " Money + " .. stacksAfter .. " MoneyStack remaining")
                    else
                        -- All items successfully removed — report success
                        local moneyValue = 1
                        local stackValue = 10
                        local totalCoins = (moneyRemoved * moneyValue) + (stacksRemoved * stackValue)

                        result.status = "success"
                        result.money_count = moneyRemoved
                        result.stack_count = stacksRemoved
                        result.total_coins = totalCoins

                        print("[ZomboidManager] Money deposit: " .. req.username .. " deposited " .. moneyRemoved .. " Money + " .. stacksRemoved .. " MoneyStack = " .. totalCoins .. " coins")
                    end

                    -- Re-export inventory so the web reflects the change immediately
                    ZM_InventoryExporter.exportPlayer(player)
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

--- Initialize the money deposit system
function ZM_MoneyDeposit.init()
    print("[ZomboidManager] Money deposit system initialized")
end

return ZM_MoneyDeposit
