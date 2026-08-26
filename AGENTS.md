# Todos Training Agents Guide

## Repository Role

This repository is a training monorepo for a simple Todo Kanban system.

It is intentionally small:

- No pnpm workspace
- No shared package
- No root build system; `scripts/dev.sh` is only a local launcher
- No Docker in the first version
- No external database in the first version
- No authentication in the first version

`README.md` is for quick human onboarding. This file is the LLM Wiki entrypoint:
it describes the repository map, ownership boundaries, local commands, API
contract, and implementation rules.

## System Map

```text
apps/web  ----\
               ---> services/api ---> H2 database
apps/cli  ----/
```

`apps/web` and `apps/cli` are both API clients. They do not depend on each
other. `services/api` owns persistence and business rules.

## Project Boundaries

## Local Launcher

`scripts/dev.sh` is a convenience script for local development. It is not a build
system and does not change the ownership boundaries between projects.

Local commands:

```bash
./scripts/dev.sh
./scripts/dev.sh --detach
./scripts/dev.sh --build
./scripts/dev.sh --help
```

Default behavior:

- Checks Java 21+, Node.js 20+, pnpm, curl, and lsof.
- Starts `services/api` on `http://localhost:18080`.
- Starts `apps/web` on `http://localhost:15173`.
- Writes logs and PID files under `/tmp/todos-training/`.
- Stops only services started by the script when foreground mode receives Ctrl+C.
- Does not run or host the CLI as a long-running service.

### apps/web

Purpose: Browser-based Todo Kanban UI.

Technology:

- React
- Vite
- TypeScript
- pnpm

Allowed:

- Call `services/api` through HTTP.
- Own browser UI state and presentation.

Not allowed:

- Import code from `apps/cli`.
- Read or write the database directly.
- Introduce a shared package without an explicit architecture change.

Local commands:

```bash
cd apps/web
pnpm install
pnpm dev
pnpm build
```

Configuration:

```bash
VITE_API_BASE_URL=http://localhost:18080
```

### apps/cli

Purpose: Command-line client for managing todos.

Technology:

- Node.js
- TypeScript
- Commander
- pnpm

Allowed:

- Call `services/api` through HTTP.
- Own command parsing and terminal output.

Not allowed:

- Import code from `apps/web`.
- Read or write the database directly.
- Introduce a shared package without an explicit architecture change.

Local commands:

```bash
cd apps/cli
pnpm install
pnpm todo-cli list
pnpm build
node dist/index.js list
```

Configuration:

```bash
TODO_API_URL=http://localhost:18080
```

### services/api

Purpose: Backend API and Todo business logic.

Technology:

- Java 21
- Spring Boot 3
- Gradle
- Spring Web MVC
- Spring Data JPA
- H2

Allowed:

- Own Todo business rules.
- Own persistence.
- Expose REST APIs.

Not allowed:

- Depend on `apps/web`.
- Depend on `apps/cli`.
- Add authentication in the first version.
- Require an external database in the first version.

Local commands:

```bash
cd services/api
./gradlew bootRun
./gradlew test
```

## Domain Model

Todo:

- `id`
- `title`
- `status`
- `createdAt`
- `updatedAt`

Todo status is fixed:

- `TODO`
- `DOING`
- `DONE`

## API Contract

Base URL:

```text
http://localhost:18080
```

Endpoints:

```http
GET    /api/todos
POST   /api/todos
GET    /api/todos/{id}
PATCH  /api/todos/{id}
```

Create request:

```json
{
  "title": "Prepare training"
}
```

Todo response:

```json
{
  "id": 1,
  "title": "Prepare training",
  "status": "TODO",
  "createdAt": "2026-08-26T07:00:00Z",
  "updatedAt": "2026-08-26T07:00:00Z"
}
```

## Backend Database

Use H2 file mode for local training.

Default location:

```text
services/api/data/todos
```

Current Spring configuration:

```yaml
spring:
  datasource:
    url: jdbc:h2:file:./data/todos
    driver-class-name: org.h2.Driver
    username: sa
    password:
  flyway:
    baseline-on-migrate: true
  jpa:
    hibernate:
      ddl-auto: validate
    open-in-view: false
  h2:
    console:
      enabled: true
```
```

Database schema changes are managed by Flyway migrations under
services/api/src/main/resources/db/migration/. Hibernate validates the
schema at startup but does not modify it.

## Implementation Rules For Agents

When modifying this repository:

1. Keep `apps/web`, `apps/cli`, and `services/api` independent.
2. Do not add `pnpm-workspace.yaml` unless explicitly requested.
3. Do not add a root `package.json` unless explicitly requested.
4. Do not introduce shared packages unless explicitly requested.
5. Do not create `docs/` until `AGENTS.md` becomes too large to maintain.
6. Prefer simple REST over generated clients in the first version.
7. Prefer focused project-level checks over full-repo orchestration.
8. Keep the backend as a single Spring Boot service.
9. Keep persistence local with H2 unless Postgres is explicitly introduced.
10. Do not add authentication in the first version.

## Training Milestones

### Milestone 1: Backend First

Build Todo CRUD API.

Expected result:

- API can create, list, and update todos.
- API returns each todo's fixed workflow status.
- API does not expose status transition endpoints in the first version.

### Milestone 2: Web Client

Build the Todo board UI.

Expected result:

- User can create a todo.
- User can view todos in fixed `待处理`, `进行中`, and `已完成` columns.
- User cannot move todos between columns in the first version.

### Milestone 3: CLI Client

Build command-line operations.

Expected commands:

```bash
todo list
todo add "Prepare training"
```

### Milestone 4: Contract Hardening

Stabilize API request and response shapes.

Expected result:

- Web and CLI use the same backend API.
- API examples remain documented in this file.

## Future Split Plan

Keep this file as the single LLM Wiki entrypoint first.

When `AGENTS.md` becomes too large, split it into:

- `docs/architecture.md`
- `docs/api.md`
- `docs/web.md`
- `docs/cli.md`
- `docs/backend.md`

Until then, `AGENTS.md` remains the source of project navigation.
