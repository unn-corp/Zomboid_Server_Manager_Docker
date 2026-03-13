<?php

namespace Database\Factories;

use App\Models\AutoRestartSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<AutoRestartSetting> */
class AutoRestartSettingFactory extends Factory
{
    protected $model = AutoRestartSetting::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'enabled' => false,
            'interval_hours' => 6,
            'warning_minutes' => 5,
            'warning_message' => null,
            'next_restart_at' => null,
        ];
    }

    public function enabled(): static
    {
        return $this->state([
            'enabled' => true,
        ]);
    }

    public function withNextRestart(?\Carbon\CarbonInterface $at = null): static
    {
        return $this->state([
            'next_restart_at' => $at ?? now()->addHours(6),
        ]);
    }
}
