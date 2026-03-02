<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Http;

class DownloadItemIcons extends Command
{
    /** @var string */
    protected $signature = 'zomboid:download-item-icons
        {--force : Re-download icons that already exist}
        {--catalog= : Path to items_catalog.json (default: from config)}
        {--concurrency=10 : Number of concurrent downloads per batch}';

    /** @var string */
    protected $description = 'Download PZ item icons from PZwiki into public/images/items/';

    private const PZWIKI_URL = 'https://pzwiki.net/wiki/Special:FilePath/';

    public function handle(): int
    {
        $catalogPath = $this->option('catalog') ?: config('zomboid.lua_bridge.items_catalog');
        $outputDir = public_path('images/items');
        $force = (bool) $this->option('force');
        $concurrency = max(1, (int) $this->option('concurrency'));

        if (! file_exists($catalogPath)) {
            $this->error("Item catalog not found at: {$catalogPath}");
            $this->info('The Lua mod exports this file on server startup. Start the game server first.');

            return self::FAILURE;
        }

        $catalog = json_decode(file_get_contents($catalogPath), true);
        if (json_last_error() !== JSON_ERROR_NONE || ! isset($catalog['items'])) {
            $this->error('Failed to parse item catalog JSON.');

            return self::FAILURE;
        }

        if (! is_dir($outputDir)) {
            mkdir($outputDir, 0755, true);
        }

        // Filter items that need downloading
        $toDownload = [];
        $skipped = 0;

        foreach ($catalog['items'] as $item) {
            $iconName = $item['icon_name'] ?? '';
            if ($iconName === '') {
                $skipped++;

                continue;
            }

            $outputPath = $outputDir.'/'.$iconName.'.png';
            if (! $force && file_exists($outputPath)) {
                $skipped++;

                continue;
            }

            $toDownload[] = $iconName;
        }

        $total = count($catalog['items']);
        $downloadCount = count($toDownload);

        if ($downloadCount === 0) {
            $this->info("All {$total} icons already exist. Use --force to re-download.");

            return self::SUCCESS;
        }

        $this->info("Downloading {$downloadCount} icons ({$skipped} skipped, concurrency: {$concurrency})...");
        $bar = $this->output->createProgressBar($downloadCount);
        $bar->start();

        $downloaded = 0;
        $failed = 0;
        $maxRetries = 3;

        // Process in batches
        $chunks = array_chunk($toDownload, $concurrency);
        $chunkIndex = 0;

        while ($chunkIndex < count($chunks)) {
            $batch = $chunks[$chunkIndex];

            $responses = Http::pool(function (Pool $pool) use ($batch) {
                foreach ($batch as $iconName) {
                    // PZwiki uses raw item name (e.g. "Axe.png"), not "Item_Axe.png"
                    $wikiName = preg_replace('/^Item_/', '', $iconName);
                    $url = self::PZWIKI_URL.$wikiName.'.png';

                    $pool->as($iconName)
                        ->timeout(15)
                        ->withOptions(['allow_redirects' => true])
                        ->get($url);
                }
            });

            $rateLimited = false;
            $retryAfter = 0;

            foreach ($batch as $iconName) {
                $response = $responses[$iconName];

                try {
                    if ($response->status() === 429) {
                        $rateLimited = true;
                        $retryAfter = max($retryAfter, (int) ($response->header('Retry-After') ?: 30));

                        continue;
                    }

                    if ($response->successful() && str_starts_with($response->header('Content-Type') ?? '', 'image/')) {
                        $outputPath = $outputDir.'/'.$iconName.'.png';
                        if (file_put_contents($outputPath, $response->body()) !== false) {
                            $downloaded++;
                        } else {
                            $failed++;
                        }
                    } else {
                        $failed++;
                    }
                } catch (\Throwable $e) {
                    $failed++;
                }

                $bar->advance();
            }

            if ($rateLimited) {
                $waitSeconds = max($retryAfter, 10);
                $bar->clear();
                $this->warn("  Rate limited — waiting {$waitSeconds}s before retrying batch...");
                $bar->display();
                sleep($waitSeconds);

                // Retry the same batch (don't advance $chunkIndex)
                continue;
            }

            $chunkIndex++;
        }

        $bar->finish();
        $this->newLine(2);

        $this->info("Downloaded: {$downloaded}");
        $this->info("Skipped (existing): {$skipped}");
        if ($failed > 0) {
            $this->warn("Failed: {$failed}");
        }

        return self::SUCCESS;
    }
}
