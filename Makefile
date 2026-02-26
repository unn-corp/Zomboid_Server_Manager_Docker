ARCH := $(shell uname -m)
ifeq ($(ARCH),aarch64)
    ARCH_FILE := docker-compose.arm64.yml
else
    ARCH_FILE := docker-compose.amd64.yml
endif

COMPOSE := docker compose -f docker-compose.yml -f $(ARCH_FILE)

.PHONY: up down build restart logs ps stop pull migrate test exec arch init db-check db-init db-reset db-backup db-restore nuke

# ── First-run setup ──────────────────────────────────────────────────
# Generates .env with random secrets from .env.example template
init:
	@if [ -f .env ]; then \
		echo ".env already exists — skipping init (delete .env to regenerate)"; \
	else \
		echo "Generating .env with random secrets..."; \
		DB_PASS=$$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 24); \
		RCON_PASS=$$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 16); \
		ADMIN_PASS=$$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 16); \
		API_SECRET=$$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 48); \
		APP_SECRET=$$(openssl rand -base64 32); \
		sed \
			-e "s|^DB_PASSWORD=.*|DB_PASSWORD=$$DB_PASS|" \
			-e "s|^PZ_RCON_PASSWORD=.*|PZ_RCON_PASSWORD=$$RCON_PASS|" \
			-e "s|^PZ_ADMIN_PASSWORD=.*|PZ_ADMIN_PASSWORD=$$ADMIN_PASS|" \
			-e "s|^API_KEY=.*|API_KEY=$$API_SECRET|" \
			-e "s|^APP_KEY=.*|APP_KEY=base64:$$APP_SECRET|" \
			.env.example > .env; \
		echo ""; \
		echo "  .env created with generated secrets"; \
		echo "  Edit .env to customize server settings before starting"; \
		echo ""; \
	fi

db-check:
	@docker volume inspect pz-postgres >/dev/null 2>&1 || \
		(echo ""; \
		echo "ERROR: Missing Docker volume 'pz-postgres'."; \
		echo "Refusing to start to avoid silently creating an empty database."; \
		echo ""; \
		echo "If this is your first run: make db-init"; \
		echo "If data was lost and you have backups: make db-restore"; \
		echo ""; \
		exit 1)

db-init:
	@docker volume inspect pz-postgres >/dev/null 2>&1 && \
		(echo "Volume pz-postgres already exists — keeping existing data."; exit 0) || true
	@echo "Creating Postgres volume pz-postgres (empty database)."
	@docker volume create pz-postgres >/dev/null
	@echo "Volume created. Run 'make up' to start services."

db-reset:
	@echo "WARNING: This will PERMANENTLY delete Postgres data volume pz-postgres."
	@echo "Type RESET_DB and press Enter to continue:"
	@read confirm; \
	if [ "$$confirm" != "RESET_DB" ]; then \
		echo "Cancelled."; \
		exit 1; \
	fi
	@$(COMPOSE) down
	@docker volume rm pz-postgres 2>/dev/null || true
	@docker volume create pz-postgres >/dev/null
	@echo "Postgres volume recreated. Run 'make up' to start with an empty DB."

# ── Core commands ────────────────────────────────────────────────────
up: init db-check
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

nuke:
	@echo "WARNING: This will destroy ALL data (database, game saves, backups)."
	@echo "Type NUKE_ALL and press Enter to continue:"
	@read confirm; \
	if [ "$$confirm" != "NUKE_ALL" ]; then \
		echo "Cancelled."; \
		exit 1; \
	fi
	$(COMPOSE) down -v
	@docker volume rm pz-postgres 2>/dev/null || true

build:
	$(COMPOSE) build

restart:
	$(COMPOSE) restart

stop:
	$(COMPOSE) stop

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

pull:
	$(COMPOSE) pull

# ── App commands ─────────────────────────────────────────────────────
migrate: db-backup
	$(COMPOSE) exec app php artisan migrate --force

test:
	$(COMPOSE) exec app php artisan test --parallel

exec:
	$(COMPOSE) exec app $(CMD)

arch:
	@echo "Detected: $(ARCH) -> $(ARCH_FILE)"

# ── Database ─────────────────────────────────────────────────────────
db-backup:
	@mkdir -p db-backups
	@echo "Backing up database..."
	@docker exec pz-db pg_dump -U zomboid -d zomboid --no-owner \
		> db-backups/backup-$$(date +%Y%m%d-%H%M%S).sql 2>/dev/null \
		&& echo "Backup saved to db-backups/" \
		|| echo "No database to backup (first run?)"

db-restore:
	@LATEST=$$(ls -t db-backups/*.sql 2>/dev/null | head -1); \
	if [ -z "$$LATEST" ]; then \
		echo "No backups found in db-backups/"; \
	else \
		echo "Restoring from $$LATEST ..."; \
		docker exec -i pz-db psql -U zomboid -d zomboid < "$$LATEST"; \
		echo "Restored."; \
	fi
