<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class GameVersionReader
{
    private const CACHE_KEY = 'pz.game_version';

    private const CACHE_TTL = 86400;

    public function __construct(
        private readonly GameStateReader $gameStateReader,
        private readonly DockerManager $docker,
    ) {}

    /**
     * Detect the current game version from Lua bridge or Docker logs.
     */
    public function detectVersion(): ?string
    {
        // Primary: read from game_state.json (Lua bridge, updated every minute)
        $state = $this->gameStateReader->getGameState();
        if (! empty($state['game_version'])) {
            return $state['game_version'];
        }

        // Fallback: parse Docker container logs for version string
        return $this->detectVersionFromLogs();
    }

    /**
     * Get cached game version without hitting filesystem/Docker.
     */
    public function getCachedVersion(): ?string
    {
        return Cache::get(self::CACHE_KEY);
    }

    /**
     * Detect version and cache it for 24 hours.
     */
    public function refreshVersion(): ?string
    {
        $version = $this->detectVersion();

        if ($version !== null) {
            Cache::put(self::CACHE_KEY, $version, self::CACHE_TTL);
        }

        return $version;
    }

    /**
     * Get the current Steam branch from override file or config fallback.
     */
    public function getCurrentBranch(): string
    {
        $overridePath = config('zomboid.paths.data').'/.steam_branch';

        if (file_exists($overridePath)) {
            $branch = trim((string) file_get_contents($overridePath));
            if ($branch !== '') {
                return $branch;
            }
        }

        return config('zomboid.steam_branch', 'public');
    }

    /**
     * Parse Docker container logs for PZ version pattern.
     */
    private function detectVersionFromLogs(): ?string
    {
        try {
            $lines = $this->docker->getContainerLogs(200);
        } catch (\Throwable $e) {
            Log::debug('GameVersionReader: failed to read Docker logs', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }

        // PZ logs version as "versionNumber=42.0.3" or similar patterns
        foreach (array_reverse($lines) as $line) {
            if (preg_match('/versionNumber\s*=\s*([0-9]+\.[0-9]+(?:\.[0-9]+)*)/', $line, $matches)) {
                return $matches[1];
            }
        }

        return null;
    }
}
