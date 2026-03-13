<?php

namespace App\Console\Commands;

use App\Jobs\RestartGameServer;
use App\Jobs\SendServerWarning;
use App\Models\AutoRestartSetting;
use App\Services\AuditLogger;
use App\Services\DockerManager;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class AutoRestartCheck extends Command
{
    protected $signature = 'zomboid:auto-restart-check';

    protected $description = 'Check if an automatic server restart is due';

    public function handle(DockerManager $docker): int
    {
        $settings = AutoRestartSetting::instance();

        if (! $settings->enabled) {
            return self::SUCCESS;
        }

        // If next_restart_at not set, schedule it and return
        if ($settings->next_restart_at === null) {
            $settings->scheduleNextRestart();
            Log::info('Auto-restart: scheduled first restart', [
                'next_restart_at' => $settings->next_restart_at->toIso8601String(),
            ]);

            return self::SUCCESS;
        }

        // Check if server is online
        $status = $docker->getContainerStatus();
        if (! $status['running']) {
            // If we've passed the restart time while offline, advance the schedule
            if (now()->gte($settings->next_restart_at)) {
                $settings->scheduleNextRestart();
                Cache::forget('server.auto_restart.pending');
                Log::info('Auto-restart: server offline, advanced schedule', [
                    'next_restart_at' => $settings->next_restart_at->toIso8601String(),
                ]);
            }

            return self::SUCCESS;
        }

        // If a restart is already pending, check if it's overdue (e.g. job failed)
        if (Cache::has('server.auto_restart.pending')) {
            if (now()->gte($settings->next_restart_at->addMinutes(5))) {
                // Restart is overdue — clear pending and advance schedule
                Cache::forget('server.auto_restart.pending');
                Cache::forget('server.pending_action:restart');
                $settings->scheduleNextRestart();
                Log::warning('Auto-restart: pending restart was overdue, advanced schedule');
            }

            return self::SUCCESS;
        }

        $warningSeconds = $settings->warning_minutes * 60;
        $triggerTime = $settings->next_restart_at->copy()->subSeconds($warningSeconds);

        // Not yet time to trigger
        if (now()->lt($triggerTime)) {
            return self::SUCCESS;
        }

        // Time to initiate the restart pipeline
        $delaySeconds = (int) max(0, now()->diffInSeconds($settings->next_restart_at, false));

        // Set cache flags
        Cache::put('server.auto_restart.pending', true, $delaySeconds + 300);
        Cache::put('server.pending_action:restart', true, $delaySeconds + 300);

        // Dispatch the restart job with delay
        RestartGameServer::dispatch('127.0.0.1')
            ->delay(now()->addSeconds($delaySeconds));

        // Dispatch countdown warnings
        if ($delaySeconds > 0) {
            $warningMessage = $settings->warning_message ?? 'restart (automatic)';
            SendServerWarning::dispatchCountdownWarnings(
                $delaySeconds,
                $warningMessage,
                'server.pending_action:restart',
            );
        }

        // Audit log
        AuditLogger::record(
            actor: 'system',
            action: 'server.autorestart.scheduled',
            target: config('zomboid.docker.container_name'),
            details: [
                'interval_hours' => $settings->interval_hours,
                'countdown' => $delaySeconds,
                'next_restart_at' => $settings->next_restart_at->toIso8601String(),
            ],
        );

        // Schedule the next restart after this one
        $settings->next_restart_at = $settings->next_restart_at->addHours($settings->interval_hours);
        $settings->save();

        $this->info("Auto-restart scheduled in {$delaySeconds} seconds.");

        return self::SUCCESS;
    }
}
