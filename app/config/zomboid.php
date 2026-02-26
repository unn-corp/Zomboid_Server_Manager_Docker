<?php

return [
    /*
    |--------------------------------------------------------------------------
    | RCON Configuration
    |--------------------------------------------------------------------------
    */
    'rcon' => [
        'host' => env('PZ_RCON_HOST', 'game-server'),
        'port' => (int) env('PZ_RCON_PORT', 27015),
        'password' => env('PZ_RCON_PASSWORD', ''),
        'timeout' => (int) env('PZ_RCON_TIMEOUT', 5),
    ],

    /*
    |--------------------------------------------------------------------------
    | Docker Engine API
    |--------------------------------------------------------------------------
    */
    'docker' => [
        'socket' => env('DOCKER_SOCKET', '/var/run/docker.sock'),
        'container_name' => env('GAME_SERVER_CONTAINER_NAME', 'pz-game-server'),
    ],

    /*
    |--------------------------------------------------------------------------
    | PZ Server Paths (inside app container)
    |--------------------------------------------------------------------------
    */
    'paths' => [
        'data' => env('PZ_DATA_PATH', '/pz-data'),
        'server_ini' => env('PZ_DATA_PATH', '/pz-data').'/Server/'.env('PZ_SERVER_NAME', 'ZomboidServer').'.ini',
        'sandbox_lua' => env('PZ_DATA_PATH', '/pz-data').'/Server/'.env('PZ_SERVER_NAME', 'ZomboidServer').'_SandboxVars.lua',
        'db' => env('PZ_DATA_PATH', '/pz-data').'/db/serverPZ.db',
    ],

    /*
    |--------------------------------------------------------------------------
    | Server Identity
    |--------------------------------------------------------------------------
    */
    'server_name' => env('PZ_SERVER_NAME', 'ZomboidServer'),

    /*
    |--------------------------------------------------------------------------
    | Backup Configuration
    |--------------------------------------------------------------------------
    */
    'backups' => [
        'path' => env('BACKUP_PATH', '/backups'),
        'retention' => [
            'manual' => (int) env('BACKUP_RETENTION_MANUAL', 10),
            'scheduled' => (int) env('BACKUP_RETENTION_SCHEDULED', 24),
            'daily' => (int) env('BACKUP_RETENTION_DAILY', 7),
            'pre_rollback' => (int) env('BACKUP_RETENTION_PRE_ROLLBACK', 5),
            'pre_update' => (int) env('BACKUP_RETENTION_PRE_UPDATE', 3),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Lua Bridge — File-based communication with PZ Lua mod
    |--------------------------------------------------------------------------
    */
    'lua_bridge' => [
        'path' => env('LUA_BRIDGE_PATH', '/lua-bridge'),
        'inventory_dir' => env('LUA_BRIDGE_PATH', '/lua-bridge').'/inventory',
        'delivery_queue' => env('LUA_BRIDGE_PATH', '/lua-bridge').'/delivery_queue.json',
        'delivery_results' => env('LUA_BRIDGE_PATH', '/lua-bridge').'/delivery_results.json',
        'players_live' => env('LUA_BRIDGE_PATH', '/lua-bridge').'/players_live.json',
    ],

    /*
    |--------------------------------------------------------------------------
    | API Authentication
    |--------------------------------------------------------------------------
    */
    'api_key' => env('API_KEY', ''),
];
