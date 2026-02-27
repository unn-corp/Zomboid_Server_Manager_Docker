<?php

namespace App\Http\Controllers;

use App\Models\WhitelistEntry;
use App\Services\PlayerPositionReader;
use App\Services\PlayersDbReader;
use App\Services\RconClient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use Inertia\Response;

class PortalController extends Controller
{
    public function __construct(
        private RconClient $rcon,
        private PlayerPositionReader $positionReader,
        private PlayersDbReader $playersDb,
    ) {}

    public function __invoke(Request $request): Response
    {
        $user = $request->user();

        $whitelistEntry = WhitelistEntry::where('pz_username', $user->username)
            ->where('active', true)
            ->first();

        $isOnline = $this->checkPlayerOnline($user->username);

        // Get player position: live first, fallback to DB
        $playerPosition = $this->positionReader->getPlayerPosition($user->username);
        if ($playerPosition === null) {
            $dbPosition = $this->playersDb->getPlayerPosition($user->username);
            if ($dbPosition !== null) {
                $playerPosition = [
                    'username' => $dbPosition['username'],
                    'x' => $dbPosition['x'],
                    'y' => $dbPosition['y'],
                    'z' => $dbPosition['z'],
                    'is_dead' => $dbPosition['is_dead'],
                ];
            }
        }

        $mapConfig = [
            'tileUrl' => null,
            'tileSize' => config('zomboid.map.tile_size'),
            'minZoom' => config('zomboid.map.min_zoom'),
            'maxZoom' => config('zomboid.map.max_zoom'),
            'defaultZoom' => 5,
            'center' => $playerPosition
                ? ['x' => $playerPosition['x'], 'y' => $playerPosition['y']]
                : ['x' => config('zomboid.map.center_x'), 'y' => config('zomboid.map.center_y')],
        ];

        return Inertia::render('portal', [
            'pzAccount' => [
                'username' => $user->username,
                'whitelisted' => $whitelistEntry !== null,
                'isOnline' => $isOnline,
                'syncedAt' => $whitelistEntry?->synced_at?->toISOString(),
            ],
            'hasEmail' => $user->email !== null,
            'emailVerified' => $user->email_verified_at !== null,
            'playerPosition' => $playerPosition,
            'mapConfig' => $mapConfig,
        ]);
    }

    private function checkPlayerOnline(string $username): bool
    {
        try {
            $response = $this->rcon->command('players');

            // PZ returns "Players connected (N):\n-player1\n-player2\n..."
            return str_contains($response, "-{$username}\n") || str_ends_with($response, "-{$username}");
        } catch (\Exception $e) {
            Log::debug('RCON unavailable for online check', ['error' => $e->getMessage()]);

            return false;
        }
    }
}
