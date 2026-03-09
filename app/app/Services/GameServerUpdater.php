<?php

namespace App\Services;

class GameServerUpdater
{
    private const AVAILABLE_BRANCHES = ['public', 'unstable', 'iwillbackupmysave'];

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
     * Write branch override file for the game server entrypoint.
     */
    public function setBranch(string $branch): void
    {
        $overridePath = config('zomboid.paths.data').'/.steam_branch';
        file_put_contents($overridePath, $branch);
    }

    /**
     * Write force update flag for the game server entrypoint.
     */
    public function triggerForceUpdate(): void
    {
        $flagPath = config('zomboid.paths.data').'/.force_update';
        file_put_contents($flagPath, (string) time());
    }

    /**
     * Get the list of known PZ Steam branches.
     *
     * @return string[]
     */
    public function getAvailableBranches(): array
    {
        return self::AVAILABLE_BRANCHES;
    }
}
