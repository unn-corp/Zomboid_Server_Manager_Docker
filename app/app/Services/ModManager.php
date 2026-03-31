<?php

namespace App\Services;

class ModManager
{
    private string $workshopBasePath;

    public function __construct(
        private readonly ServerIniParser $iniParser,
        ?string $workshopBasePath = null,
    ) {
        $this->workshopBasePath = $workshopBasePath ?? '';
    }

    private function getWorkshopBasePath(): string
    {
        if ($this->workshopBasePath === '') {
            $this->workshopBasePath = config('zomboid.game_server_path', '/pz-server').'/steamapps/workshop/content/108600';
        }

        return $this->workshopBasePath;
    }

    /**
     * Get the current mod list parsed from server.ini.
     *
     * @return array<int, array{workshop_id: string, mod_id: string, position: int}>
     */
    public function list(string $iniPath): array
    {
        $config = $this->iniParser->read($iniPath);

        $workshopIds = $this->splitList($config['WorkshopItems'] ?? '');
        $modIds = $this->splitList($config['Mods'] ?? '');

        $mods = [];
        $count = max(count($workshopIds), count($modIds));

        for ($i = 0; $i < $count; $i++) {
            $mods[] = [
                'workshop_id' => $workshopIds[$i] ?? '',
                'mod_id' => $modIds[$i] ?? '',
                'position' => $i,
            ];
        }

        return $mods;
    }

    /**
     * Add a mod to both WorkshopItems and Mods lines.
     *
     * If no $mapFolder is given, auto-detects map folders from the Workshop
     * download directory by scanning for media/maps/ subdirectories.
     */
    public function add(string $iniPath, string $workshopId, string $modId, ?string $mapFolder = null): void
    {
        $config = $this->iniParser->read($iniPath);

        $workshopIds = $this->splitList($config['WorkshopItems'] ?? '');
        $modIds = $this->splitList($config['Mods'] ?? '');

        // Don't add exact duplicates (same workshop_id + same mod_id)
        // Allow same workshop_id with a different mod_id (mod packs with multiple sub-mods)
        foreach (array_map(null, $workshopIds, $modIds) as [$wid, $mid]) {
            if ($wid === $workshopId && $mid === $modId) {
                return;
            }
        }

        $workshopIds[] = $workshopId;
        $modIds[] = $modId;

        $updates = [
            'WorkshopItems' => implode(';', $workshopIds),
            'Mods' => implode(';', $modIds),
        ];

        // Auto-detect map folders if none provided
        $mapFolders = $mapFolder !== null
            ? [$mapFolder]
            : $this->detectMapFolders($workshopId);

        if ($mapFolders !== []) {
            $maps = $this->splitList($config['Map'] ?? 'Muldraugh, KY', ';');
            $muldraugh = 'Muldraugh, KY';
            $maps = array_filter($maps, fn ($m) => $m !== $muldraugh);

            foreach ($mapFolders as $folder) {
                if (! in_array($folder, $maps, true)) {
                    $maps[] = $folder;
                }
            }

            // PZ requires "Muldraugh, KY" to be last in the Map= line
            $maps[] = $muldraugh;
            $updates['Map'] = implode(';', $maps);
        }

        $this->iniParser->write($iniPath, $updates);
    }

    /**
     * Detect map folders from a Workshop mod's downloaded content.
     *
     * PZ map mods contain media/maps/{FolderName}/ directories. This scans
     * the Workshop cache for those directories to auto-detect map folders.
     *
     * @return string[]
     */
    public function detectMapFolders(string $workshopId): array
    {
        $folders = [];

        // Check multiple possible structures in Workshop content
        try {
            $base = $this->getWorkshopBasePath();
        } catch (\Throwable) {
            return [];
        }

        if (! is_dir($base)) {
            return [];
        }
        $searchPaths = [
            // Root level: {WORKSHOP_ID}/media/maps/*/
            $base.'/'.$workshopId.'/media/maps',
            // Inside mods subdir: {WORKSHOP_ID}/mods/*/media/maps/*/
            $base.'/'.$workshopId.'/mods/*/media/maps',
            // B42 subdir: {WORKSHOP_ID}/42/media/maps/*/
            $base.'/'.$workshopId.'/42/media/maps',
        ];

        foreach ($searchPaths as $searchPath) {
            $matches = glob($searchPath.'/*', GLOB_ONLYDIR);
            if ($matches === false) {
                continue;
            }

            foreach ($matches as $dir) {
                $folderName = basename($dir);
                if ($folderName !== '.' && $folderName !== '..' && ! in_array($folderName, $folders, true)) {
                    $folders[] = $folderName;
                }
            }
        }

        return $folders;
    }

