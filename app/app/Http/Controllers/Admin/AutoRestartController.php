<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdateAutoRestartRequest;
use App\Models\AutoRestartSetting;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class AutoRestartController extends Controller
{
    public function __construct(
        private readonly AuditLogger $auditLogger,
    ) {}

    public function index(): Response
    {
        $settings = AutoRestartSetting::instance();

        return Inertia::render('admin/auto-restart', [
            'settings' => [
                'enabled' => $settings->enabled,
                'interval_hours' => $settings->interval_hours,
                'warning_minutes' => $settings->warning_minutes,
                'warning_message' => $settings->warning_message,
                'next_restart_at' => $settings->next_restart_at?->toIso8601String(),
            ],
        ]);
    }

    public function update(UpdateAutoRestartRequest $request): JsonResponse
    {
        $settings = AutoRestartSetting::instance();
        $validated = $request->validated();

        $wasEnabled = $settings->enabled;
        $oldInterval = $settings->interval_hours;

        if (array_key_exists('enabled', $validated)) {
            $settings->enabled = $validated['enabled'];
        }

        if (array_key_exists('interval_hours', $validated)) {
            $settings->interval_hours = $validated['interval_hours'];
        }

        if (array_key_exists('warning_minutes', $validated)) {
            $settings->warning_minutes = $validated['warning_minutes'];
        }

        if (array_key_exists('warning_message', $validated)) {
            $settings->warning_message = $validated['warning_message'];
        }

        // Handle enable/disable transitions
        if ($settings->enabled && ! $wasEnabled) {
            // Just enabled — schedule next restart
            $settings->next_restart_at = now()->addHours($settings->interval_hours);
            Cache::forget('server.auto_restart.pending');
        } elseif (! $settings->enabled && $wasEnabled) {
            // Just disabled — clear pending cache keys
            Cache::forget('server.auto_restart.pending');
            Cache::forget('server.pending_action:restart');
        } elseif ($settings->enabled && $settings->interval_hours !== $oldInterval) {
            // Interval changed while enabled — recalculate
            $settings->next_restart_at = now()->addHours($settings->interval_hours);
            Cache::forget('server.auto_restart.pending');
        }

        $settings->save();

        $this->auditLogger->log(
            actor: $request->user()->name ?? 'admin',
            action: 'autorestart.settings.update',
            details: [
                'enabled' => $settings->enabled,
                'interval_hours' => $settings->interval_hours,
                'warning_minutes' => $settings->warning_minutes,
                'next_restart_at' => $settings->next_restart_at?->toIso8601String(),
            ],
            ip: $request->ip(),
        );

        return response()->json(['message' => 'Auto-restart settings updated']);
    }
}
