# Zomboid Manager

Web-based management panel for a Project Zomboid dedicated server. Control your server, manage players, mods, backups, and configuration — all from a browser.

## Requirements

- Docker and Docker Compose v2
- GNU Make
- `openssl` (for secret generation during setup)

## Quick Start

```bash
git clone <repo-url> && cd Zomboid
make up
```

That's it. On first run this will:

1. Generate `.env` with random passwords and keys
2. Build the Docker images
3. Start all services (game server, web app, database, redis)
4. Run database migrations automatically

Open **http://localhost** to access the web panel.

## First-Time Setup

After `make up` finishes, create your admin account:

```bash
make exec CMD="php artisan tinker --execute=\"App\Models\User::create(['name'=>'admin','email'=>'admin@example.com','password'=>bcrypt('your-password')])\""
```

Then log in at **http://localhost/login**.

## Configuration

Edit `.env` to customize your server before starting (or restart after changes):

| Variable | Default | Description |
|---|---|---|
| `PZ_SERVER_NAME` | ZomboidServer | Server name shown in server browser |
| `PZ_MAX_PLAYERS` | 16 | Maximum concurrent players |
| `PZ_MAP_NAMES` | Muldraugh, KY | Map name |
| `PZ_SERVER_PASSWORD` | *(empty)* | Password to join (empty = no password) |
| `PZ_PUBLIC_SERVER` | true | List in public server browser |
| `PZ_MAX_RAM` | 4096m | Java heap size for game server |
| `PZ_MOD_IDS` | *(empty)* | Semicolon-separated mod IDs |
| `PZ_WORKSHOP_IDS` | *(empty)* | Semicolon-separated Workshop item IDs |
| `APP_PORT` | 80 | Web panel port |
| `TZ` | Asia/Tbilisi | Server timezone |

After editing `.env`, apply changes:

```bash
make down && make up
```

## Commands

| Command | Description |
|---|---|
| `make up` | Start everything (builds + runs, generates `.env` on first run) |
| `make down` | Stop and remove all containers |
| `make restart` | Restart all containers |
| `make stop` | Stop containers without removing them |
| `make logs` | Follow logs from all containers |
| `make ps` | Show running containers |
| `make migrate` | Run database migrations manually |
| `make test` | Run the test suite |
| `make exec CMD="..."` | Run a command inside the app container |
| `make build` | Rebuild Docker images without starting |
| `make arch` | Show detected CPU architecture |

`make test` forces `APP_ENV=testing` and an isolated in-memory SQLite database, so tests cannot wipe the live PostgreSQL data.

If you run tests manually, use:

```bash
docker exec pz-app sh -lc 'cd /var/www/html && APP_ENV=testing APP_CONFIG_CACHE=/tmp/laravel-test-config.php DB_CONNECTION=sqlite DB_DATABASE=:memory: php artisan test'
```

## Architecture

Five Docker services:

```
┌─────────────────────────────────────────────────────────┐
│  zomboid-net (bridge)                                   │
│                                                         │
│  ┌──────────────┐    RCON     ┌──────────────────────┐  │
│  │ game-server   │◄──────────│ app (Laravel + Nginx) │  │
│  │ PZ Dedicated  │            │ Port 80              │  │
│  │ UDP 16261-2   │            └──────────┬───────────┘  │
│  └──────────────┘                       │              │
│                                          │              │
│                              ┌──────────┴───────────┐  │
│                              │ queue (worker)        │  │
│                              └──────────┬───────────┘  │
│                                          │              │
│              ┌───────────────────────────┘              │
│              │  backend-net (internal)                   │
│     ┌────────┴──┐    ┌───────┐                          │
│     │ PostgreSQL │    │ Redis │                          │
│     └───────────┘    └───────┘                          │
└─────────────────────────────────────────────────────────┘
```

- **game-server** — Project Zomboid dedicated server via SteamCMD. Auto-detects ARM64/AMD64.
- **app** — Laravel 12 + React web panel. Manages the game server via RCON and Docker API.
- **queue** — Background job worker (backups, scheduled restarts).
- **db** — PostgreSQL 16 for app data (users, backups, audit logs).
- **redis** — Cache, sessions, and job queue.

## Web Panel Features

**Public:**
- Server status page with live player count and uptime

**Admin (requires login):**
- Dashboard with server overview
- Player management (kick, ban, set access level, teleport, give items)
- Server configuration editor (server.ini + sandbox settings)
- Mod management (add/remove Steam Workshop mods)
- Backup management (create, restore, delete, scheduled backups)
- Whitelist management
- RCON console with command history
- Live server log viewer
- Server controls (start, stop, restart, save)
- Audit log of all admin actions

## Ports

| Port | Protocol | Service |
|---|---|---|
| 80 (configurable) | TCP | Web panel |
| 16261 | UDP | Game server |
| 16262 | UDP | Game server (direct connect) |

RCON (27015/tcp) is internal only — never exposed to the host.

## Resetting

To start fresh with new secrets:

```bash
make down
rm .env
make db-check || make db-init
make up
```

To wipe all data (database, game saves, backups), use the guarded command:

```bash
make nuke
```

Important safety behavior:

- `make up` now refuses to start if `pz-postgres` is missing (prevents silent empty DB recreation).
- Use `make db-init` only for first run (creates empty `pz-postgres` volume).
- Use `make db-reset` only when you intentionally want a brand-new empty database.
- Use `make db-restore` to restore from the newest SQL dump in `db-backups/`.

## API

The app exposes a REST API authenticated via `X-API-Key` header. The key is auto-generated in `.env` during `make init`. Key endpoints:

- `GET /api/server/status` — Server status (no auth required)
- `POST /api/server/start|stop|restart|save` — Server controls
- `GET /api/players` — Online players
- `GET /api/config/server` — Server configuration
- `GET /api/mods` — Installed mods
- `GET /api/backups` — Backup list
- `GET /api/whitelist` — Whitelist entries
- `GET /api/audit-logs` — Audit trail

## License

Private project.
