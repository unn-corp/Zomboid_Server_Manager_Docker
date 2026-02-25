# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Project Zomboid managed dedicated server for the Georgian gaming community. Dockerized PZ game server with a Laravel REST API for remote management (RCON bridge, config editing, mod management, player admin). Web dashboard via React + Inertia.js + shadcn/ui in the same app. Free-to-play launch with monetization architecture built in for later stages.

## Tech Stack

- **Framework:** Laravel 12 (PHP 8.3)
- **Frontend:** React 19 + Inertia.js v2 + TypeScript + Tailwind CSS v4 + shadcn/ui
- **Database:** PostgreSQL 16, Eloquent ORM, Laravel migrations
- **RCON:** Custom PHP Source RCON client (TCP socket, `ext-sockets`)
- **Queue/Cache:** Redis, Laravel Queue, Laravel Scheduler
- **Docker Control:** Docker Engine API via HTTP to Unix socket
- **Auth:** Fortify (web), API key middleware (API), Sanctum (tokens)
- **Testing:** Pest PHP 3
- **Routing:** Wayfinder (TypeScript route generation)
- **Payments (Stage 4):** Laravel Cashier (Stripe)
- **Containers:** Docker Compose v2 with multi-arch support (ARM64 + AMD64)

## Commands

```bash
# Full stack (auto-detects ARM64/AMD64)
make up
make down
make logs
make ps

# Migrations
make migrate
make exec CMD="php artisan migrate:rollback"

# Tests
make test
make exec CMD="php artisan test --filter=UnitTest"
make exec CMD="php artisan test --group=rcon"

# Queue & Scheduler
make exec CMD="php artisan queue:work --tries=3"
make exec CMD="php artisan schedule:run"

# API docs
make exec CMD="php artisan scribe:generate"

# Cache
make exec CMD="php artisan config:clear"

# Check detected architecture
make arch
```

## Architecture

### Docker Compose — Multi-Arch Setup

The stack uses compose overrides for automatic architecture detection:
- `docker-compose.yml` — base config (app, db, redis, networks, volumes, game-server skeleton)
- `docker-compose.arm64.yml` — ARM64 game server (`ghcr.io/joyfui/project-zomboid-server-docker-arm64`) with custom entrypoint + `configure-server.sh`
- `docker-compose.amd64.yml` — AMD64 game server (`renegademaster/zomboid-dedicated-server`) with native env var mapping
- `Makefile` — detects `uname -m` and selects the correct override automatically

### Services

Four Docker services:

1. **game-server** — PZ dedicated server (SteamCMD). Ports 16261-16262/udp exposed to host. RCON on 27015/tcp internal only. Image varies by architecture.
2. **app** — Laravel (PHP-FPM + Nginx). Mounts Docker socket for container lifecycle control. Mounts PZ data volumes for config/save file access. Connects to game server via RCON over internal Docker network.
3. **db** — PostgreSQL. Internal only.
4. **redis** — Queue driver, cache, rate limiting. Internal only.

### Integration Points

The Laravel app is the single control plane wrapping three integration points:
- **RCON** (`Services/RconClient.php`) — Source RCON TCP protocol. Player commands, broadcasts, saves. Singleton in service container.
- **Docker Engine API** (`Services/DockerManager.php`) — HTTP calls to `/var/run/docker.sock`. Start/stop/restart game server container.
- **File I/O** (`Services/ServerIniParser.php`, `Services/SandboxLuaParser.php`) — Read/write PZ config files mounted from game server volume.

## Key Design Constraints

- API must never crash when the game server is offline — return status, not 500s
- RCON port never exposed publicly, only on internal Docker network
- PZ uses **semicolons** (not commas) as list separators in server.ini (`Mods=`, `WorkshopItems=`, `Map=`)
- Config parsers must pass round-trip tests: read → write → read = identical output
- Every admin API action writes to the `audit_logs` table via `AuditLogger` service
- Mod management must keep `WorkshopItems=` and `Mods=` lines in sync (paired entries, semicolon-separated)
- PZ whitelist lives in a SQLite file (`serverPZ.db`), not PostgreSQL — API reads/writes it directly via separate DB connection
- Auth: API key in `X-API-Key` header for API endpoints. Fortify session auth for web dashboard. Sanctum for API tokens.

## Implementation Phases

Detailed plan with acceptance criteria in `IMPLEMENTATION_PLAN.md`. Status tracked in the table at the bottom of that file.

**Stage 1 (MVP) — Phases 1–8:** Docker infra, Laravel + RCON, audit DB, server/config/player/mod API endpoints, Pest tests
**Stage 2 — Phases 9–12:** Backup/rollback (Laravel Queue + Scheduler), whitelist CRUD, schema expansion
**Stage 3+ — Phases 13+:** React/Inertia web dashboard, Cashier subscriptions, item shop
