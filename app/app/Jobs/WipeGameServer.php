<?php

namespace App\Jobs;

use App\Enums\BackupType;
use App\Services\AuditLogger;
use App\Services\BackupManager;
use App\Services\DockerManager;
use App\Services\RconClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class WipeGameServer implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 600;

    public function __construct(
        private readonly string $ip,
        private readonly bool $mapOnly = false,
    ) {}

    public function handle(RconClient $rcon, DockerManager $docker, BackupManager $backupManager): void
    {
        Cache::forget('server.pending_action:wipe');

        // 1. Create pre-wipe backup
        try {
            $result = $backupManager->createBackup(BackupType::PreRollback, 'Pre-wipe safety backup');

            Log::info('Pre-wipe backup created', [
                'filename' => $result['backup']->filename,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Pre-wipe backup failed, proceeding with wipe', [
                'error' => $e->getMessage(),
            ]);
        }

        // 2. Graceful shutdown via RCON, fallback to Docker stop
        try {
            $rcon->connect();
            $rcon->command('/save');
            sleep(5);
            $rcon->command('/quit');
        } catch (\Throwable $e) {
            Log::warning('RCON unavailable during scheduled wipe, proceeding with Docker stop', [
                'error' => $e->getMessage(),
            ]);
        }

        $docker->stopContainer(timeout: 30);

        AuditLogger::record(
            actor: 'system',
            action: 'server.wipe.executed',
            target: config('zomboid.docker.container_name'),
            details: ['source' => 'scheduled_job', 'map_only' => $this->mapOnly],
            ip: $this->ip,
        );

        $dataPath = config('zomboid.paths.data');

        if ($this->mapOnly) {
            // 3a. Map-only wipe: delete map chunks but keep player files (.plr)
            // Players keep their skills, inventory, and XP but the world regenerates
            $serverName = config('zomboid.server_name', 'ZomboidServer');
            $savePath = "{$dataPath}/Saves/Multiplayer/{$serverName}";

            if (is_dir($savePath)) {
                // Delete map cells, zombies, vehicles, loot — everything except .plr files
                $patterns = ['map_*.bin', 'zpop_*.bin', 'vehicles*.bin', 'reanimated*.bin', 'chunkdata_*.bin', 'lootMap.bin'];
                foreach ($patterns as $pattern) {
                    $files = glob("{$savePath}/{$pattern}");
                    if ($files) {
                        foreach ($files as $file) {
                            unlink($file);
                        }
                    }
                }

                // Delete map subdirectories (cell data)
                $dirs = glob("{$savePath}/map_*", GLOB_ONLYDIR);
                if ($dirs) {
                    foreach ($dirs as $dir) {
                        Process::run(['rm', '-rf', $dir]);
                    }
                }

                Log::info('Map data wiped (players preserved)', ['path' => $savePath]);
            }

            // Remove PZ startup backups so it doesn't auto-restore old map
            $startupBackups = "{$dataPath}/backups/startup";
            if (is_dir($startupBackups)) {
                Process::run(['rm', '-rf', $startupBackups]);
                Log::info('PZ startup backups deleted');
            }
        } else {
            // 3b. Full wipe: delete ALL save data, databases, and PZ internal backups
            $savesPath = "{$dataPath}/Saves";
            if (is_dir($savesPath)) {
                $deleteResult = Process::run(['rm', '-rf', $savesPath]);
                Log::info('All save data deleted', ['path' => $savesPath, 'success' => $deleteResult->successful()]);
            }

            // Remove all server databases (player accounts, roles, config)
            $dbPath = "{$dataPath}/db";
            if (is_dir($dbPath)) {
                $deleteResult = Process::run(['rm', '-rf', $dbPath]);
                Log::info('All server databases deleted', ['path' => $dbPath, 'success' => $deleteResult->successful()]);
            }

            // Remove PZ startup backups — PZ auto-restores saves from these on boot
            $startupBackups = "{$dataPath}/backups/startup";
            if (is_dir($startupBackups)) {
                $backupResult = Process::run(['rm', '-rf', $startupBackups]);
                Log::info('PZ startup backups deleted', ['success' => $backupResult->successful()]);
            }
        }

        // 4. Start server
        $docker->startContainer();

        // 5. Wait for server ready
        WaitForServerReady::dispatch(
            'server.wipe.completed',
            'system',
            $this->ip,
        );
    }
}
