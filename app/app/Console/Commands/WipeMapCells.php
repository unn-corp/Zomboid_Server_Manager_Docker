<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class WipeMapCells extends Command
{
    protected $signature = 'zomboid:wipe-cells
        {--cell=* : Cell coordinates as X,Y (e.g., --cell=37,23)}
        {--radius=1 : Radius around each cell to also delete}
        {--dry-run : Show what would be deleted without deleting}';

    protected $description = 'Delete specific map cells from the save to force PZ to regenerate them';

    public function handle(): int
    {
        $cells = $this->option('cell');
        $radius = (int) $this->option('radius');
        $dryRun = (bool) $this->option('dry-run');

        if (empty($cells)) {
            $this->error('Provide at least one --cell=X,Y coordinate.');

            return self::FAILURE;
        }

        $serverName = config('zomboid.server_name', 'ZomboidServer');
        $savePath = config('zomboid.paths.data').'/Saves/Multiplayer/'.$serverName;

        if (! is_dir($savePath)) {
            $this->error("Save directory not found: {$savePath}");

            return self::FAILURE;
        }

        // Build list of cell coordinates to delete
        $targetCells = [];
        foreach ($cells as $cell) {
            $parts = explode(',', $cell);
            if (count($parts) !== 2) {
                $this->warn("Skipping invalid cell format: {$cell} (expected X,Y)");

                continue;
            }

            $cx = (int) trim($parts[0]);
            $cy = (int) trim($parts[1]);

            for ($x = $cx - $radius; $x <= $cx + $radius; $x++) {
                for ($y = $cy - $radius; $y <= $cy + $radius; $y++) {
                    $targetCells["{$x}_{$y}"] = true;
                }
            }
        }

        if (empty($targetCells)) {
            $this->error('No valid cells to delete.');

            return self::FAILURE;
        }

        $this->info('Target cells: '.implode(', ', array_keys($targetCells)));

        // Find matching files
        $deleted = 0;
        $patterns = ['map_%s.bin', 'zpop_%s.bin', 'chunkdata_%s.bin'];

        foreach ($targetCells as $cellKey => $v) {
            foreach ($patterns as $pattern) {
                $file = $savePath.'/'.sprintf($pattern, $cellKey);
                if (file_exists($file)) {
                    if ($dryRun) {
                        $this->line("[dry-run] Would delete: {$file}");
                    } else {
                        unlink($file);
                        $this->line("Deleted: ".basename($file));
                    }
                    $deleted++;
                }
            }

            // Also check for cell subdirectory
            $cellDir = $savePath.'/map_'.$cellKey;
            if (is_dir($cellDir)) {
                if ($dryRun) {
                    $this->line("[dry-run] Would delete dir: {$cellDir}");
                } else {
                    $this->deleteDirectory($cellDir);
                    $this->line("Deleted dir: map_{$cellKey}");
                }
                $deleted++;
            }
        }

        $action = $dryRun ? 'Would delete' : 'Deleted';
        $this->info("{$action} {$deleted} files/dirs across ".count($targetCells).' cells.');

        return self::SUCCESS;
    }

    private function deleteDirectory(string $dir): void
    {
        $items = scandir($dir);
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $dir.'/'.$item;
            is_dir($path) ? $this->deleteDirectory($path) : unlink($path);
        }
        rmdir($dir);
    }
}
