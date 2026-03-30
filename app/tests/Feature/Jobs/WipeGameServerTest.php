<?php

use App\Enums\BackupType;
use App\Jobs\WaitForServerReady;
use App\Jobs\WipeGameServer;
use App\Models\AuditLog;
use App\Services\BackupManager;
use App\Services\DockerManager;
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
});

function runWipeJob(string $ip = '127.0.0.1'): void
{
    $job = new WipeGameServer($ip);
    $job->handle(
        app(RconClient::class),
        app(DockerManager::class),
        app(BackupManager::class),
    );
}

// ── Config resolution ───────────────────────────────────────────────

it('resolves data path from zomboid config', function () {
    $dataPath = config('zomboid.paths.data');

    expect($dataPath)->not->toBeNull();
    expect($dataPath)->not->toBeEmpty();
});

it('resolves container name from zomboid config', function () {
    $containerName = config('zomboid.docker.container_name');

    expect($containerName)->not->toBeNull();
    expect($containerName)->not->toBeEmpty();
});

// ── Wipe execution ──────────────────────────────────────────────────

it('creates pre-wipe backup', function () {
    $this->backupManager->shouldReceive('createBackup')
        ->with(BackupType::PreRollback, 'Pre-wipe safety backup')
        ->once()
        ->andReturn(['backup' => (object) ['filename' => 'pre-wipe.tar.gz']]);

    runWipeJob();
});

it('proceeds with wipe when backup fails', function () {
    $this->backupManager->shouldReceive('createBackup')
        ->andThrow(new RuntimeException('Backup failed'));

    $this->docker->shouldReceive('stopContainer')->once();
    $this->docker->shouldReceive('startContainer')->once();

    runWipeJob();

    Queue::assertPushed(WaitForServerReady::class);
});

// ── Container lifecycle ─────────────────────────────────────────────

it('stops then starts the container', function () {
    $this->docker->shouldReceive('stopContainer')->once()->ordered();
    $this->docker->shouldReceive('startContainer')->once()->ordered();

    runWipeJob();
});

// ── Audit logging ───────────────────────────────────────────────────

it('logs audit entry with correct container name', function () {
    runWipeJob();

    $log = AuditLog::where('action', 'server.wipe.executed')->first();
    expect($log)->not->toBeNull();
    expect($log->target)->toBe(config('zomboid.docker.container_name'));
});

// ── Save data deletion ──────────────────────────────────────────────

it('deletes save directories when they exist', function () {
    $dataPath = config('zomboid.paths.data');

    // Create temp directories to simulate save data
    $savesPath = "{$dataPath}/Saves";
    $dbPath = "{$dataPath}/db";
    $startupBackups = "{$dataPath}/backups/startup";

    @mkdir($savesPath, 0755, true);
    @mkdir($dbPath, 0755, true);
    @mkdir($startupBackups, 0755, true);

    // Create test files inside
    file_put_contents("{$savesPath}/test.bin", 'save-data');
    file_put_contents("{$dbPath}/serverPZ.db", 'db-data');
    file_put_contents("{$startupBackups}/backup.zip", 'backup-data');

    runWipeJob();

    expect(is_dir($savesPath))->toBeFalse();
    expect(is_dir($dbPath))->toBeFalse();
    expect(is_dir($startupBackups))->toBeFalse();
});

// ── RCON graceful shutdown ──────────────────────────────────────────

it('sends save and quit via RCON before stopping', function () {
    $this->rcon->shouldReceive('connect')->once();
    $this->rcon->shouldReceive('command')->with('/save')->once();
    $this->rcon->shouldReceive('command')->with('/quit')->once();

    runWipeJob();
});

it('proceeds when RCON is unavailable', function () {
    $this->rcon->shouldReceive('connect')->andThrow(new RuntimeException('Connection refused'));

    $this->docker->shouldReceive('stopContainer')->once();
    $this->docker->shouldReceive('startContainer')->once();

    runWipeJob();

    Queue::assertPushed(WaitForServerReady::class);
});

// ── WaitForServerReady ──────────────────────────────────────────────

it('dispatches WaitForServerReady after wipe', function () {
    runWipeJob();

    Queue::assertPushed(WaitForServerReady::class);
});
