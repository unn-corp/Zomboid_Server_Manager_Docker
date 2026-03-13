<?php

use App\Jobs\RestartGameServer;
use App\Jobs\SendServerWarning;
use App\Models\AuditLog;
use App\Models\AutoRestartSetting;
use App\Services\DockerManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();
    cache()->flush();

    $this->docker = Mockery::mock(DockerManager::class);
    $this->docker->shouldReceive('getContainerStatus')->andReturn([
        'exists' => true,
        'running' => true,
        'status' => 'running',
        'started_at' => now()->subHours(2)->toIso8601String(),
    ])->byDefault();
    app()->instance(DockerManager::class, $this->docker);
});

// ── Disabled ─────────────────────────────────────────────────────────

it('does nothing when auto-restart is disabled', function () {
    AutoRestartSetting::factory()->create(['enabled' => false]);

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    Queue::assertNothingPushed();
});

// ── First run (no next_restart_at) ───────────────────────────────────

it('sets next_restart_at on first run when null', function () {
    AutoRestartSetting::factory()->enabled()->create([
        'next_restart_at' => null,
        'interval_hours' => 4,
    ]);

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    $settings = AutoRestartSetting::instance();
    expect($settings->next_restart_at)->not->toBeNull();
    expect($settings->next_restart_at->diffInHours(now(), true))->toBeLessThan(5);

    Queue::assertNothingPushed();
});

// ── Server offline ───────────────────────────────────────────────────

it('skips when server is offline', function () {
    $this->docker->shouldReceive('getContainerStatus')->andReturn([
        'exists' => true,
        'running' => false,
        'status' => 'exited',
    ]);

    AutoRestartSetting::factory()->enabled()->withNextRestart(
        now()->addHours(2)
    )->create();

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    Queue::assertNothingPushed();
});

it('advances schedule when server is offline and restart time passed', function () {
    $this->docker->shouldReceive('getContainerStatus')->andReturn([
        'exists' => true,
        'running' => false,
        'status' => 'exited',
    ]);

    AutoRestartSetting::factory()->enabled()->create([
        'next_restart_at' => now()->subMinutes(10),
        'interval_hours' => 6,
    ]);

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    $settings = AutoRestartSetting::instance();
    expect($settings->next_restart_at->isFuture())->toBeTrue();

    Queue::assertNothingPushed();
});

// ── Not yet time ─────────────────────────────────────────────────────

it('does nothing when restart is not due yet', function () {
    AutoRestartSetting::factory()->enabled()->create([
        'next_restart_at' => now()->addHours(2),
        'warning_minutes' => 5,
    ]);

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    Queue::assertNothingPushed();
});

// ── Dispatches restart ───────────────────────────────────────────────

it('dispatches restart when within warning window', function () {
    AutoRestartSetting::factory()->enabled()->create([
        'next_restart_at' => now()->addMinutes(3),
        'warning_minutes' => 5,
        'interval_hours' => 6,
    ]);

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    Queue::assertPushed(RestartGameServer::class);
    Queue::assertPushed(SendServerWarning::class);
    expect(cache()->has('server.auto_restart.pending'))->toBeTrue();
    expect(cache()->has('server.pending_action:restart'))->toBeTrue();
});

it('creates audit log when scheduling auto-restart', function () {
    AutoRestartSetting::factory()->enabled()->create([
        'next_restart_at' => now()->addMinutes(2),
        'warning_minutes' => 5,
        'interval_hours' => 6,
    ]);

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    expect(AuditLog::where('action', 'server.autorestart.scheduled')->exists())->toBeTrue();
});

it('advances next_restart_at after scheduling', function () {
    $nextRestart = now()->addMinutes(2);

    AutoRestartSetting::factory()->enabled()->create([
        'next_restart_at' => $nextRestart,
        'warning_minutes' => 5,
        'interval_hours' => 6,
    ]);

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    $settings = AutoRestartSetting::instance();
    // Should be approximately 6 hours after the original next_restart_at
    expect($settings->next_restart_at->gt($nextRestart))->toBeTrue();
});

// ── Pending restart ──────────────────────────────────────────────────

it('skips when restart is already pending', function () {
    cache()->put('server.auto_restart.pending', true, 600);

    AutoRestartSetting::factory()->enabled()->create([
        'next_restart_at' => now()->addMinutes(1),
        'warning_minutes' => 5,
    ]);

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    Queue::assertNothingPushed();
});

it('clears overdue pending restart and advances schedule', function () {
    cache()->put('server.auto_restart.pending', true, 600);

    AutoRestartSetting::factory()->enabled()->create([
        'next_restart_at' => now()->subMinutes(10),
        'warning_minutes' => 5,
        'interval_hours' => 6,
    ]);

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    expect(cache()->has('server.auto_restart.pending'))->toBeFalse();

    $settings = AutoRestartSetting::instance();
    expect($settings->next_restart_at->isFuture())->toBeTrue();
});

// ── Custom warning message ───────────────────────────────────────────

it('uses custom warning message when set', function () {
    AutoRestartSetting::factory()->enabled()->create([
        'next_restart_at' => now()->addMinutes(3),
        'warning_minutes' => 5,
        'warning_message' => 'scheduled maintenance',
        'interval_hours' => 6,
    ]);

    $this->artisan('zomboid:auto-restart-check')->assertSuccessful();

    Queue::assertPushed(SendServerWarning::class);
    Queue::assertPushed(RestartGameServer::class);
});
