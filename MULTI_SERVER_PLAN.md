# Plan: Multi-Server Support

## Context

Currently the app is hardcoded to a single game server — `RconClient` and `DockerManager` are both registered as singletons from env vars at boot time, all file paths derive from `PZ_SERVER_NAME`, and no database table has a `server_id` column. The goal is to support N PZ servers from one Laravel app + one Docker Compose stack in Dokploy, with a server switcher dropdown in the UI that recontextualizes the entire dashboard for the selected server.

---

## Architecture Decision: Session-Based Server Context

Rather than refactoring all 50+ routes to `/admin/servers/{server}/...`, we use a **session-stored current server** approach:

- A `servers` table stores each server's connection details
- A `SetCurrentServer` middleware reads `session('current_server_id')` and binds the correct `RconClient`/`DockerManager` for that request
- A `POST /admin/switch-server/{server}` endpoint sets the session
- Inertia shared data includes the server list + current server on every page
- The nav dropdown calls switch-server and reloads — entire UI recontextualizes with zero route changes

This means **no changes to the 22 controllers, no route restructuring, and no URL changes**. The only "breaking" work is the service provider and middleware.

---

## Docker Compose Changes

Add N `game-server-*` services to `docker-compose.yml`, each with unique:
- Container name: `pz-game-server-1`, `pz-game-server-2`, etc.
- UDP ports: 16261-16262, 16271-16272, etc.
- RCON port: 27015, 27025, etc.
- Named volumes: `pz-data-1`, `pz-server-files-1`, etc.
- Separate env vars per service block (no shared config — each service defines its own `PZ_SERVER_NAME`, `PZ_RCON_PASSWORD`, etc.)

The app service gains access to all game-server containers via the shared Docker socket it already mounts. No new wiring needed — `DockerManager` already calls the Docker Engine API directly.

---

## Database Changes

### New table: `servers`
```
id, name (display), slug, container_name, rcon_host, rcon_port, rcon_password,
data_path, server_name (PZ_SERVER_NAME), lua_bridge_path, is_default, created_at
```

### Add `server_id` FK to scoped tables (nullable for now, backfill to default server):
- `backups`
- `audit_logs`
- `whitelist_entries`
- `player_stats`
- `game_events`
- `pvp_violations`
- `auto_restart_settings`
- `scheduled_restart_times`
- `server_settings`

Shop tables (`wallets`, `purchases`, etc.) stay **unscoped** — they're tied to users, not servers.

---

## Service Layer Changes

### `app/Providers/AppServiceProvider.php`
Change both singletons to **`scoped`** (per-request) bindings:
```php
$this->app->scoped(RconClient::class, function ($app) {
    $server = $app->make(ServerContext::class)->current();
    return new RconClient(host: $server->rcon_host, port: $server->rcon_port, ...);
});

$this->app->scoped(DockerManager::class, function ($app) {
    $server = $app->make(ServerContext::class)->current();
    return new DockerManager(socketPath: ..., containerName: $server->container_name);
});
```

### New: `app/Services/ServerContext.php`
- Holds the currently-resolved `Server` model for the request
- Resolved by middleware before controllers run
- Also exposes path helpers: `->iniPath()`, `->sandboxLuaPath()`, `->luaBridgePath()`, etc. (replacing `config('zomboid.paths.*')` calls)

### `app/Http/Middleware/ResolveCurrentServer.php` (new)
- Reads `session('current_server_id')`, falls back to `Server::where('is_default', true)->first()`
- Binds `Server` into `ServerContext` singleton for that request
- Applied to all `auth` + `admin` middleware group routes

### `app/Http/Controllers/Admin/ServerSwitchController.php` (new)
- `POST /admin/switch-server/{server}` — sets `session('current_server_id')` + redirects back
- `GET /admin/switch-server` — returns server list (for API/JS use)

---

## Controller Changes (minimal)

