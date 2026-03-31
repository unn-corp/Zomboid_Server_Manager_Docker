<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SteamWorkshopService
{
    private const PUBLISHED_FILE_DETAILS_URL = 'https://api.steampowered.com/ISteamRemoteStorage/GetPublishedFileDetails/v1/';
    private const COLLECTION_DETAILS_URL = 'https://api.steampowered.com/ISteamRemoteStorage/GetCollectionDetails/v1/';

    /**
     * Parse a Steam Workshop URL or bare numeric ID.
     *
     * @return array{type: 'item'|'collection', id: string}|null
     */
    public function parseWorkshopUrl(string $input): ?array
    {
        $input = trim($input);

        // Bare numeric ID
        if (preg_match('/^\d+$/', $input)) {
            return ['type' => 'item', 'id' => $input];
        }

        // steamcommunity.com/sharedfiles/filedetails/?id=XXXX
        // steamcommunity.com/workshop/filedetails/?id=XXXX
        if (preg_match('/steamcommunity\.com\/(?:sharedfiles|workshop)\/filedetails\/\?.*id=(\d+)/i', $input, $matches)) {
            return ['type' => 'item', 'id' => $matches[1]];
        }

        return null;
    }

    /**
     * Fetch details for one or more workshop item IDs from the Steam API.
     *
     * @param  string[]  $workshopIds
     * @return array<int, array{workshop_id: string, title: string, detected_mod_id: string|null, file_type: int}>
     */
    public function fetchItems(array $workshopIds): array
    {
        if (empty($workshopIds)) {
            return [];
        }

        $params = ['itemcount' => count($workshopIds)];
        foreach ($workshopIds as $i => $id) {
            $params["publishedfileids[{$i}]"] = $id;
        }

        try {
            $response = Http::timeout(15)->asForm()->post(self::PUBLISHED_FILE_DETAILS_URL, $params);

            if (! $response->successful()) {
                Log::warning('Steam workshop item fetch failed', ['status' => $response->status()]);

                return [];
            }

            $files = $response->json('response.publishedfiledetails', []);
        } catch (\Throwable $e) {
            Log::warning('Steam workshop item fetch exception', ['error' => $e->getMessage()]);

            return [];
        }

        $results = [];
        foreach ($files as $file) {
            $workshopId = (string) ($file['publishedfileid'] ?? '');
            if ($workshopId === '') {
                continue;
            }

            $results[] = [
                'workshop_id' => $workshopId,
                'title' => $file['title'] ?? $workshopId,
                'detected_mod_id' => $this->detectModId($file),
                'file_type' => (int) ($file['file_type'] ?? 0),
            ];
        }

        return $results;
    }

    /**
     * Resolve a collection ID to its member workshop items and fetch their details.
     *
     * @return array{items: array<int, array{workshop_id: string, title: string, detected_mod_id: string|null, file_type: int}>, is_collection: bool}
     */
    public function fetchCollection(string $collectionId): array
    {
        try {
            $response = Http::timeout(15)->asForm()->post(self::COLLECTION_DETAILS_URL, [
                'collectioncount' => 1,
                'publishedfileids[0]' => $collectionId,
            ]);

            if (! $response->successful()) {
                return ['items' => [], 'is_collection' => false];
            }

            $collections = $response->json('response.collectiondetails', []);
        } catch (\Throwable $e) {
            Log::warning('Steam collection fetch exception', ['error' => $e->getMessage()]);

            return ['items' => [], 'is_collection' => false];
        }

        if (empty($collections)) {
            return ['items' => [], 'is_collection' => false];
        }

        $children = $collections[0]['children'] ?? [];
        if (empty($children)) {
            // Not a collection or empty — treat as a single item
            $items = $this->fetchItems([$collectionId]);

            return ['items' => $items, 'is_collection' => false];
        }

        $memberIds = array_column($children, 'publishedfileid');
        $items = $this->fetchItems($memberIds);

        return ['items' => $items, 'is_collection' => true];
    }

    /**
     * Fetch enriched details for workshop items, including dependency IDs and all mod IDs.
     *
     * @param  string[]  $workshopIds
     * @return array<int, array{workshop_id: string, dependency_ids: string[], all_mod_ids: string[]}>
     */
    public function fetchEnrichedItems(array $workshopIds): array
    {
        if (empty($workshopIds)) {
            return [];
        }

        $params = ['itemcount' => count($workshopIds)];
        foreach ($workshopIds as $i => $id) {
            $params["publishedfileids[{$i}]"] = $id;
        }

        try {
            $response = Http::timeout(15)->asForm()->post(self::PUBLISHED_FILE_DETAILS_URL, $params);

            if (! $response->successful()) {
                Log::warning('Steam workshop enriched fetch failed', ['status' => $response->status()]);

                return [];
            }

            $files = $response->json('response.publishedfiledetails', []);
        } catch (\Throwable $e) {
            Log::warning('Steam workshop enriched fetch exception', ['error' => $e->getMessage()]);

            return [];
        }

        $results = [];
        foreach ($files as $file) {
            $workshopId = (string) ($file['publishedfileid'] ?? '');
            if ($workshopId === '') {
                continue;
            }

            // filetype=0 children are required mod dependencies
            $dependencyIds = [];
            foreach ($file['children'] ?? [] as $child) {
                if ((int) ($child['filetype'] ?? -1) === 0) {
                    $dependencyIds[] = (string) $child['publishedfileid'];
                }
            }

            $results[] = [
                'workshop_id' => $workshopId,
                'dependency_ids' => $dependencyIds,
                'all_mod_ids' => $this->parseAllModIds($file),
            ];
        }

        return $results;
    }

    /**
     * Parse all PZ mod IDs from a workshop item's description/tags.
     *
     * Handles "Mod IDs: A | B" and "Mod ID: A" patterns, splitting on | ; or ,
     *
     * @return string[]
     */
    public function parseAllModIds(array $itemData): array
    {
        $description = strip_tags($itemData['description'] ?? '');

        // Match "Mod IDs?: ..." pattern — capture multi-value lists
        if (preg_match('/mod\s*ids?\s*[:\-]\s*([A-Za-z0-9_;|&()\s\-,]+)/i', $description, $matches)) {
            $raw = $matches[1];
            $ids = preg_split('/[|;,]/', $raw);
            $ids = array_map('trim', $ids ?? []);
            $ids = array_filter($ids, fn (string $v) => $v !== '' && preg_match('/^[\w\-()&]+$/', $v));
            $ids = array_values($ids);

            if (count($ids) > 0) {
                return $ids;
            }
        }

        // Fallback: single mod ID from detectModId
        $single = $this->detectModId($itemData);

        return $single !== null ? [$single] : [];
    }

    /**
     * Try to detect the PZ mod ID from a workshop item's tags or description.
     *
     * PZ mods sometimes include the mod folder name as a tag value or in the
     * description as "Mod ID: <name>". Returns null if nothing is detected.
     */
    public function detectModId(array $itemData): ?string
    {
        // Try tags first — look for a tag whose value looks like a PZ mod ID
        $tags = $itemData['tags'] ?? [];
        foreach ($tags as $tag) {
            $value = $tag['tag'] ?? '';
            // PZ mod IDs are typically alphanumeric + underscores/hyphens, no spaces
            if (preg_match('/^[\w\-()]+$/', $value) && ! in_array(strtolower($value), ['mod', 'build41', 'build42', 'multiplayer', 'map', 'translation', 'framework', 'library'], true)) {
                return $value;
            }
        }

        // Try description — look for "Mod ID: <name>" pattern
        $description = strip_tags($itemData['description'] ?? '');
        if (preg_match('/mod\s*id\s*[:\-]\s*([\w\-()]+)/i', $description, $matches)) {
            return $matches[1];
        }

        return null;
    }
}
