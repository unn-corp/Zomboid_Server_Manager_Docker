<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\PlayerPositionReader;
use App\Services\PlayersDbReader;
use Illuminate\Http\Response;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class PlayerMapController extends Controller
{
    public function __construct(
        private readonly PlayersDbReader $playersDb,
        private readonly PlayerPositionReader $positionReader,
    ) {}

    public function __invoke(): InertiaResponse
    {
        $dbPlayers = $this->playersDb->getAllPlayerPositions();
        $liveData = $this->positionReader->getLivePositions();

        $onlineUsernames = [];
        $livePositions = [];

        if ($liveData !== null && ! empty($liveData['players'])) {
            foreach ($liveData['players'] as $player) {
                $username = $player['username'] ?? '';
                $onlineUsernames[] = $username;
                $livePositions[$username] = $player;
            }
        }

        $markers = [];

        foreach ($dbPlayers as $player) {
            $username = $player['username'];
            $isOnline = in_array($username, $onlineUsernames);

            if ($isOnline && isset($livePositions[$username])) {
                $live = $livePositions[$username];
                $isDead = $live['is_dead'] ?? $player['is_dead'];

                $markers[] = [
                    'username' => $username,
                    'name' => $player['name'],
                    'x' => (float) $live['x'],
                    'y' => (float) $live['y'],
                    'z' => (int) ($live['z'] ?? 0),
                    'status' => $isDead ? 'dead' : 'online',
                    'is_online' => true,
                ];
            } else {
                $markers[] = [
                    'username' => $username,
                    'name' => $player['name'],
                    'x' => $player['x'],
                    'y' => $player['y'],
                    'z' => $player['z'],
                    'status' => $player['is_dead'] ? 'dead' : 'offline',
                    'is_online' => false,
                ];
            }
        }

        // Add any online players not in the DB (new connections)
        foreach ($onlineUsernames as $username) {
            $alreadyAdded = collect($markers)->contains('username', $username);
            if (! $alreadyAdded && isset($livePositions[$username])) {
                $live = $livePositions[$username];
                $markers[] = [
                    'username' => $username,
                    'name' => $username,
                    'x' => (float) $live['x'],
                    'y' => (float) $live['y'],
                    'z' => (int) ($live['z'] ?? 0),
                    'status' => ($live['is_dead'] ?? false) ? 'dead' : 'online',
                    'is_online' => true,
                ];
            }
        }

        $mapConfig = $this->buildMapConfig();

        return Inertia::render('admin/player-map', [
            'markers' => $markers,
            'mapConfig' => $mapConfig,
            'hasTiles' => $mapConfig['tileUrl'] !== null,
            'tileProgress' => null,
            'tilesGenerating' => false,
        ]);
    }

    /**
     * Serve a map tile from the configured tiles path.
     */
    public function tile(string $level, string $tile): BinaryFileResponse|Response
    {
        $tilesPath = config('zomboid.map.tiles_path');
        $dziPath = $tilesPath.'/html/map_data/base/layer0_files';

        // Try webp first, then jpg
        $baseTile = pathinfo($tile, PATHINFO_FILENAME);
        $filePath = null;
        $contentType = 'image/webp';

        foreach (['webp', 'jpg'] as $ext) {
            $candidate = $dziPath.'/'.$level.'/'.$baseTile.'.'.$ext;
            if (is_file($candidate)) {
                $filePath = $candidate;
                $contentType = $ext === 'jpg' ? 'image/jpeg' : 'image/webp';
                break;
            }
        }

        if ($filePath === null) {
            // Return transparent 1x1 PNG for missing tiles (avoids broken-image placeholders in Leaflet)
            return response(base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), 200, [
                'Content-Type' => 'image/png',
                'Cache-Control' => 'public, max-age=86400',
            ]);
        }

        // Prevent path traversal
        $realTilesPath = realpath($tilesPath);
        $realFilePath = realpath($filePath);

        if ($realTilesPath === false || $realFilePath === false || ! str_starts_with($realFilePath, $realTilesPath)) {
            return response('Not found', 404);
        }

        return response()->file($realFilePath, [
            'Cache-Control' => 'public, max-age=86400',
            'Content-Type' => $contentType,
        ]);
    }

    /**
     * Build map configuration, preferring local tiles then falling back to proxy.
     */
    private function buildMapConfig(): array
    {
        $localDzi = $this->getLocalDziConfig();

        if ($localDzi) {
            return [
                'tileUrl' => url('/admin/map-tiles/{z}/{x}_{y}'),
                'tileSize' => config('zomboid.map.tile_size'),
                'minZoom' => config('zomboid.map.min_zoom'),
                'maxZoom' => config('zomboid.map.max_zoom'),
                'defaultZoom' => config('zomboid.map.default_zoom'),
                'center' => [
                    'x' => config('zomboid.map.center_x'),
                    'y' => config('zomboid.map.center_y'),
                ],
                'dzi' => $localDzi,
            ];
        }

        // Fall back to proxy tiles from map.projectzomboid.com
        $proxyDzi = config('zomboid.map.proxy_dzi');
        $w = $proxyDzi['width'];
        $h = $proxyDzi['height'];
        $sqr = $proxyDzi['sqr'];
        $maxNativeZoom = (int) ceil(log(max($w, $h), 2));

        return [
            'tileUrl' => config('zomboid.map.proxy_url'),
            'tileSize' => config('zomboid.map.proxy_tile_size'),
            'minZoom' => config('zomboid.map.min_zoom'),
            'maxZoom' => config('zomboid.map.max_zoom'),
            'defaultZoom' => config('zomboid.map.default_zoom'),
            'center' => [
                'x' => config('zomboid.map.center_x'),
                'y' => config('zomboid.map.center_y'),
            ],
            'dzi' => [
                'width' => $w,
                'height' => $h,
                'x0' => $proxyDzi['x0'],
                'y0' => $proxyDzi['y0'],
                'sqr' => $sqr,
                'maxNativeZoom' => $maxNativeZoom,
                'isometric' => true,
            ],
        ];
    }

    /**
     * Get DZI config from locally generated tiles, or null if not available.
     */
    private function getLocalDziConfig(): ?array
    {
        $dziPath = config('zomboid.map.tiles_path').'/html/map_data/base/layer0_files';

        if (! is_dir($dziPath.'/0')) {
            return null;
        }

        $webp = glob($dziPath.'/0/*.webp');
        $jpg = glob($dziPath.'/0/*.jpg');

        if (empty($webp) && empty($jpg)) {
            return null;
        }

        $infoPath = config('zomboid.map.tiles_path').'/html/map_data/base/map_info.json';

        if (! is_file($infoPath)) {
            return null;
        }

        $mapInfo = json_decode(file_get_contents($infoPath), true);

        $w = (int) $mapInfo['w'];
        $h = (int) $mapInfo['h'];
        $sqr = (int) ($mapInfo['sqr'] ?? 1);

        return [
            'width' => $w,
            'height' => $h,
            'x0' => (int) ($mapInfo['x0'] ?? 0),
            'y0' => (int) ($mapInfo['y0'] ?? 0),
            'sqr' => $sqr,
            'maxNativeZoom' => (int) ceil(log(max($w, $h), 2)),
            'isometric' => $sqr > 2,
        ];
    }
}
