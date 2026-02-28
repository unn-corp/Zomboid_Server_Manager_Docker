<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Backup;
use App\Models\GameEvent;
use App\Services\GameStateReader;
use App\Services\PlayerStatsService;
use App\Services\ServerStatusResolver;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(
        private readonly ServerStatusResolver $statusResolver,
        private readonly GameStateReader $gameStateReader,
        private readonly PlayerStatsService $playerStatsService,
    ) {}

    public function __invoke(): Response
    {
        $resolved = $this->statusResolver->resolve();

        $server = [
            'online' => $resolved['online'],
            'status' => $resolved['game_status'],
            'container_status' => $resolved['container_status'],
            'player_count' => $resolved['player_count'],
            'players' => $resolved['players'],
            'uptime' => $resolved['uptime'],
            'map' => $resolved['map'],
            'max_players' => $resolved['max_players'],
        ];

        $recentAudit = AuditLog::query()
            ->orderByDesc('created_at')
            ->limit(10)
            ->get()
            ->map(fn (AuditLog $log) => [
                'id' => $log->id,
                'actor' => $log->actor,
                'action' => $log->action,
                'target' => $log->target,
                'details' => $log->details,
                'ip_address' => $log->ip_address,
                'created_at' => $log->created_at?->toIso8601String(),
            ])
            ->all();

        $backupQuery = Backup::query();
        $totalCount = $backupQuery->count();
        $totalSizeBytes = (int) $backupQuery->sum('size_bytes');
        $lastBackup = Backup::query()
            ->orderByDesc('created_at')
            ->first();

        $backupSummary = [
            'total_count' => $totalCount,
            'last_backup' => $lastBackup ? [
                'id' => $lastBackup->id,
                'filename' => $lastBackup->filename,
                'size_bytes' => $lastBackup->size_bytes,
                'size_human' => $this->formatBytes($lastBackup->size_bytes),
                'type' => $lastBackup->type->value,
                'notes' => $lastBackup->notes,
                'created_at' => $lastBackup->created_at?->toIso8601String(),
            ] : null,
            'total_size_human' => $this->formatBytes($totalSizeBytes),
        ];

        $gameState = $resolved['online'] ? $this->gameStateReader->getGameState() : null;

        return Inertia::render('dashboard', [
            'server' => $server,
            'game_state' => $gameState,
            'recent_audit' => Inertia::defer(fn () => $recentAudit),
            'backup_summary' => Inertia::defer(fn () => $backupSummary),
            'leaderboard' => Inertia::defer(fn () => [
                'kills' => $this->playerStatsService->getLeaderboard('zombie_kills', 5),
                'survival' => $this->playerStatsService->getLeaderboard('hours_survived', 5),
            ]),
            'game_events' => Inertia::defer(fn () => GameEvent::query()
                ->orderByDesc('created_at')
                ->limit(15)
                ->get()
                ->map(fn (GameEvent $event) => [
                    'id' => $event->id,
                    'event_type' => $event->event_type,
                    'player' => $event->player,
                    'target' => $event->target,
                    'details' => $event->details,
                    'game_time' => $event->game_time?->toIso8601String(),
                    'created_at' => $event->created_at?->toIso8601String(),
                ])
                ->all()),
        ]);
    }

    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1073741824) {
            return round($bytes / 1073741824, 2).' GB';
        }

        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 2).' MB';
        }

        if ($bytes >= 1024) {
            return round($bytes / 1024, 2).' KB';
        }

        return $bytes.' B';
    }
}
