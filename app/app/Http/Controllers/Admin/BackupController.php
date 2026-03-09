<?php

namespace App\Http\Controllers\Admin;

use App\Enums\BackupType;
use App\Http\Controllers\Controller;
use App\Http\Resources\BackupResource;
use App\Jobs\CreateBackupJob;
use App\Jobs\RollbackGameServer;
use App\Jobs\SendServerWarning;
use App\Models\Backup;
use App\Services\AuditLogger;
use App\Services\BackupManager;
use App\Services\GameVersionReader;
use App\Services\RconClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class BackupController extends Controller
{
    public function __construct(
        private readonly BackupManager $backupManager,
        private readonly AuditLogger $auditLogger,
        private readonly RconClient $rcon,
        private readonly GameVersionReader $versionReader,
    ) {}

    public function index(Request $request): Response
    {
        $query = Backup::query()->orderByDesc('created_at');

        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }

        $backups = $query->paginate(15);

        return Inertia::render('admin/backups', [
            'backups' => Inertia::defer(fn () => BackupResource::collection($backups)),
            'current_version' => $this->versionReader->getCachedVersion(),
            'current_branch' => $this->versionReader->getCurrentBranch(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'notes' => 'nullable|string|max:500',
            'notify_players' => 'sometimes|boolean',
            'message' => 'sometimes|nullable|string|max:500',
        ]);

        if ($request->boolean('notify_players')) {
            $message = $request->input('message', 'Backup in progress — expect a brief lag');
            try {
                $this->rcon->connect();
                $this->rcon->command("servermsg \"{$message}\"");
            } catch (\Throwable) {
                // RCON unavailable — proceed with backup
            }
        }

        CreateBackupJob::dispatch(
            BackupType::Manual,
            $request->input('notes'),
            $request->user()->name ?? 'admin',
            $request->ip(),
        );

        return response()->json([
            'message' => 'Backup started — it will appear in the list shortly',
        ], 202);
    }

    public function destroy(Request $request, Backup $backup): JsonResponse
    {
        $filename = $backup->filename;
        $this->backupManager->deleteBackup($backup);

        $this->auditLogger->log(
            actor: $request->user()->name ?? 'admin',
            action: 'backup.delete',
            target: $filename,
            ip: $request->ip(),
        );

        return response()->json(['message' => "Deleted {$filename}"]);
    }

    public function rollback(Request $request, Backup $backup): JsonResponse
    {
        $validated = $request->validate([
            'confirm' => 'required|boolean|accepted',
            'countdown' => 'sometimes|integer|min:10|max:3600',
            'message' => 'sometimes|nullable|string|max:500',
            'switch_branch' => 'sometimes|nullable|string|in:public,unstable,iwillbackupmysave',
        ]);

        // Validate backup file exists before dispatching job
        $this->backupManager->validateBackupFile($backup);

        $countdown = $validated['countdown'] ?? null;

        if ($countdown) {
            $warningMessage = ($validated['message'] ?? null)
                ?? "Server rolling back in {$countdown} seconds — you will be disconnected";

            try {
                $this->rcon->connect();
                $this->rcon->command("servermsg \"{$warningMessage}\"");
            } catch (\Throwable) {
                // RCON unavailable — still schedule the rollback
            }

            SendServerWarning::dispatchCountdownWarnings($countdown, 'rolling back', 'server.pending_action:rollback');

            $this->auditLogger->log(
                actor: $request->user()->name ?? 'admin',
                action: 'backup.rollback.scheduled',
                target: $backup->filename,
                details: ['countdown' => $countdown],
                ip: $request->ip(),
            );
        } else {
            $this->auditLogger->log(
                actor: $request->user()->name ?? 'admin',
                action: 'backup.rollback.initiated',
                target: $backup->filename,
                ip: $request->ip(),
            );
        }

        $switchBranch = $validated['switch_branch'] ?? null;

        // Always dispatch via queue — queue worker runs as root,
        // which is required to overwrite game server files.
        RollbackGameServer::dispatch($backup->id, $request->ip(), $switchBranch)
            ->delay($countdown ? now()->addSeconds($countdown) : null);

        return response()->json([
            'message' => $countdown
                ? "Rollback scheduled in {$countdown} seconds"
                : 'Rollback initiated — server will restart shortly',
        ]);
    }
}
