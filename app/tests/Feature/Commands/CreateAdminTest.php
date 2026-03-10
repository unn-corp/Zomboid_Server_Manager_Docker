<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates a super admin when none exists', function () {
    $this->artisan('zomboid:create-admin', [
        '--username' => 'admin',
        '--email' => 'admin@example.com',
        '--password' => 'secret123',
    ])
        ->expectsOutputToContain("Super admin 'admin' created successfully.")
        ->assertSuccessful();

    $user = User::where('username', 'admin')->first();

    expect($user)->not->toBeNull()
        ->and($user->role)->toBe(UserRole::SuperAdmin)
        ->and($user->email)->toBe('admin@example.com')
        ->and($user->email_verified_at)->not->toBeNull();
});

it('skips when a super admin already exists', function () {
    User::factory()->create(['role' => UserRole::SuperAdmin]);

    $this->artisan('zomboid:create-admin', [
        '--username' => 'another',
        '--password' => 'secret123',
    ])
        ->expectsOutputToContain('Super admin already exists')
        ->assertSuccessful();

    expect(User::where('role', UserRole::SuperAdmin)->count())->toBe(1);
});

it('works without an email', function () {
    $this->artisan('zomboid:create-admin', [
        '--username' => 'noemail',
        '--password' => 'secret123',
    ])->assertSuccessful();

    $user = User::where('username', 'noemail')->first();

    expect($user)->not->toBeNull()
        ->and($user->email)->toBeNull()
        ->and($user->email_verified_at)->toBeNull()
        ->and($user->role)->toBe(UserRole::SuperAdmin);
});

it('sets email_verified_at when email is provided', function () {
    $this->artisan('zomboid:create-admin', [
        '--username' => 'verified',
        '--email' => 'test@example.com',
        '--password' => 'secret123',
    ])->assertSuccessful();

    $user = User::where('username', 'verified')->first();

    expect($user->email_verified_at)->not->toBeNull();
});

it('reads from config when no options given', function () {
    config([
        'zomboid.admin.username' => 'cfgadmin',
        'zomboid.admin.email' => 'cfg@example.com',
        'zomboid.admin.password' => 'cfgpass',
    ]);

    $this->artisan('zomboid:create-admin')->assertSuccessful();

    $user = User::where('username', 'cfgadmin')->first();

    expect($user)->not->toBeNull()
        ->and($user->email)->toBe('cfg@example.com')
        ->and($user->role)->toBe(UserRole::SuperAdmin);
});

it('fails when username or password is missing', function () {
    config([
        'zomboid.admin.username' => '',
        'zomboid.admin.password' => '',
    ]);

    $this->artisan('zomboid:create-admin')
        ->expectsOutputToContain('Username and password are required')
        ->assertFailed();
});
