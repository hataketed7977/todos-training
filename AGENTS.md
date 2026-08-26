# Todos Training Agents Guide

## Purpose

This repository is a training monorepo for a small Todo Kanban system used in
Workshop Demo.

The repository is intentionally simple. Keep it useful for explaining how a
full-stack project can be structured for AI-assisted development without adding
infrastructure before it is needed.

## Instruction Scope

`README.md` is for human onboarding: what the project is, how to start it, and
which focused checks to run.

`AGENTS.md` is the LLM Wiki entrypoint for coding agents. It should contain the
repository map, module ownership, product contracts, API contracts, validation
matrix, and implementation rules that agents must follow before changing code.

Do not create a `docs/` directory yet. This file is intentionally allowed to be
larger than the README. Split it later only when the content becomes hard to
navigate or starts approaching agent instruction size limits.

## System Map

```text
apps/web  ----\
               ---> services/api ---> H2 database
apps/cli  ----/
```

`apps/web` and `apps/cli` are both API clients. They do not depend on each
other. `services/api` owns persistence and Todo business rules.

## Repository Shape

```text
.
├── AGENTS.md
├── README.md
├── scripts/
│   └── dev.sh
├── apps/
│   ├── web/
│   └── cli/
└── services/
    └── api/
```

This is a monorepo, but it is not a pnpm workspace:

- Do not add `pnpm-workspace.yaml` unless explicitly requested.
- Do not add a root `package.json` unless explicitly requested.
- Do not introduce shared packages unless explicitly requested.
- Each app owns its own dependency manifest, lockfile, commands, and release
  path.

## Non-Goals For The Current Baseline

Do not add these unless the user explicitly changes scope:

- Authentication or users
- Authorization or tenant isolation
- Docker or Kubernetes
- External databases such as PostgreSQL or MySQL
- GraphQL
- Generated API clients
- A root build orchestrator
- A shared TypeScript package
- A `docs/` directory
- Drag-and-drop
- Todo deletion
- Status transition APIs
- Todo priority
- Todo description
- Multiple boards, lanes, swimlanes, workflow definitions, or execution flows

## Local Launcher

`scripts/dev.sh` is a convenience script for local development. It is not a
build system and does not change module ownership boundaries.

Supported commands:

```bash
./scripts/dev.sh
./scripts/dev.sh --detach
./scripts/dev.sh --build
./scripts/dev.sh --skip-install
./scripts/dev.sh --no-takeover
./scripts/dev.sh --help
```

Default behavior:

- Checks Java 21+, Node.js 20+, pnpm, curl, and lsof.
- Starts `services/api` on `http://localhost:18080`.
- Starts `apps/web` on `http://localhost:15173`.
- Stops existing listeners on those ports unless `--no-takeover` is used.
- Installs web/cli dependencies when `node_modules` is missing or manifests
  changed, unless `--skip-install` is used.
- Writes logs and PID files under `/tmp/todos-training/` by default.
- Stops only services started by the script when foreground mode receives
  Ctrl+C.
- Does not run or host the CLI as a long-running service.

## Module Boundaries

### apps/web

Purpose: Browser-based Todo Kanban UI.

Technology:

- React
- Vite
- TypeScript
- Semi Design
- pnpm

Allowed:

- Call `services/api` through HTTP.
- Own browser UI state, rendering, and user interactions.
- Own web-specific TypeScript types when they mirror API response shapes.
- Use local i18n constants for UI copy.

Not allowed:

- Import code from `apps/cli`.
- Read or write the database directly.
- Add drag-and-drop, delete, priority, description, multiple boards, or custom
  workflow UI unless explicitly requested.
- Introduce a shared package without an explicit architecture change.

Current source layout:

```text
apps/web/src/
├── App.tsx
├── main.tsx
├── index.css
├── components/
├── hooks/
├── i18n/
├── pages/
├── services/
└── types/
```

Directory intent:

- `pages/`: route-level page composition.
- `components/`: reusable presentational or page-local UI components.
- `hooks/`: React state/effect orchestration.
- `services/`: HTTP calls and backend integration.
- `types/`: TypeScript domain/API types used by the web app.
- `i18n/`: UI text constants. Add copy here before hardcoding user-facing text.
- `index.css`: global document-level styles only, such as base font and page
  background.

Styling rules:

- Use Semi Design components as the UI baseline.
- Prefer Semi props and composition over custom CSS.
- Avoid page-level component CSS files for one-off styling.
- Inline styles are acceptable for small layout constraints and visual tuning.
- Keep broad global styles in `index.css`; do not use it to override component
  internals broadly.
- Dark header areas must use light readable text.
- Keep the board visually simple: top navigation/header only, no sidebar.

Current web behavior:

