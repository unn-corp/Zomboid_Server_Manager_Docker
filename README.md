<div align="center">

<img src="app/public/favicon.svg" alt="Zomboid Manager" width="80" />

# Zomboid Manager

**Full-stack web panel for managing a Project Zomboid dedicated server.**

[![Laravel](https://img.shields.io/badge/Laravel-12-FF2D20?logo=laravel&logoColor=white)](https://laravel.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)

[Features](#features) · [Quick Start](#quick-start) · [Screenshots](#screenshots) · [API Reference](#rest-api-reference) · [Architecture](#architecture)

</div>

---

## Overview

Zomboid Manager wraps a Dockerized Project Zomboid dedicated server with a Laravel REST API and a React + Inertia.js web dashboard. It provides remote management through three integration points:

- **RCON** — Source RCON TCP protocol for real-time player commands, broadcasts, and saves
- **Docker Engine API** — Container lifecycle control (start, stop, restart, update) via the Docker socket
- **File I/O** — Direct read/write access to PZ config files (`server.ini`, sandbox Lua) mounted from the game server volume

20+ admin pages, a public status page, player portal, item shop, 30+ API endpoints, Discord notifications, an interactive player map, inventory management, safe zones, and more — all from a browser.

## Feature Status

| Area | Status | Notes |
|---|---|---|
| Docker Infrastructure | Done | Multi-arch (ARM64 + AMD64), auto-detection |
| RCON Integration | Done | Custom PHP Source RCON client |
| Server Control | Done | Start, stop, restart, save, wipe, update |
| Configuration Editor | Done | server.ini + sandbox Lua, categorized UI |
| Player Management | Done | Kick, ban, teleport, access levels, XP, god mode |
| Mod Management | Done | Steam Workshop integration, drag-and-drop reorder |
| Backup & Rollback | Done | Manual + scheduled, retention policies, queue-based |
| Whitelist | Done | CRUD + sync with PZ's SQLite `serverPZ.db` |
| Audit Logging | Done | Every admin action logged with user, IP, payload |
| Web Dashboard | Done | React 19 + Inertia.js v2 + shadcn/ui |
| Interactive Player Map | Done | Leaflet with live player markers |
| Inventory Management | Done | Browse, give, remove items with 1,100+ icons |
| Discord Webhooks | Done | 25+ configurable event notifications |
| Safe Zones | Done | PvP-free areas with violation tracking |
| Respawn Delay | Done | Configurable cooldown after death |
| Moderation & Events | Done | PvP violations, event log, player action history |
| RCON Console | Done | Browser-based console with command history |
| Server Logs | Done | Live log viewer with filtering |
| Authentication | Done | Fortify sessions, Sanctum tokens, API keys, 2FA |
| User Settings | Done | Profile, password, appearance, two-factor setup |
| Public Status Page | Done | Live server status, player count, uptime |
| Welcome Page | Done | Public landing with stats, podium, feature overview |
| Rankings | Done | Public leaderboard with 6 stat categories |
| Player Portal | Done | Player dashboard with account info and map position |
| Auto Restart | Done | Scheduled daily restarts with countdown warnings |
| Item Shop & Wallet | Done | Browse, purchase items/bundles, promo codes, wallet |
| Shop Admin (Items, Bundles, Promotions) | Done | Full CRUD for items, categories, bundles, promos |
| Purchase History & Wallets | Done | Admin views for purchases, delivery tracking, wallet management |
| In-Game Money Deposit | Done | Convert Base.Money/MoneyBundle to wallet coins via Lua bridge |
| Lua Bridge Mod | Done | Server-side enforcement for safe zones + respawn |

## Features

### Welcome Page

Public landing page with live server status, community stats (total players, zombie kills, hours survived, deaths), a top survivors podium, and a feature overview. No login required.

<details>
<summary>Screenshot</summary>

![Welcome](docs/screenshots/welcome.png)
</details>

### Server Control

Start, stop, restart, save, wipe, and update the game server from the dashboard. Scheduled actions dispatch countdown warnings to in-game players before executing. Server updates pull the latest build via SteamCMD. Wipe requires double confirmation and creates a pre-wipe backup automatically.

### Dashboard

Real-time server overview: online status, player count, game time, uptime, memory usage, game version, and a player leaderboard.

<details>
<summary>Screenshot</summary>

![Dashboard](docs/screenshots/dashboard.png)
</details>

### Player Management

Full player table with search and filtering. Per-player actions: kick, ban/unban, set access level (admin, moderator, overseer, GM, observer, none), teleport, give items, add XP, toggle god mode. View detailed player profiles with stats and inventory links.

<details>
<summary>Screenshot</summary>

![Players](docs/screenshots/players.png)
</details>

### Interactive Player Map

Leaflet-based map rendered from PZ map tiles. Live player markers with position tracking. Click a player to view details or take action. Supports zoom levels and coordinates display.

<details>
<summary>Screenshot</summary>

![Player Map](docs/screenshots/player-map.png)
</details>

### Inventory Management

Browse a player's inventory with visual item icons (1,100+ icons sourced from PZwiki). Give items to online players via RCON with delivery status tracking. Remove items through the Lua bridge. Search and filter the item database.

<details>
<summary>Screenshot</summary>

![Inventory](docs/screenshots/inventory.png)
</details>

### Configuration Editor

Edit `server.ini` and sandbox settings from the browser. Settings are organized into categories with descriptions, input validation, and type-appropriate controls (toggles, sliders, dropdowns). Changes require a server restart to take effect — the UI prompts for it.

<details>
<summary>Screenshot</summary>

![Config](docs/screenshots/config.png)
</details>

### Mod Management

Add mods by Steam Workshop ID. The system keeps `WorkshopItems=` and `Mods=` lines in sync (paired entries, semicolon-separated). Drag-and-drop load order reordering. Remove mods with a single click. Requires a restart to apply.

<details>
<summary>Screenshot</summary>

![Mods](docs/screenshots/mods.png)
</details>

### Backup & Rollback

Create manual backups or configure scheduled backups with per-type retention policies. Backups are created as queue jobs to avoid blocking the UI. Rollback to any previous backup with automatic pre-rollback snapshot. Backup types: manual, scheduled, pre-rollback, pre-update.

<details>
<summary>Screenshot</summary>

![Backups](docs/screenshots/backups.png)
</details>

### Whitelist Management

CRUD operations on the PZ whitelist stored in `serverPZ.db` (SQLite). Add, remove, and toggle player entries. Sync the whitelist from the game server's live database. Configure auto-whitelist behavior.

<details>
<summary>Screenshot</summary>

![Whitelist](docs/screenshots/whitelist.png)
</details>

### Safe Zones

Define PvP-free rectangular zones on the map with coordinates. The Lua bridge mod enforces zones server-side. Violations are tracked with attacker/victim details, zone info, strike count, and coordinates. Resolve violations by dismissing or taking action. Toggle the entire system on/off.

<details>
<summary>Screenshot</summary>

![Safe Zones](docs/screenshots/safe-zones.png)
</details>

### Moderation & Events

Centralized moderation view showing PvP violations, safe zone events, and player action history. Filter by player, zone, or event type. Escalating strike system for repeat offenders.

<details>
<summary>Screenshot</summary>

![Moderation](docs/screenshots/moderation.png)
</details>

### RCON Console

Browser-based RCON console with command history. Send any RCON command and see the response in real time. Autocomplete for common commands.

<details>
<summary>Screenshot</summary>

![RCON Console](docs/screenshots/rcon.png)
</details>

### Server Logs

Live server log viewer with auto-refresh. Filter logs by type and search within log content. View logs from the game server's output directly in the browser.

<details>
<summary>Screenshot</summary>

![Server Logs](docs/screenshots/logs.png)
</details>

### Audit Logging

Every admin action is recorded with: timestamp, user, action type, IP address, and full request payload. Browse, search, and filter the audit trail from the admin panel.

<details>
<summary>Screenshot</summary>

![Audit Log](docs/screenshots/audit.png)
</details>

### Discord Webhooks

25+ configurable Discord webhook notifications across server control, backup management, player actions, safe zone events, and respawn delay changes. Per-event toggle. Test webhook delivery from the settings page. Rich embeds with color-coded categories and emoji.

<details>
<summary>Screenshot</summary>

![Discord](docs/screenshots/discord.png)
</details>

### Item Shop

Browse and purchase in-game items and bundles with a virtual wallet. Categories, search, featured items, promotional codes with percentage/fixed discounts. Purchase history and wallet transaction log. Admin panel for managing items, categories, bundles, promotions, and player wallets.

<details>
<summary>Screenshot</summary>

![Shop](docs/screenshots/shop.png)
</details>

### Shop Admin — Items & Categories

Admin interface for managing shop items and categories. Set prices, quantities, stock limits, featured status, and assign categories. Full CRUD with inline editing.

<details>
<summary>Screenshot</summary>

![Shop Admin](docs/screenshots/shop-admin.png)
</details>

### Shop Bundles

Create and manage item bundles with percentage discounts. Each bundle contains multiple shop items with automatic price calculation showing savings.

<details>
<summary>Screenshot</summary>

![Bundles](docs/screenshots/bundles.png)
</details>

### Shop Promotions

Create discount codes and automatic promotions with percentage or fixed-amount discounts, usage limits, and expiration dates.

<details>
<summary>Screenshot</summary>

![Promotions](docs/screenshots/promotions.png)
</details>

### Shop Purchases

Admin view of all player purchases with delivery status tracking, revenue stats, and filtering. Shows item delivery details including partial deliveries and failures.

<details>
<summary>Screenshot</summary>

![Shop Purchases](docs/screenshots/shop-purchases.png)
</details>

### Wallet Management

Admin panel for managing player currency balances. View total circulation, per-player balances, earnings, and spending. Adjust balances manually when needed.

<details>
<summary>Screenshot</summary>

![Wallets](docs/screenshots/wallets.png)
</details>

### In-Game Money Deposit

Players deposit `Base.Money` (1 coin) and `Base.MoneyStack` (10 coins) looted from zombies into their web wallet. Click "Deposit" on the shop page, the Lua bridge removes money items from inventory within ~15 seconds, and the wallet is credited within 5 minutes.

<details>
<summary>Screenshot</summary>

![Money Deposit](docs/screenshots/shop-deposit-auth.png)
</details>

### Authentication & Security

- **Web auth** — Laravel Fortify with session-based login
- **Two-factor authentication** — TOTP with QR code setup, manual key entry, and recovery codes
- **API auth** — API key via `X-API-Key` header for programmatic access
- **Token auth** — Laravel Sanctum for token-based API access
- **Role-based access** — Admin middleware protects all management routes

### User Settings

Four settings pages: profile (name, email), password, two-factor authentication setup, and appearance (theme/dark mode).

### Public Status Page

Unauthenticated server status page showing: online/offline state, current player count, player list, server name, map, and uptime. Designed for sharing with the community.

<details>
<summary>Screenshot</summary>

![Status Page](docs/screenshots/status.png)
</details>

### Rankings

Public leaderboard with six tabs: zombie kills, hours survived, deaths, kills/death ratio, hours/death ratio, and PvP kills/death. Community stats summary at the top. No login required.

<details>
<summary>Screenshot</summary>

![Rankings](docs/screenshots/rankings.png)
</details>

### Player Portal

Authenticated player dashboard showing game account details (username, whitelist status, server status), profile settings links, and an interactive map with the player's last known position.

<details>
<summary>Screenshot</summary>

![Player Portal](docs/screenshots/portal.png)
</details>

### Auto Restart

Schedule daily restart times with timezone support, configurable in-game countdown warnings, Discord reminder notifications, and custom warning messages. Up to 5 daily restart slots.

<details>
<summary>Screenshot</summary>

![Auto Restart](docs/screenshots/auto-restart.png)
</details>

## Architecture

Five Docker services across two networks:

```
                        Internet
                           │
              ┌────────────┼────────────────────────────────────┐
              │            │                                    │
              │   UDP 16261-16262          TCP 8000              │
              │            │                  │                  │
              │   ┌────────▼────────┐  ┌──────▼──────────────┐  │
              │   │  game-server    │  │  app                │  │Renegade-Master
  zomboid-net │   │  PZ Dedicated   │◄─│  Laravel + Nginx    │  │
   (bridge)   │   │  SteamCMD       │  │  React dashboard    │  │
              │   │                 │  │  Docker socket      │  │
              │   │  RCON 27015 ◄───│──│  (container ctrl)   │  │
              │   └─────────────────┘  └──────┬──────────────┘  │
              │                               │                 │
              │                        ┌──────▼──────────────┐  │
              │                        │  queue              │  │
              │                        │  Backup jobs        │  │
              │                        │  Restart jobs       │  │
              │                        │  Scheduled tasks    │  │
              │                        └──────┬──────────────┘  │
              └───────────────────────────────┼─────────────────┘
                                              │
              ┌───────────────────────────────┼─────────────────┐
              │                               │                 │
  backend-net │   ┌──────────────┐     ┌──────▼──────┐          │
  (internal)  │   │  db           │     │  redis      │          │
              │   │  PostgreSQL 16│     │  Queue      │          │
              │   │  App data     │     │  Cache      │          │
              │   └──────────────┘     │  Sessions   │          │
              │                        └─────────────┘          │
              └─────────────────────────────────────────────────┘

Volumes: pz-data, pz-server-files, pz-backups, pz-lua-bridge, pz-map-tiles, pz-postgres, pz-redis
```

- **game-server** — PZ dedicated server via SteamCMD. Auto-detects ARM64/AMD64 and selects the correct image.
- **app** — Laravel 12 + React web panel. Mounts the Docker socket for container lifecycle control and PZ data volumes for config/save file access.
- **queue** — Background job worker for backups, scheduled restarts, server updates, and other long-running tasks.
- **db** — PostgreSQL 16. Users, backups, audit logs, PvP violations, settings.
- **redis** — Job queue, cache, sessions, rate limiting.

## Quick Start

### Requirements

- Docker and Docker Compose v2
- GNU Make
- `openssl` (for secret generation)

### Start

```bash
git clone <repo-url> && cd Zomboid_Server
make init
```

The interactive setup wizard will:

1. Ask for environment (production/dev), admin credentials, and server settings
2. Generate `.env` files with random secrets
3. Build Docker images and start all services
4. Run database migrations and create the admin account automatically

All prompts have sensible defaults — press Enter through everything for a working setup.

### Open the Panel

Navigate to the URL shown at the end of setup and log in with the displayed credentials.

## Configuration

### Game Server Settings

| Variable | Default | Description |
|---|---|---|
| `PZ_SERVER_NAME` | `ZomboidServer` | Server name in the browser |
| `PZ_MAX_PLAYERS` | `16` | Maximum concurrent players |
| `PZ_MAP_NAMES` | `Muldraugh, KY` | Map name |
| `PZ_SERVER_PASSWORD` | *(empty)* | Join password (empty = open) |
| `PZ_PUBLIC_SERVER` | `true` | List in public server browser |
| `PZ_MAX_RAM` | `4096m` | Java heap size |
| `PZ_MOD_IDS` | *(empty)* | Semicolon-separated mod IDs |
| `PZ_WORKSHOP_IDS` | *(empty)* | Semicolon-separated Workshop IDs |
| `PZ_PAUSE_ON_EMPTY` | `true` | Pause world when no players online |
| `PZ_AUTOSAVE_INTERVAL` | `15` | Minutes between autosaves |
| `PZ_STEAM_VAC` | `true` | Enable Steam VAC |
| `PZ_GC_CONFIG` | `ZGC` | Java garbage collector |

### Application Settings

| Variable | Default | Description |
|---|---|---|
| `APP_PORT` | `8000` | Web panel port |
| `APP_URL` | `http://localhost:8000` | Public URL |
| `APP_ENV` | `production` | Environment |
| `APP_DEBUG` | `false` | Debug mode |
| `TZ` | `Asia/Tbilisi` | Timezone |
| `API_KEY` | *(auto-generated)* | API authentication key |

### Backup Retention

| Variable | Default | Description |
|---|---|---|
| `BACKUP_RETENTION_MANUAL` | `10` | Manual backups to keep |
| `BACKUP_RETENTION_SCHEDULED` | `24` | Scheduled backups to keep |
| `BACKUP_RETENTION_DAILY` | `7` | Daily backups to keep |
| `BACKUP_RETENTION_PRE_ROLLBACK` | `5` | Pre-rollback snapshots to keep |
| `BACKUP_RETENTION_PRE_UPDATE` | `3` | Pre-update snapshots to keep |

After editing `.env`, restart to apply:

```bash
make down && make up
```

## Screenshots

<details open>
<summary>Welcome Page</summary>

![Welcome](docs/screenshots/welcome.png)
</details>

<details open>
<summary>Dashboard</summary>

![Dashboard](docs/screenshots/dashboard.png)
</details>

<details open>
<summary>Players</summary>

![Players](docs/screenshots/players.png)
</details>

<details open>
<summary>Player Map</summary>

![Player Map](docs/screenshots/player-map.png)
</details>

<details open>
<summary>Inventory</summary>

![Inventory](docs/screenshots/inventory.png)
</details>

<details open>
<summary>Configuration</summary>

![Config](docs/screenshots/config.png)
</details>

<details open>
<summary>Mods</summary>

![Mods](docs/screenshots/mods.png)
</details>

<details open>
<summary>Backups</summary>

![Backups](docs/screenshots/backups.png)
</details>

<details open>
<summary>Auto Restart</summary>

![Auto Restart](docs/screenshots/auto-restart.png)
</details>

<details open>
<summary>Whitelist</summary>

![Whitelist](docs/screenshots/whitelist.png)
</details>

<details open>
<summary>Safe Zones</summary>

![Safe Zones](docs/screenshots/safe-zones.png)
</details>

<details open>
<summary>Moderation</summary>

![Moderation](docs/screenshots/moderation.png)
</details>

<details open>
<summary>Discord Webhooks</summary>

![Discord](docs/screenshots/discord.png)
</details>

<details open>
<summary>RCON Console</summary>

![RCON Console](docs/screenshots/rcon.png)
</details>

<details open>
<summary>Audit Log</summary>

![Audit Log](docs/screenshots/audit.png)
</details>

<details open>
<summary>Server Logs</summary>

![Server Logs](docs/screenshots/logs.png)
</details>

<details open>
<summary>Item Shop</summary>

![Shop](docs/screenshots/shop.png)
</details>

<details open>
<summary>Shop Admin</summary>

![Shop Admin](docs/screenshots/shop-admin.png)
</details>

<details open>
<summary>Shop Bundles</summary>

![Bundles](docs/screenshots/bundles.png)
</details>

<details open>
<summary>Shop Promotions</summary>

![Promotions](docs/screenshots/promotions.png)
</details>

<details open>
<summary>Shop Purchases</summary>

![Shop Purchases](docs/screenshots/shop-purchases.png)
</details>

<details open>
<summary>Wallet Management</summary>

![Wallets](docs/screenshots/wallets.png)
</details>

<details open>
<summary>In-Game Money Deposit</summary>

![Money Deposit](docs/screenshots/shop-deposit-auth.png)
</details>

<details open>
<summary>Public Status Page</summary>

![Status Page](docs/screenshots/status.png)
</details>

<details open>
<summary>Rankings</summary>

![Rankings](docs/screenshots/rankings.png)
</details>

<details open>
<summary>Player Portal</summary>

![Player Portal](docs/screenshots/portal.png)
</details>

## REST API Reference

Authenticated via `X-API-Key` header. The key is auto-generated in `.env` during first run.

### Server

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/server/status` | No | Server status and player count |
| `GET` | `/api/server/version` | Yes | Game version info |
| `GET` | `/api/server/logs` | Yes | Server log output |
| `POST` | `/api/server/start` | Yes | Start the game server |
| `POST` | `/api/server/stop` | Yes | Stop the game server |
| `POST` | `/api/server/restart` | Yes | Restart the game server |
| `POST` | `/api/server/save` | Yes | Force a world save |
| `POST` | `/api/server/broadcast` | Yes | Broadcast message to all players |
| `POST` | `/api/server/update` | Yes | Update game server via SteamCMD |

### Players

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/players` | Yes | List all players |
| `GET` | `/api/players/{name}` | Yes | Player details |
| `POST` | `/api/players/{name}/kick` | Yes | Kick player |
| `POST` | `/api/players/{name}/ban` | Yes | Ban player |
| `DELETE` | `/api/players/{name}/ban` | Yes | Unban player |
| `POST` | `/api/players/{name}/setaccess` | Yes | Set access level |
| `POST` | `/api/players/{name}/teleport` | Yes | Teleport player |
| `POST` | `/api/players/{name}/additem` | Yes | Give item to player |
| `POST` | `/api/players/{name}/addxp` | Yes | Add XP to player |
| `POST` | `/api/players/{name}/godmode` | Yes | Toggle god mode |

### Configuration

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/config/server` | Yes | Read server.ini settings |
| `PATCH` | `/api/config/server` | Yes | Update server.ini settings |
| `GET` | `/api/config/sandbox` | Yes | Read sandbox settings |
| `PATCH` | `/api/config/sandbox` | Yes | Update sandbox settings |

### Mods

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/config/mods` | Yes | List installed mods |
| `POST` | `/api/config/mods` | Yes | Add a mod |
| `DELETE` | `/api/config/mods/{workshopId}` | Yes | Remove a mod |
| `PUT` | `/api/config/mods/order` | Yes | Reorder mod load order |

### Backups

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/backups` | Yes | List backups |
| `POST` | `/api/backups` | Yes | Create a backup |
| `DELETE` | `/api/backups/{backup}` | Yes | Delete a backup |
| `POST` | `/api/backups/{backup}/rollback` | Yes | Rollback to a backup |
| `GET` | `/api/backups/schedule` | Yes | Get backup schedule |
| `PUT` | `/api/backups/schedule` | Yes | Update backup schedule |

### Whitelist

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/whitelist` | Yes | List whitelist entries |
| `POST` | `/api/whitelist` | Yes | Add player to whitelist |
| `DELETE` | `/api/whitelist/{username}` | Yes | Remove from whitelist |
| `GET` | `/api/whitelist/{username}/status` | Yes | Check whitelist status |
| `POST` | `/api/whitelist/sync` | Yes | Sync with game server |

### Other

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/audit` | Yes | Audit log entries |
| `GET` | `/api/health` | No | App health check |

## Commands

### Core

| Command | Description |
|---|---|
| `make init` | Interactive first-run setup wizard (env, admin, start services) |
| `make up` | Start everything (builds + runs) |
| `make down` | Stop and remove all containers |
| `make restart` | Restart all containers |
| `make stop` | Stop containers without removing them |
| `make logs` | Follow logs from all containers |
| `make ps` | Show running containers |
| `make build` | Rebuild Docker images without starting |
| `make arch` | Show detected CPU architecture |

### Database

| Command | Description |
|---|---|
| `make migrate` | Run database migrations (auto-backs up first) |
| `make db-init` | Create the Postgres volume (first run only) |
| `make db-backup` | Dump Postgres to `db-backups/` |
| `make db-restore` | Restore from the latest dump in `db-backups/` |

### Development

| Command | Description |
|---|---|
| `make test` | Run the test suite (isolated SQLite, safe for production) |
| `make exec CMD="..."` | Run a command inside the app container |

### Danger Zone

| Command | Description |
|---|---|
| `make db-reset` | Delete and recreate the Postgres volume (requires `RESET_DB` confirmation) |
| `make nuke` | Destroy ALL data — database, game saves, backups (requires `NUKE_ALL` confirmation) |

`make test` forces `APP_ENV=testing` with an in-memory SQLite database, so tests never touch production data.

## Project Structure

```
Zomboid_Server/
├── app/                          # Laravel application
│   ├── app/
│   │   ├── Console/Commands/     # Artisan commands (ProcessRespawnKicks, etc.)
│   │   ├── Http/Controllers/
│   │   │   ├── Admin/            # Web dashboard controllers (13 controllers)
│   │   │   ├── Api/              # REST API controllers
│   │   │   └── Settings/         # User settings controllers
│   │   ├── Jobs/                 # Queue jobs (backups, restarts, server updates)
│   │   ├── Models/               # Eloquent models
│   │   └── Services/             # Core services
│   │       ├── RconClient.php        # Source RCON TCP client
│   │       ├── DockerManager.php     # Docker Engine API client
│   │       ├── ServerIniParser.php   # server.ini read/write
│   │       ├── SandboxLuaParser.php  # Sandbox Lua read/write
│   │       ├── SafeZoneManager.php   # Safe zone CRUD + violations
│   │       ├── RespawnDelayManager.php
│   │       ├── DiscordWebhookService.php
│   │       └── AuditLogger.php
│   ├── resources/js/
│   │   ├── pages/                # React + Inertia pages (29 total)
│   │   │   ├── admin/            # 13 admin pages
│   │   │   ├── auth/             # 7 auth pages
│   │   │   ├── settings/         # 4 settings pages
│   │   │   ├── dashboard.tsx
│   │   │   ├── status.tsx
│   │   │   └── portal.tsx
│   │   ├── components/           # Reusable UI components (shadcn/ui)
│   │   └── lib/                  # Utilities (fetchAction, etc.)
│   ├── routes/
│   │   ├── api.php               # REST API routes
│   │   ├── web.php               # Web routes
│   │   └── settings.php          # Settings routes
│   └── tests/                    # Pest PHP tests
├── game-server/
│   └── mods/ZomboidManager/      # Lua bridge mod (safe zones, respawn delay)
├── docker-compose.yml            # Base Docker config
├── docker-compose.arm64.yml      # ARM64 game server override
├── docker-compose.amd64.yml      # AMD64 game server override
├── Makefile                      # All CLI commands
├── .env.example                  # Configuration template
└── docs/screenshots/             # Screenshot assets
```

## Ports

| Port | Protocol | Service | Exposure |
|---|---|---|---|
| `8000` | TCP | Web panel (Nginx) | Host — configurable via `APP_PORT` |
| `16261` | UDP | Game server | Host — Steam game traffic |
| `16262` | UDP | Game server (direct connect) | Host — Steam direct connect |
| `27015` | TCP | RCON | Internal only — never exposed |
| `5432` | TCP | PostgreSQL | Internal only |
| `6379` | TCP | Redis | Internal only |

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Laravel 12 (PHP 8.3) |
| Frontend | React 19, Inertia.js v2, TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| Database | PostgreSQL 16, Eloquent ORM |
| Queue / Cache | Redis 7, Laravel Queue |
| Game Server | SteamCMD, Project Zomboid Dedicated Server |
| RCON | Custom PHP Source RCON client (`ext-sockets`) |
| Container Orchestration | Docker Compose v2 (multi-arch) |
| Auth | Laravel Fortify, Sanctum, TOTP 2FA |
| Testing | Pest PHP 3 |
| Routing | Laravel Wayfinder (TypeScript route generation) |

## Resetting

**Regenerate secrets:**

```bash
make down
rm .env
make up
```

**Reset the database:**

```bash
make db-reset    # Requires typing RESET_DB
make up
```

**Nuke everything** (database, game saves, backups):

```bash
make nuke        # Requires typing NUKE_ALL
```

## Security Notes

- RCON port (27015/tcp) is never exposed to the host — only accessible on the internal Docker network between containers
- The `backend-net` network is marked `internal: true` — PostgreSQL and Redis are unreachable from outside Docker
- API endpoints require an `X-API-Key` header; the key is auto-generated with 48 characters of entropy
- All admin actions are recorded in the audit log with user, IP, and full request payload
- Two-factor authentication available via TOTP with recovery codes
- PZ passwords are hashed as `bcrypt(md5(password))` with a fixed salt — the app handles this separately from Laravel's auth system
- Destructive operations (wipe, nuke, db-reset) require explicit confirmation strings

---

<div align="center">

Built for the Georgian Project Zomboid community

</div>


---

## Acknowledgements

The game server containers powering this project are built and maintained by the community:

- **AMD64:** [Renegade-Master/zomboid-dedicated-server](https://github.com/Renegade-Master/zomboid-dedicated-server) by [@Renegade-Master](https://github.com/Renegade-Master)
- **ARM64:** [joyfui/project-zomboid-server-docker-arm64](https://github.com/joyfui/project-zomboid-server-docker-arm64) by [@joyfui](https://github.com/joyfui)
