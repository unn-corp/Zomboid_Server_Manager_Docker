<?php

use App\Models\AuditLog;
use App\Models\Backup;
use App\Models\User;
use App\Services\DockerManager;
use App\Services\RconClient;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function mockDashboardDocker(array $statusOverrides = []): void
{
    $docker = Mockery::mock(DockerManager::class);

    $defaultStatus = [
        'exists' => true,
        'running' => true,
        'status' => 'running',
        'started_at' => now()->subHours(2)->toIso8601String(),
        'finished_at' => null,
        'restart_count' => 0,
    ];

    $docker->shouldReceive('getContainerStatus')
        ->andReturn(array_merge($defaultStatus, $statusOverrides))
        ->byDefault();

    app()->instance(DockerManager::class, $docker);
}

function mockDashboardRcon(array $commands = []): void
{
    $rcon = Mockery::mock(RconClient::class);
    $rcon->shouldReceive('connect')->byDefault();
    $rcon->shouldReceive('command')->andReturn('')->byDefault();

    foreach ($commands as $command => $response) {
        $rcon->shouldReceive('command')
            ->with($command)
            ->andReturn($response);
    }

    app()->instance(RconClient::class, $rcon);
}

function mockDashboardRconOffline(): void
{
    $rcon = Mockery::mock(RconClient::class);
    $rcon->shouldReceive('connect')->andThrow(new RuntimeException('Connection refused'));

    app()->instance(RconClient::class, $rcon);
}

it('redirects guests to login', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

it('renders the dashboard for authenticated users', function () {
    mockDashboardDocker();
    mockDashboardRcon(['players' => "Players connected (0):\n"]);

    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('dashboard')
        ->has('server')
        ->has('recent_audit')
        ->has('backup_summary')
    );
});

it('shows server status on the dashboard', function () {
    mockDashboardDocker();
    mockDashboardRcon(['players' => "Players connected (3):\n-Alice\n-Bob\n-Charlie\n"]);

    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('dashboard')
        ->where('server.online', true)
        ->where('server.player_count', 3)
        ->where('server.players', ['Alice', 'Bob', 'Charlie'])
    );
});

it('shows recent audit log entries', function () {
    mockDashboardDocker(['running' => false]);
    mockDashboardRconOffline();

    AuditLog::create([
        'actor' => 'api-key',
        'action' => 'server.restart',
        'target' => 'game-server',
        'created_at' => now(),
    ]);

    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('dashboard')
        ->has('recent_audit', 1)
        ->where('recent_audit.0.action', 'server.restart')
    );
});

it('shows backup summary on the dashboard', function () {
    mockDashboardDocker(['running' => false]);
    mockDashboardRconOffline();

    Backup::create([
        'filename' => 'backup-2026-02-26-001.tar.gz',
        'path' => '/backups/backup-2026-02-26-001.tar.gz',
        'size_bytes' => 1048576,
        'type' => 'manual',
        'created_at' => now(),
    ]);

    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('dashboard')
        ->where('backup_summary.total_count', 1)
        ->where('backup_summary.total_size_human', '1 MB')
    );
});

it('handles offline server gracefully on dashboard', function () {
    mockDashboardDocker(['running' => false, 'status' => 'exited']);
    mockDashboardRconOffline();

    $user = User::factory()->admin()->create();

    $response = $this->actingAs($user)->get(route('dashboard'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('dashboard')
        ->where('server.online', false)
    );
});
