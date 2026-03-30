<?php

use App\Enums\BackupType;
use App\Jobs\UpdateGameServer;
use App\Jobs\WaitForServerReady;
use App\Models\AuditLog;
use App\Services\BackupManager;
use App\Services\DockerManager;
use App\Services\GameServerUpdater;
use App\Services\RconClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;

uses(RefreshDatabase::class);

beforeEach(function () {
    Queue::fake();

    $this->docker = Mockery::mock(DockerManager::class);
    $this->docker->shouldReceive('stopContainer')->andReturn(true)->byDefault();
    $this->docker->shouldReceive('startContainer')->andReturn(true)->byDefault();
    app()->instance(DockerManager::class, $this->docker);

    $this->rcon = Mockery::mock(RconClient::class);
    $this->rcon->shouldReceive('connect')->andReturnNull()->byDefault();
    $this->rcon->shouldReceive('command')->andReturnNull()->byDefault();
    app()->instance(RconClient::class, $this->rcon);

    $this->backupManager = Mockery::mock(BackupManager::class);
    $this->backupManager->shouldReceive('createBackup')->andReturn([
        'backup' => (object) ['filename' => 'test-backup.tar.gz'],
    ])->byDefault();
    app()->instance(BackupManager::class, $this->backupManager);

    $this->updater = Mockery::mock(GameServerUpdater::class);
    $this->updater->shouldReceive('getCurrentBranch')->andReturn('public')->byDefault();
    $this->updater->shouldReceive('setBranch')->byDefault();
    $this->updater->shouldReceive('triggerForceUpdate')->byDefault();
    app()->instance(GameServerUpdater::class, $this->updater);
});

function runUpdateJob(string $ip = '127.0.0.1', ?string $branch = null): void
{
    $job = new UpdateGameServer($ip, $branch);
    $job->handle(
        app(RconClient::class),
        app(DockerManager::class),
        app(BackupManager::class),
        app(GameServerUpdater::class),
    );
}

// ── Branch switching ────────────────────────────────────────────────

it('sets branch override when branch is provided', function () {
    $this->updater->shouldReceive('setBranch')->with('unstable')->once();
    $this->updater->shouldReceive('triggerForceUpdate')->once();

    runUpdateJob('127.0.0.1', 'unstable');

    Queue::assertPushed(WaitForServerReady::class);
});

it('does not set branch override when branch is null', function () {
    $this->updater->shouldNotReceive('setBranch');
    $this->updater->shouldReceive('triggerForceUpdate')->once();

    runUpdateJob();
});

// ── Container lifecycle ─────────────────────────────────────────────

it('stops then starts the container', function () {
    $this->docker->shouldReceive('stopContainer')->once()->ordered();
    $this->docker->shouldReceive('startContainer')->once()->ordered();

    runUpdateJob();
});

// ── Backup ──────────────────────────────────────────────────────────

it('creates a pre-update backup', function () {
    $this->backupManager->shouldReceive('createBackup')
        ->with(BackupType::PreUpdate, 'Automatic pre-update backup')
        ->once()
        ->andReturn(['backup' => (object) ['filename' => 'pre-update.tar.gz']]);

    runUpdateJob();
});

it('proceeds with update when backup fails', function () {
    $this->backupManager->shouldReceive('createBackup')
        ->andThrow(new RuntimeException('Disk full'));

    $this->docker->shouldReceive('stopContainer')->once();
    $this->docker->shouldReceive('startContainer')->once();

    runUpdateJob();

    Queue::assertPushed(WaitForServerReady::class);
});

// ── Audit logging ───────────────────────────────────────────────────

it('logs audit entry with correct container name', function () {
    runUpdateJob('127.0.0.1', 'unstable');

    $log = AuditLog::where('action', 'server.update.executed')->first();
    expect($log)->not->toBeNull();
    expect($log->target)->toBe(config('zomboid.docker.container_name'));
    expect($log->details['branch'])->toBe('unstable');
});

// ── RCON graceful shutdown ──────────────────────────────────────────

it('sends save and quit via RCON before stopping', function () {
    $this->rcon->shouldReceive('connect')->once();
    $this->rcon->shouldReceive('command')->with('/save')->once();
    $this->rcon->shouldReceive('command')->with('/quit')->once();

    runUpdateJob();
});

it('proceeds when RCON is unavailable', function () {
    $this->rcon->shouldReceive('connect')->andThrow(new RuntimeException('Connection refused'));

    $this->docker->shouldReceive('stopContainer')->once();
    $this->docker->shouldReceive('startContainer')->once();

    runUpdateJob();

    Queue::assertPushed(WaitForServerReady::class);
});

// ── WaitForServerReady ──────────────────────────────────────────────

it('dispatches WaitForServerReady with 30 minute timeout', function () {
    runUpdateJob();

    Queue::assertPushed(WaitForServerReady::class, function ($job) {
        $reflection = new ReflectionClass($job);
        $maxWait = $reflection->getProperty('maxWait');

        return $maxWait->getValue($job) === 1800;
    });
});