    /**
     * Remove a mod by workshop ID from both lines.
     *
     * If no $mapFolder is given, auto-detects map folders from the Workshop
     * download directory and removes them from the Map= line.
     *
     * @return array{workshop_id: string, mod_id: string}|null The removed mod, or null if not found.
     */
    public function remove(string $iniPath, string $workshopId, ?string $mapFolder = null): ?array
    {
        $config = $this->iniParser->read($iniPath);

        $workshopIds = $this->splitList($config['WorkshopItems'] ?? '');
        $modIds = $this->splitList($config['Mods'] ?? '');

        $index = array_search($workshopId, $workshopIds, true);

        if ($index === false) {
            return null;
        }

        $removed = [
            'workshop_id' => $workshopIds[$index],
            'mod_id' => $modIds[$index] ?? '',
        ];

        array_splice($workshopIds, $index, 1);
        array_splice($modIds, $index, 1);

        $updates = [
            'WorkshopItems' => implode(';', $workshopIds),
            'Mods' => implode(';', $modIds),
        ];

        // Auto-detect map folders if none provided
        $mapFolders = $mapFolder !== null
            ? [$mapFolder]
            : $this->detectMapFolders($workshopId);

        if ($mapFolders !== []) {
            $maps = $this->splitList($config['Map'] ?? '', ';');
            $maps = array_filter($maps, fn ($m) => ! in_array($m, $mapFolders, true));
            $updates['Map'] = implode(';', array_values($maps));
        }

        $this->iniParser->write($iniPath, $updates);

        return $removed;
    }

    /**
     * Replace the entire mod list, wiping WorkshopItems=, Mods=, and Map= (reset to default).
     *
     * @param  array<int, array{workshop_id: string, mod_id: string}>  $mods
     */
    public function replaceAll(string $iniPath, array $mods): void
    {
        $workshopIds = array_column($mods, 'workshop_id');
        $modIds = array_column($mods, 'mod_id');

        $this->iniParser->write($iniPath, [
            'WorkshopItems' => implode(';', $workshopIds),
            'Mods' => implode(';', $modIds),
            'Map' => 'Muldraugh, KY',
        ]);
    }

    /**
     * Check whether WorkshopItems= and Mods= have the same number of entries.
     * Misalignment means the lists were corrupted (manual edit or semicolons in mod_id).
     */
    public function isAligned(string $iniPath): bool
    {
        $config = $this->iniParser->read($iniPath);

        $workshopIds = $this->splitList($config['WorkshopItems'] ?? '');
        $modIds = $this->splitList($config['Mods'] ?? '');

        return count($workshopIds) === count($modIds);
    }

    /**
     * Reorder mods by replacing both lines with the given ordered list.
     *
     * @param  array<int, array{workshop_id: string, mod_id: string}>  $orderedMods
     */
    public function reorder(string $iniPath, array $orderedMods): void
    {
        $workshopIds = array_column($orderedMods, 'workshop_id');
        $modIds = array_column($orderedMods, 'mod_id');

        $this->iniParser->write($iniPath, [
            'WorkshopItems' => implode(';', $workshopIds),
            'Mods' => implode(';', $modIds),
        ]);
    }

    /**
     * @return string[]
     */
    private function splitList(string $value, string $separator = ';'): array
    {
        if ($value === '') {
            return [];
        }

        return array_values(array_filter(
            array_map('trim', explode($separator, $value)),
            fn ($v) => $v !== '',
        ));
    }
}