- Page title is `Todos-Training`.
- Subtitle is `Workshop Demo`.
- UI copy is Chinese except brand/title strings.
- The board displays exactly three fixed columns:
  - `TODO` -> `待处理`
  - `DOING` -> `进行中`
  - `DONE` -> `已完成`
- Cards are grouped by the `status` returned by the API.
- The add button appears only in the `待处理` column.
- Creating a todo opens a Semi Modal.
- The create modal contains one required title input.
- The input has no visible label and uses placeholder `标题`.
- Empty title or whitespace-only title must fail validation.
- Created todos are sent to the backend through `POST /api/todos`.
- The backend assigns new todos to `TODO`.
- Cards display only the title.
- There is no delete button.
- There are no status move buttons.
- There is no manual refresh button.
- Board columns are fixed-height inside the viewport; long columns should scroll
  inside the column body, not create page-level scrolling.
- Header stats show total count and per-status counts.
- Header status tag colors should stay visually aligned with lane tag colors,
  while remaining readable on the dark header background.

Local commands:

```bash
cd apps/web
pnpm install
pnpm dev
pnpm build
pnpm lint
```

Configuration:

```bash
VITE_API_BASE_URL=http://localhost:18080
```

Known build tradeoff:

- Vite may warn that the main chunk is larger than 500 kB.
- Current cause is the Semi component dependency graph, especially Semi Form.
- This is acceptable for the demo baseline unless the user explicitly asks for
  bundle optimization.
- Do not add lazy loading or manual chunk splitting only to silence the warning
  unless the user accepts that tradeoff.

### apps/cli

Purpose: Command-line client for managing todos through the API.

Technology:

- Node.js 20+
- TypeScript
- Commander
- pnpm

Allowed:

- Call `services/api` through HTTP.
- Own command parsing, terminal output, and CLI-specific application flow.
- Own CLI-specific TypeScript types when they mirror API response shapes.

Not allowed:

- Import code from `apps/web`.
- Read or write the database directly.
- Add commands that require missing backend capabilities.
- Introduce a shared package without an explicit architecture change.

Current source layout:

```text
apps/cli/src/
├── index.ts
├── application/
│   ├── ports/
│   └── todo-use-cases.ts
├── cli/
├── commands/
├── infrastructure/
├── output/
├── test/
└── types/
```

Directory intent:

- `cli/`: Commander program creation and process-level run wiring.
- `commands/`: command definitions and argument handling.
- `application/`: use-case orchestration independent of Commander.
- `application/ports/`: interfaces required by application logic.
- `infrastructure/`: HTTP client and environment configuration.
- `output/`: terminal formatting and printing.
- `types/`: CLI-side API/domain types.
- `test/`: Node test runner tests compiled before execution.

Current commands:

```bash
todos-cli list
todos-cli add "Prepare training"
```

Do not add `delete`, `move`, `done`, or status-transition commands unless the
backend API is intentionally expanded first.

Local commands:

```bash
cd apps/cli
pnpm install
pnpm build
pnpm test
pnpm exec todos-cli list
pnpm exec todos-cli add "Prepare training"
node dist/index.js list
```

Install the current CLI globally from the local checkout:

```bash
cd apps/cli
pnpm build:install
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
- Bean Validation
- Flyway
- H2

Allowed:

- Own Todo business rules.
- Own persistence.
- Expose REST APIs.
- Own database migrations.
- Return API response shapes consumed by web and CLI.

Not allowed:

- Depend on `apps/web`.
- Depend on `apps/cli`.
- Add authentication in the first version.
- Require an external database in the first version.
- Let Hibernate mutate schema automatically.
- Expose status transition or delete endpoints unless explicitly requested.

Current Java package root:

```text
com.bytedance.todos
```

Current source layout:

```text
services/api/src/main/
├── java/com/bytedance/todos/
│   ├── TodosApiApplication.java
│   ├── controller/
│   ├── dto/
│   ├── model/
│   ├── repository/
│   └── service/
└── resources/
    ├── application.yml
    └── db/migration/
