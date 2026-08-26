# Todos Training

Workshop Demo for a small Todo Kanban system.

This repository contains three independent applications in one Git repository:

- `apps/web`: React + Vite + Semi Design web client
- `apps/cli`: Node.js command-line client
- `services/api`: Java 21 + Spring Boot 3 API service

This is a monorepo, but it is not a pnpm workspace. Each application owns its
own dependencies, lockfile, build command, and release path.

## Prerequisites

- Java 21+
- Node.js 20+
- pnpm

## Quick Start

Start the API and Web together:

```bash
./scripts/dev.sh
```

Open:

- Web: `http://localhost:15173`
- API: `http://localhost:18080`

Run the launcher in the background:

```bash
./scripts/dev.sh --detach
```

Logs and PID files are written to `/tmp/todos-training/`.

## Run Separately

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
pnpm build
pnpm exec todos-cli list
pnpm exec todos-cli add "Prepare training"
```

Install the published CLI globally:

```bash
npm install --global todos-training-cli
todos-cli --help
```

For a local checkout, install the current CLI globally with one command:

```bash
cd apps/cli
pnpm build:install
```

Publish a new version to the public npm registry:

```bash
cd apps/cli
npm login
pnpm pack
pnpm publish
```

The web and CLI both call the API at `http://localhost:18080` by default.

## Local Database

The API uses H2 file storage by default. No external database is required for
local training.

Database files are created under:

```text
services/api/data/
```

## Validation

Run focused checks from the project that changed:

```bash
cd apps/web
pnpm build
```

```bash
cd apps/cli
pnpm build
```

```bash
cd services/api
./gradlew test
```

## Project Shape

```text
apps/web  ----\
               ---> services/api ---> H2 database
apps/cli  ----/
```

There is no direct dependency between `apps/web` and `apps/cli`.

## Agent and Architecture Notes

See `AGENTS.md` for repository boundaries, product contracts, API contracts,
implementation rules, and validation guidance for coding agents.
