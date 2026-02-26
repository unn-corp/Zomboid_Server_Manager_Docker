<?php

use App\Services\DockerManager;
use App\Services\ModManager;
use App\Services\RconClient;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function mockDockerForWeb(array $statusOverrides = []): void
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

    $docker->shouldReceive('getContainerLogs')
        ->andReturn([])
        ->byDefault();

    app()->instance(DockerManager::class, $docker);
}

function mockRconForWeb(array $commands = []): void
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

function mockRconOfflineForWeb(): void
{
    $rcon = Mockery::mock(RconClient::class);
    $rcon->shouldReceive('connect')->andThrow(new RuntimeException('Connection refused'));

    app()->instance(RconClient::class, $rcon);
}

function mockModManager(array $mods = []): void
{
    $modManager = Mockery::mock(ModManager::class);
    $modManager->shouldReceive('list')->andReturn($mods)->byDefault();

    app()->instance(ModManager::class, $modManager);
}

it('renders the status page without auth', function () {
    mockDockerForWeb();
    mockRconForWeb(['players' => "Players connected (0):\n"]);
    mockModManager();

    $response = $this->get('/status');

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('status')
        ->has('server')
        ->has('mods')
        ->has('server_name')
    );
});

it('shows server as online with player data', function () {
    mockDockerForWeb();
    mockRconForWeb(['players' => "Players connected (2):\n-PlayerOne\n-PlayerTwo\n"]);
    mockModManager([
        ['workshop_id' => '123', 'mod_id' => 'TestMod', 'position' => 0],
    ]);

    $response = $this->get('/status');

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('status')
        ->where('server.online', true)
        ->where('server.player_count', 2)
        ->where('server.players', ['PlayerOne', 'PlayerTwo'])
        ->has('mods', 1)
    );
});

it('shows server as offline when container is not running', function () {
    mockDockerForWeb(['running' => false, 'status' => 'exited']);
    mockRconOfflineForWeb();
    mockModManager();

    $response = $this->get('/status');

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('status')
        ->where('server.online', false)
        ->where('server.player_count', 0)
        ->where('server.players', [])
    );
});

it('handles RCON unavailable gracefully on status page', function () {
    mockDockerForWeb();
    mockRconOfflineForWeb();
    mockModManager();

    $response = $this->get('/status');

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('status')
        ->where('server.online', true)
        ->where('server.player_count', 0)
    );
});
