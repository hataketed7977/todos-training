# Todos Training

A simple Todo Kanban training repository.

This repository contains three independent applications in one Git repository:

- `apps/web`: React web client
- `apps/cli`: Node.js command-line client
- `services/api`: Java 21 Spring Boot 3 API service built with Gradle

This is a monorepo, but it is not a pnpm workspace. Each application owns its
own dependencies, lockfile, build command, and release path.

## Quick Start

Start API and Web together:

```bash
./scripts/dev.sh
```

Run it in the background:

```bash
./scripts/dev.sh --detach
```

Start the API service:

```bash
cd services/api
./gradlew bootRun
```

Start the web client:

```bash
cd apps/web
pnpm install
pnpm dev
```

Use the CLI:

```bash
cd apps/cli
pnpm install
pnpm todo list
```

The web and CLI both call the API at `http://localhost:18080` by default.

## Local Database

The API uses H2 file storage by default. No external database is required for
local training.

The database files are created under:

```text
services/api/data/
```

## Project Shape

```text
apps/web  ----\
               ---> services/api ---> H2 database
apps/cli  ----/
```

There is no direct dependency between `apps/web` and `apps/cli`.

## Dev Script

The local launcher lives in `scripts/dev.sh`.

It starts:

- API: `http://localhost:18080`
- Web: `http://localhost:15173`

Logs and PID files are written to:

```text
/tmp/todos-training/
```
