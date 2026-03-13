<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AutoRestartSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'enabled',
        'interval_hours',
        'warning_minutes',
        'warning_message',
        'next_restart_at',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'interval_hours' => 'integer',
            'warning_minutes' => 'integer',
            'next_restart_at' => 'datetime',
        ];
    }

    /**
     * Get the singleton settings instance, creating one if none exists.
     */
    public static function instance(): static
    {
        return static::query()->firstOrCreate([], [
            'enabled' => false,
            'interval_hours' => 6,
            'warning_minutes' => 5,
        ]);
    }

    /**
     * Set next_restart_at based on current time + interval_hours.
     */
    public function scheduleNextRestart(): void
    {
        $this->next_restart_at = now()->addHours($this->interval_hours);
        $this->save();
    }
}
