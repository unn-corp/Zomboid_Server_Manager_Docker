<?php

namespace App\Http\Controllers;

use App\Services\DockerManager;
use App\Services\ModManager;
use App\Services\RconClient;
use Carbon\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class StatusController extends Controller
{
    public function __construct(
        private readonly RconClient $rcon,
        private readonly DockerManager $docker,
        private readonly ModManager $modManager,
    ) {}

    public function __invoke(): Response
    {
        $containerStatus = $this->docker->getContainerStatus();
        $online = $containerStatus['running'] ?? false;

        $server = [
            'online' => $online,
            'player_count' => 0,
            'players' => [],
            'uptime' => null,
            'map' => null,
            'max_players' => null,
        ];

        if ($online) {
            $server['uptime'] = $this->calculateUptime($containerStatus['started_at'] ?? null);

            try {
                $this->rcon->connect();
                $playersResponse = $this->rcon->command('players');
                $parsed = $this->parsePlayers($playersResponse);
                $server['player_count'] = $parsed['count'];
                $server['players'] = $parsed['names'];
            } catch (\Throwable) {
                // RCON unavailable — server may still be starting
            }
        }

        $iniData = $this->readServerIni();
        $server['map'] = $iniData['Map'] ?? null;
        $server['max_players'] = isset($iniData['MaxPlayers']) ? (int) $iniData['MaxPlayers'] : null;

        $mods = [];
        try {
            $iniPath = config('zomboid.paths.server_ini');
            $mods = $this->modManager->list($iniPath);
        } catch (\Throwable) {
            // Config file not available
        }

        return Inertia::render('status', [
            'server' => $server,
            'mods' => $mods,
            'server_name' => config('zomboid.server_name', 'ZomboidServer'),
        ]);
    }

    /**
     * @return array{count: int, names: string[]}
     */
    private function parsePlayers(string $response): array
    {
        $lines = array_filter(array_map('trim', explode("\n", $response)));
        $names = [];

        foreach ($lines as $line) {
            if (str_starts_with($line, '-')) {
                $names[] = ltrim($line, '- ');
            }
        }

        $count = count($names);
        if (preg_match('/\((\d+)\)/', $response, $matches)) {
            $count = (int) $matches[1];
        }

        return ['count' => $count, 'names' => $names];
    }

    private function calculateUptime(?string $startedAt): ?string
    {
        if ($startedAt === null) {
            return null;
        }

        try {
            return Carbon::parse($startedAt)->diffForHumans(syntax: true);
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, string>
     */
    private function readServerIni(): array
    {
        $path = config('zomboid.paths.server_ini');

        if (! is_file($path)) {
            return [];
        }

        $data = [];
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);

        if ($lines === false) {
            return [];
        }

        foreach ($lines as $line) {
            if (str_starts_with($line, '#') || ! str_contains($line, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $data[trim($key)] = trim($value);
        }

        return $data;
    }
}