```

Local commands:

```bash
cd services/api
./gradlew bootRun
./gradlew test
./gradlew test --rerun-tasks
```

## Product Contract

The product is a minimal Todo Kanban board.

Current user-visible scope:

- List todos.
- Create todo by title.
- Show todos in three fixed status columns.
- Show total and per-status counts.

Current user-visible non-scope:

- No description field.
- No priority field.
- No delete action.
- No edit action in the UI.
- No drag-and-drop.
- No move/status action.
- No custom lane management.
- No multi-board navigation.
- No left sidebar.

Keep the UI honest. Do not show buttons, labels, counts, menus, fields, or
placeholder concepts for features that do not exist.

## Domain Model

Todo fields:

- `id`: numeric database identifier.
- `title`: required non-blank string.
- `status`: fixed workflow status.
- `createdAt`: creation timestamp.
- `updatedAt`: last update timestamp.

Todo status is fixed:

- `TODO`
- `DOING`
- `DONE`

Current creation rule:

- Client sends only `title`.
- Backend trims the title.
- Backend creates the todo with status `TODO`.

Current update rule:

- Backend supports title update through `PATCH /api/todos/{id}`.
- Empty or blank update titles are ignored.
- Web and CLI do not currently expose title editing.

## API Contract

Base URL:

```text
http://localhost:18080
```

Configured CORS origin:

```text
http://localhost:15173
```

Endpoints:

```http
GET    /api/todos
POST   /api/todos
GET    /api/todos/{id}
PATCH  /api/todos/{id}
```

Do not document or call endpoints that do not exist. In particular, there is no
current delete endpoint and no current status-transition endpoint.

Create request:

```json
{
  "title": "Prepare training"
}
```

Update request:

```json
{
  "title": "Update training outline"
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

Not found response shape:

```json
{
  "message": "Todo not found: 1"
}
```

## Backend Database

Use H2 file mode for local training.

Default local database path:

```text
services/api/data/todos
```

Current application configuration:

```yaml
server:
  port: 18080

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

Database schema changes are managed by Flyway migrations under:

```text
services/api/src/main/resources/db/migration/
```

Current migration:

```text
V1__create_todos.sql
```

Hibernate validates the schema at startup but does not modify it.

Tests use an in-memory H2 database configured under:

```text
services/api/src/test/resources/application.yml
```

## Validation Matrix

Run checks scoped to the files that changed. Do not introduce a root-level build
or test orchestrator unless explicitly requested.

For web changes:

```bash
cd apps/web
pnpm build
```

For CLI changes:

```bash
cd apps/cli
pnpm build
pnpm test
```

For API changes:

```bash
cd services/api
./gradlew test --rerun-tasks
```

For documentation-only changes:

```bash
git diff --check
```

Before committing mixed changes, run the relevant checks for each changed
project plus:

```bash
git diff --check
```

## Implementation Rules For Agents

When modifying this repository:

1. Keep `apps/web`, `apps/cli`, and `services/api` independent.
2. Do not add `pnpm-workspace.yaml` unless explicitly requested.
3. Do not add a root `package.json` unless explicitly requested.
4. Do not introduce shared packages unless explicitly requested.
5. Do not create `docs/` until this file becomes too large to maintain.
6. Prefer simple REST over generated clients in the first version.
7. Prefer focused project-level checks over full-repo orchestration.
8. Keep the backend as a single Spring Boot service.
9. Keep persistence local with H2 unless another database is explicitly
   introduced.
10. Do not add authentication in the first version.
11. Keep visible UI features aligned with real backend capabilities.
12. Remove dead UI, CLI, API, and docs references when a feature is removed.
13. Keep user-facing web copy in `apps/web/src/i18n/zhCN.ts`.
14. Prefer readable code and clear boundaries over premature abstraction.
15. Do not add AI attribution footers to commits.

## Code Review Rules

When reviewing changes in this repository:

- Flag any direct dependency between `apps/web` and `apps/cli`.
- Flag any frontend feature that is not backed by the current API contract.
- Flag any CLI command that calls a missing or undocumented API.
- Flag any backend endpoint that is not reflected in this file's API contract.
- Flag UI copy hardcoded outside `apps/web/src/i18n/zhCN.ts`.
- Flag large custom CSS files for component-level styling unless there is a
  clear reason Semi cannot express the layout.
- Flag schema changes that skip Flyway migrations.
- Flag Hibernate schema generation settings that would mutate the schema.
- Flag root-level build or workspace files added without explicit approval.
- Flag docs that describe deleted features such as priority, description,
  deletion, status movement, workflow definitions, or swimlanes.

## Training Narrative

This repository is also used to demonstrate an LLM Wiki workflow.

The intended progression is:

1. Keep `README.md` small and human-focused.
2. Keep `AGENTS.md` as the detailed agent-readable source of truth.
3. Let agents use this file to understand constraints before coding.
4. When this file becomes hard to maintain, split stable sections into `docs/`
   while keeping a concise `AGENTS.md` map that points to them.

Do not split into docs prematurely. The current exercise is to show how a single
accurate `AGENTS.md` can guide future coding agents.

## Future Split Plan

When `AGENTS.md` becomes too large or multiple modules need independent
ownership, split it into:

- `docs/architecture.md`
- `docs/product-contract.md`
- `docs/api.md`
- `docs/web.md`
- `docs/cli.md`
- `docs/backend.md`
- `docs/validation.md`

Until then, `AGENTS.md` remains the source of project navigation and agent
instructions.
