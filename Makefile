SHELL := /bin/bash

.PHONY: help install validate test lint up down logs clean production-canary manifest release-status

help:
	@echo "AI Training Academy commands"
	@echo "  make install           Install local dependencies"
	@echo "  make validate          Validate config and syntax"
	@echo "  make test              Run backend and frontend tests"
	@echo "  make lint              Run Python compile, JS syntax, and frontend TypeScript build checks"
	@echo "  make up                Start Docker stack"
	@echo "  make down              Stop Docker stack"
	@echo "  make logs              Follow Docker logs"
	@echo "  make clean             Remove generated caches"
	@echo "  make production-canary Check the canonical identity registry against whatever this"
	@echo "                         process's DATABASE_URL points at (NOT_APPLICABLE if empty,"
	@echo "                         PASS/FAIL against real onboarded identities otherwise) — run"
	@echo "                         this inside the api container to check a live deployment"
	@echo "  make manifest          Regenerate manifest.json from the current file tree (.env excluded)"
	@echo "  make release-status    Regenerate RELEASE_STATUS.json (accepts the same flags as"
	@echo "                         generate_release_status.py — see that file's docstring)"

install:
	python -m pip install -r 07_PLATFORM/backend/requirements.txt
	cd 07_PLATFORM/frontend && npm install

validate:
	python 08_INFRASTRUCTURE/scripts/validate_env.py
	python -m compileall 07_PLATFORM/backend/app
	node --check 07_PLATFORM/frontend/src/lib/hybridRouter.js
	php -l 07_PLATFORM/php/health.php

test:
	cd 07_PLATFORM/backend && pytest -q
	cd 07_PLATFORM/frontend && npm run test

lint:
	python -m compileall 07_PLATFORM/backend/app
	node --check 07_PLATFORM/frontend/src/lib/hybridRouter.js
	cd 07_PLATFORM/frontend && npm run build
	php -l 07_PLATFORM/php/health.php

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

clean:
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	find . -type d -name .pytest_cache -prune -exec rm -rf {} +

production-canary:
	cd 07_PLATFORM/backend && python -m app.canary

manifest:
	python 08_INFRASTRUCTURE/scripts/generate_manifest.py

release-status:
	python 08_INFRASTRUCTURE/scripts/generate_release_status.py $(ARGS)
