<?php

namespace App\Jobs;

use App\Services\AuditLogger;
use App\Services\RconClient;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

class WaitForServerReady implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 300;

    private const POLL_INTERVAL = 10;

    private const MAX_WAIT = 300;

    public function __construct(
        private readonly string $action,
        private readonly string $actor,
        private readonly string $ip,
    ) {}

    public function handle(RconClient $rcon): void
    {
        $elapsed = 0;

        while ($elapsed < self::MAX_WAIT) {
            try {
                $rcon->reconnect();

                AuditLogger::record(
                    actor: $this->actor,
                    action: $this->action,
                    ip: $this->ip,
                );

                Log::info('Server is ready — RCON connected', [
                    'action' => $this->action,
                    'elapsed_seconds' => $elapsed,
                ]);

                return;
            } catch (\Throwable) {
                // RCON not ready yet
            }

            sleep(self::POLL_INTERVAL);
            $elapsed += self::POLL_INTERVAL;
        }

        Log::warning('Server did not become ready within timeout', [
            'action' => $this->action,
            'timeout' => self::MAX_WAIT,
        ]);
    }
}
