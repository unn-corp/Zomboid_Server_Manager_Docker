<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Services\ModManager;
use App\Services\SteamWorkshopService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ModImportController extends Controller
{
    public function __construct(
        private readonly SteamWorkshopService $steam,
        private readonly ModManager $modManager,
        private readonly AuditLogger $auditLogger,
    ) {}

    /**
     * Look up a Steam Workshop URL or bare ID.
     *
     * Returns the item list (with detected mod IDs) and whether it was a collection.
     *
     * @return JsonResponse<array{items: array<int, array{workshop_id: string, title: string, detected_mod_id: string|null}>, is_collection: bool}>
     */
    public function lookup(Request $request): JsonResponse
    {
        $request->validate([
            'url' => ['required', 'string', 'max:500'],
        ]);

        $parsed = $this->steam->parseWorkshopUrl($request->string('url'));

        if ($parsed === null) {
            return response()->json(['error' => 'Could not parse a Steam Workshop ID from the provided input.'], 422);
        }

        $result = $this->steam->fetchCollection($parsed['id']);

        return response()->json($result);
    }

    /**
     * Apply a list of workshop mods to the server INI.
     *
     * @return JsonResponse<array{added: int, skipped: int, restart_required: bool}>
     */
    public function apply(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'mods' => ['required', 'array', 'min:1'],
            'mods.*.workshop_id' => ['required', 'string', 'max:20'],
            'mods.*.mod_id' => ['required', 'string', 'max:255', 'regex:/^[^;]+$/'],
            'mods.*.map_folder' => ['sometimes', 'nullable', 'string', 'max:255'],
            'replace_existing' => ['boolean'],
        ]);

        $iniPath = config('zomboid.paths.server_ini');
        $replaceExisting = $validated['replace_existing'] ?? false;

        if ($replaceExisting) {
            // Wipe existing mod lists before adding
            $this->modManager->replaceAll($iniPath, []);
        }

        $added = 0;
        $skipped = 0;

        foreach ($validated['mods'] as $mod) {
            $before = count($this->modManager->list($iniPath));
            $this->modManager->add($iniPath, $mod['workshop_id'], $mod['mod_id'], $mod['map_folder'] ?? null);
            $after = count($this->modManager->list($iniPath));

            if ($after > $before) {
                $added++;
            } else {
                $skipped++;
            }
        }

        $this->auditLogger->log(
            actor: $request->user()->name ?? 'admin',
            action: 'mod.import',
            details: ['added' => $added, 'skipped' => $skipped, 'replace_existing' => $replaceExisting],
            ip: $request->ip(),
        );

        return response()->json([
            'added' => $added,
            'skipped' => $skipped,
            'restart_required' => true,
        ]);
    }
}
