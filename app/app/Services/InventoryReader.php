<?php

namespace App\Services;

class InventoryReader
{
    private string $inventoryDir;

    public function __construct(?string $inventoryDir = null)
    {
        $this->inventoryDir = $inventoryDir ?? config('zomboid.lua_bridge.inventory_dir');
    }

    /**
     * Get a player's inventory from their JSON snapshot.
     *
     * @return array{username: string, timestamp: string, items: array<int, array{full_type: string, name: string, category: string, count: int, condition: float, equipped: bool, container: string}>, weight: float, max_weight: float}|null
     */
    public function getPlayerInventory(string $username): ?array
    {
        $filePath = $this->inventoryDir.'/'.$username.'.json';

        if (! file_exists($filePath)) {
            return null;
        }

        $content = file_get_contents($filePath);
        if ($content === false) {
            return null;
        }

        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return null;
        }

        return $data;
    }

    /**
     * List all players that have inventory snapshots.
     *
     * @return array<int, string>
     */
    public function listPlayers(): array
    {
        if (! is_dir($this->inventoryDir)) {
            return [];
        }

        $files = glob($this->inventoryDir.'/*.json');
        if ($files === false) {
            return [];
        }

        return array_map(
            fn (string $file) => pathinfo($file, PATHINFO_FILENAME),
            $files
        );
    }

    /**
     * Get all player inventories.
     *
     * @return array<string, array{username: string, timestamp: string, items: array, weight: float, max_weight: float}>
     */
    public function getAllInventories(): array
    {
        $inventories = [];

        foreach ($this->listPlayers() as $username) {
            $inventory = $this->getPlayerInventory($username);
            if ($inventory !== null) {
                $inventories[$username] = $inventory;
            }
        }

        return $inventories;
    }
}
