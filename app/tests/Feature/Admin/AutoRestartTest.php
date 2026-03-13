<?php

use App\Enums\UserRole;
use App\Models\AuditLog;
use App\Models\AutoRestartSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
});

// ── Page rendering ───────────────────────────────────────────────────

describe('Auto restart settings page', function () {
    it('renders the settings page', function () {
        $this->actingAs($this->admin)
            ->get(route('admin.auto-restart'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('admin/auto-restart')
                ->has('settings')
            );
    });

    it('requires authentication', function () {
        $this->get(route('admin.auto-restart'))
            ->assertRedirect('/login');
    });

    it('requires admin role', function () {
        $player = User::factory()->create(['role' => UserRole::Player]);

        $this->actingAs($player)
            ->get(route('admin.auto-restart'))
            ->assertForbidden();
    });

    it('returns current settings', function () {
        AutoRestartSetting::factory()->enabled()->withNextRestart()->create([
            'interval_hours' => 8,
            'warning_minutes' => 10,
        ]);

        $this->actingAs($this->admin)
            ->get(route('admin.auto-restart'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('settings.enabled', true)
                ->where('settings.interval_hours', 8)
                ->where('settings.warning_minutes', 10)
                ->has('settings.next_restart_at')
            );
    });
});

// ── Settings update ──────────────────────────────────────────────────

describe('Auto restart settings update', function () {
    it('updates enabled flag', function () {
        AutoRestartSetting::factory()->create();

        $this->actingAs($this->admin)
            ->patchJson(route('admin.auto-restart.update'), [
                'enabled' => true,
            ])
            ->assertOk()
            ->assertJson(['message' => 'Auto-restart settings updated']);

        $settings = AutoRestartSetting::instance();
        expect($settings->enabled)->toBeTrue();
        expect($settings->next_restart_at)->not->toBeNull();
    });

    it('clears cache when disabling', function () {
        AutoRestartSetting::factory()->enabled()->withNextRestart()->create();
        cache()->put('server.auto_restart.pending', true);
        cache()->put('server.pending_action:restart', true);

        $this->actingAs($this->admin)
            ->patchJson(route('admin.auto-restart.update'), [
                'enabled' => false,
            ])
            ->assertOk();

        expect(cache()->has('server.auto_restart.pending'))->toBeFalse();
        expect(cache()->has('server.pending_action:restart'))->toBeFalse();
    });

    it('recalculates next_restart_at when interval changes', function () {
        AutoRestartSetting::factory()->enabled()->withNextRestart(
            now()->addHours(6)
        )->create(['interval_hours' => 6]);

        $this->actingAs($this->admin)
            ->patchJson(route('admin.auto-restart.update'), [
                'interval_hours' => 2,
            ])
            ->assertOk();

        $settings = AutoRestartSetting::instance();
        expect($settings->interval_hours)->toBe(2);
        // next_restart_at should be about 2 hours from now, not 6
        expect($settings->next_restart_at->diffInHours(now(), true))->toBeLessThan(3);
    });

    it('updates warning minutes', function () {
        AutoRestartSetting::factory()->create();

        $this->actingAs($this->admin)
            ->patchJson(route('admin.auto-restart.update'), [
                'warning_minutes' => 15,
            ])
            ->assertOk();

        expect(AutoRestartSetting::instance()->warning_minutes)->toBe(15);
    });

    it('updates warning message', function () {
        AutoRestartSetting::factory()->create();

        $this->actingAs($this->admin)
            ->patchJson(route('admin.auto-restart.update'), [
                'warning_message' => 'Scheduled maintenance restart',
            ])
            ->assertOk();

        expect(AutoRestartSetting::instance()->warning_message)->toBe('Scheduled maintenance restart');
    });

    it('creates audit log on update', function () {
        AutoRestartSetting::factory()->create();

        $this->actingAs($this->admin)
            ->patchJson(route('admin.auto-restart.update'), [
                'enabled' => true,
            ])
            ->assertOk();

        expect(AuditLog::where('action', 'autorestart.settings.update')->exists())->toBeTrue();
    });
});

// ── Validation ───────────────────────────────────────────────────────

describe('Auto restart validation', function () {
    it('rejects invalid interval', function () {
        $this->actingAs($this->admin)
            ->patchJson(route('admin.auto-restart.update'), [
                'interval_hours' => 5,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('interval_hours');
    });

    it('rejects invalid warning minutes', function () {
        $this->actingAs($this->admin)
            ->patchJson(route('admin.auto-restart.update'), [
                'warning_minutes' => 7,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('warning_minutes');
    });

    it('rejects message exceeding max length', function () {
        $this->actingAs($this->admin)
            ->patchJson(route('admin.auto-restart.update'), [
                'warning_message' => str_repeat('a', 501),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('warning_message');
    });

    it('allows valid intervals', function () {
        AutoRestartSetting::factory()->create();

        foreach ([2, 3, 4, 6, 8, 12, 24] as $interval) {
            $this->actingAs($this->admin)
                ->patchJson(route('admin.auto-restart.update'), [
                    'interval_hours' => $interval,
                ])
                ->assertOk();
        }
    });
});