Controllers that read `config('zomboid.paths.server_ini')` directly need to use `ServerContext` instead. This affects:
- `ModController`, `ConfigController`, `ModImportController`, `WhitelistController`

All controllers that inject `RconClient` or `DockerManager` require **zero changes** — the scoped binding resolves the correct instance automatically.

---

## Config Changes

`config/zomboid.php` paths stay as fallback defaults for the seeded "default" server. `ServerContext` overrides them at runtime.

---

## Inertia Shared Data

In `AppServiceProvider` or a dedicated `HandleInertiaRequests` middleware, add:
```php
'servers' => Server::select('id', 'name', 'slug')->get(),
'current_server' => $serverContext->current()->only('id', 'name', 'slug'),
```

---

## UI Changes

### Server switcher in nav
- Add a `<Select>` or `<DropdownMenu>` to the top navigation bar showing the current server name
- On change: POST to `/admin/switch-server/{server}` via `fetchAction`, then `router.reload()`
- No page-level changes needed anywhere — Inertia re-renders with new shared data

### Server management page: `/admin/servers`
- List all servers with status badges (online/offline), player count
- Add/edit/delete server config (container name, RCON creds, paths)
- "Set as default" button

---

## Files to Create
| File | Purpose |
|------|---------|
| `app/app/Services/ServerContext.php` | Holds current Server model, exposes path helpers |
| `app/app/Http/Middleware/ResolveCurrentServer.php` | Resolves server from session into ServerContext |
| `app/app/Http/Controllers/Admin/ServerSwitchController.php` | Switch + list endpoints |
| `app/app/Http/Controllers/Admin/ServerManagementController.php` | CRUD for server configs |
| `app/app/Models/Server.php` | Eloquent model |
| `app/database/migrations/*_create_servers_table.php` | servers table |
| `app/database/migrations/*_add_server_id_to_*.php` | FK migrations (one per table) |
| `app/resources/js/pages/admin/servers.tsx` | Server management UI page |

## Files to Modify
| File | Change |
|------|--------|
| `docker-compose.yml` | Add game-server-2, game-server-3... services with unique ports/volumes |
| `app/app/Providers/AppServiceProvider.php` | Change singletons → scoped, inject ServerContext |
| `app/app/Http/Middleware/HandleInertiaRequests.php` | Share servers + current_server |
| `app/bootstrap/app.php` | Register ResolveCurrentServer middleware |
| `app/routes/web.php` | Add switch-server + server management routes |
| `app/app/Http/Controllers/Admin/ModController.php` | Use ServerContext for ini path |
| `app/app/Http/Controllers/Admin/ConfigController.php` | Use ServerContext for ini path |
| `app/app/Http/Controllers/Admin/ModImportController.php` | Use ServerContext for ini path |
| `app/app/Http/Controllers/Admin/WhitelistController.php` | Use ServerContext for ini path |

---

## Implementation Order

1. `servers` table migration + `Server` model + seed default server from current env vars
2. `ServerContext` service
3. `ResolveCurrentServer` middleware + register it
4. Convert singletons → scoped in `AppServiceProvider`
5. Update 4 controllers that use `config('zomboid.paths.*')` directly
6. `ServerSwitchController` + routes
7. Inertia shared data (servers list + current)
8. Nav dropdown UI component
9. `docker-compose.yml` — add 2nd game-server service as example
10. `ServerManagementController` + `/admin/servers` UI page
11. Add `server_id` FK migrations + backfill to default server
12. Update queries in BackupManager, AuditLogger, WhitelistManager to scope by current server

---

## Verification

1. Boot with existing single-server env — default server seeded, everything works as before
2. Add a second server via `/admin/servers` UI
3. Switch to server 2 via dropdown — dashboard, mods, config all show server 2's data
4. Server 2's start/stop/RCON commands target server 2's container and RCON port
5. Backups and audit logs filtered per server
6. `make exec CMD="php artisan test --compact"` — all existing tests still pass
