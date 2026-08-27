# Todos Training Agents 指南

## 目的

这个仓库是一个 training monorepo，用于 Workshop Demo 中的小型 Todo Kanban
系统。

仓库刻意保持简单。它用于说明一个 full-stack project 如何为 AI-assisted
development 组织结构，同时不要在真正需要之前增加基础设施。

## 指令范围

`README.md` 面向人类 onboarding：说明项目是什么、如何启动，以及应该运行哪些
focused checks。

`AGENTS.md` 是 coding agents 的 LLM Wiki entrypoint。它应包含 repository
map、module ownership、product contracts、API contracts、validation matrix，
以及 agents 在改代码前必须遵守的 implementation rules。

这个文件可以比 README 更详细，但内容应描述当前工程事实和稳定约束，避免记录实现
过程中的临时决策。

## 系统图

```text
apps/web  ----\
               ---> services/api ---> H2 database
apps/cli  ----/
```

`apps/web` 是 API client，`apps/cli` 是供学员扩展的 CLI 底座。它们彼此不依赖。
`services/api` 拥有 persistence 和 Todo business rules。

## 仓库结构

```text
.
├── AGENTS.md
├── README.md
├── .agents/
│   └── skills/
├── .claude/
│   ├── commands/
│   └── skills/
├── .trae/
│   ├── commands/
│   └── skills/
├── openspec/
├── scripts/
│   └── dev.sh
├── apps/
│   ├── web/
│   └── cli/
└── services/
    └── api/
```

这是一个 monorepo，但不是 pnpm workspace：

- 除非明确要求，否则不要添加 `pnpm-workspace.yaml`。
- 除非明确要求，否则不要添加 root `package.json`。
- 除非明确要求，否则不要引入 shared packages。
- 每个 app 都拥有自己的依赖清单、lockfile、commands 和 release path。

## Agent Skill 基线

这个仓库包含 project-local skills，让 trainees clone 项目后，可以在多个
coding agents 中使用同一套 workflow vocabulary。

目录归属：

- `.agents/skills/`: Codex 和其他 Agent Skills-compatible tools。
- `.claude/skills/`: Claude Code skills。
- `.claude/commands/`: Claude Code slash commands。
- `.trae/skills/`: Trae skills。
- `.trae/commands/`: Trae slash commands。
- `openspec/`: OpenSpec project configuration。

Codex 使用 `.agents/skills` 承载 project-local reusable workflows。本仓库不使用
`.codex/` 或 `~/.codex/prompts` 作为 project-local skill 入口。

clone 后或修改 skill files 后，请重启 agent 或 IDE，让 local skills 和 commands
被重新扫描。

### 已安装的 OpenSpec Workflows

OpenSpec 已为以下工具安装：

- Codex 通过 `.agents/skills/openspec-*/SKILL.md`
- Claude Code 通过 `.claude/skills/openspec-*` 和 `.claude/commands/opsx/*`
- Trae 通过 `.trae/skills/openspec-*` 和 `.trae/commands/opsx-*`

当前 OpenSpec profile：

```text
core: propose, explore, apply, update, sync, archive
```

常用入口：

```text
Codex:  $openspec-propose "your idea"
Claude: /opsx:propose "your idea"
Trae:   /opsx-propose "your idea"
```

OpenSpec planning boundaries：

- `propose` 只创建 planning artifacts。
- `apply` 基于已批准的 change 执行 implementation。
- `archive` 只用于已完成且已验证的 changes。
- 不要把生成的 OpenSpec proposal 当作 implementation 授权。
- 不要因为 OpenSpec artifacts 存在就跳过 validation。

OpenSpec generated files 应通过 OpenSpec CLI 刷新，而不是手工编辑。

### 已安装的 grill-me Skills

仓库包含：

- `grill-me`
- `grilling`

`grill-me` 是一个由用户调用的轻量 entrypoint，会委托给 `grilling`，因此两者
必须一起保持安装。

当 design、plan 或 architecture decision 在 implementation 前需要 adversarial
questioning 时使用它。

常用入口：

```text
Codex:  $grill-me
Claude: /grill-me
Trae:   /grill-me
```

### 已安装的 Superpowers Skills

仓库包含来自 `obra/superpowers` 的完整 skill 集：

- `using-superpowers`
- `brainstorming`
- `dispatching-parallel-agents`
- `executing-plans`
- `finishing-a-development-branch`
- `receiving-code-review`
- `requesting-code-review`
- `subagent-driven-development`
- `writing-plans`
- `test-driven-development`
- `systematic-debugging`
- `using-git-worktrees`
- `verification-before-completion`
- `writing-skills`

这些 skills 通过 project-local copy 安装到 Codex、Claude Code 和 Trae 对应目录，
让 trainee 不需要额外安装全局 Superpowers plugin 也能使用完整 workflow。它们仍然
属于 third-party generated/vendor content，正常项目行为不要手工修改其
`SKILL.md`。

`using-superpowers` 刻意保持严格。它要求 agent 在行动前检查 relevant skills。
如果它与直接的用户指令或本文件的 repository rules 冲突，则直接的用户指令和本文件
优先。

### Skill 维护规则

Third-party skill files 视为 generated/vendor content。正常项目行为不要手工编辑
third-party `SKILL.md` files；`skills-lock.json` 应与已安装的 non-OpenSpec skills
保持一致。

## 本地 Launcher

`scripts/dev.sh` 是用于本地开发的 convenience script。它不是 build system，也不
改变 module ownership boundaries。

支持的 commands：

```bash
./scripts/dev.sh
./scripts/dev.sh --detach
./scripts/dev.sh --build
./scripts/dev.sh --skip-install
./scripts/dev.sh --no-takeover
./scripts/dev.sh --reset
./scripts/dev.sh --help
```

默认行为：

- 检查 Java 21+、Node.js 20+、pnpm、curl 和 lsof。
- 在 `http://localhost:18080` 启动 `services/api`。
- 在 `http://localhost:15173` 启动 `apps/web`。
- 除非使用 `--no-takeover`，否则停止这些端口上已有的 listeners。
- 把选定的 Web origin 传给 API 用于 CORS。
- 当 `node_modules` 缺失或 manifests 发生变化时安装 web/cli dependencies，除非
  使用 `--skip-install`。
- API 使用 in-memory H2。每次重新启动 API 都会得到干净 database；`--reset`
  仅用于明确表达本次启动需要干净状态。
- 默认把 logs 和 PID files 写到 `/tmp/todos-training/`。
- foreground mode 收到 Ctrl+C 时，只停止由该 script 启动的 services。
- 不会把 CLI 作为 long-running service 运行或托管。

## 模块边界

### apps/web

目的：基于浏览器的 Todo Kanban UI。

技术：

- React
- Vite
- TypeScript
- Semi Design
- pnpm

允许：

- 通过 HTTP 调用 `services/api`。
- 拥有 browser UI state、rendering 和 user interactions。
- 在镜像 API response shapes 时，拥有 web-specific TypeScript types。
- 使用本地 i18n constants 管理 UI copy。

不允许：

- 从 `apps/cli` import code。
- 直接读写 database。
- 在没有明确 architecture change 的情况下引入 shared package。

当前 source layout：

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

目录意图：

- `pages/`: route-level page composition。
- `components/`: reusable presentational 或 page-local UI components。
- `hooks/`: React state/effect orchestration。
- `services/`: HTTP calls 和 backend integration。
- `types/`: web app 使用的 TypeScript domain/API types。
- `i18n/`: UI text constants。硬编码 user-facing text 前先在这里添加 copy。
- `index.css`: 只放 global document-level styles，例如 base font 和 page
  background。

Styling 规则：

- 使用 Semi Design components 作为 UI baseline。
- 相比 custom CSS，优先使用 Semi props 和 composition。
- 避免为了 one-off styling 创建 page-level component CSS files。
- 对小范围 layout constraints 和 visual tuning，可以使用 inline styles。
- 将宽泛的 global styles 保留在 `index.css`；不要用它大范围覆盖 component
  internals。
- 深色 header 区域必须使用浅色且可读的文字。
- 保持 board 视觉简单：只有 top navigation/header，没有 sidebar。

当前 Web 行为：

- Page title 是 `Todos-Training`。
- Subtitle 是 `Workshop Demo`。
- 除 brand/title strings 外，UI copy 使用中文。
- board 精确显示三个固定 columns：
  - `TODO` -> `待处理`
  - `DOING` -> `进行中`
  - `DONE` -> `已完成`
- Cards 按 API 返回的 `status` 分组。
- add button 只出现在 `待处理` column。
- 创建 todo 会打开 Semi Modal。
- create modal 包含一个必填 title input，以及非必填的描述多行输入和优先级下拉选择。
- title input 没有可见 label，使用 placeholder `标题`。
- 空 title 或仅包含空白字符的 title 必须 validation 失败。
- 描述为非必填；提交时 trim，空白描述按未填写处理。
- 优先级为非必填，取值 `低/中/高`（对应 `LOW/MEDIUM/HIGH`），可以不选或清空。
- 创建的 todos 通过 `POST /api/todos` 发送给 backend。
- backend 将新 todos 分配到 `TODO`。
- Cards 展示 title；当 todo 填写了优先级或描述时，以普通文本样式补充展示，不引入颜色标签。
- 长描述在卡片内截断展示，并可查看完整内容。
- Board columns 在 viewport 内固定高度；长 columns 应在 column body 内滚动，不能造成
  page-level scrolling。
- Header stats 显示 total count 和 per-status counts。
- Header status tag colors 应与 lane tag colors 保持视觉一致，同时在深色 header
  background 上保持可读。

本地 commands：

```bash
cd apps/web
pnpm install
pnpm dev
pnpm build
pnpm lint
```

配置：

```bash
VITE_API_BASE_URL=http://localhost:18080
```

launcher 启动 API 时会把 `CORS_ALLOWED_ORIGIN` 设置为
`http://localhost:${WEB_PORT}`。手动启动 API 时，如果 Web port 不是 `15173`，请显式
设置它。

已知 build tradeoff：

- Vite 可能警告 main chunk 大于 500 kB。
- 当前原因是 Semi component dependency graph，尤其是 Semi Form。
- 除非用户明确要求 bundle optimization，否则这对 demo baseline 是可接受的。
- 除非用户接受该 tradeoff，否则不要只是为了消除 warning 而添加 lazy loading 或
  manual chunk splitting。

### apps/cli

目的：提供一个可供学员扩展的 CLI 底座。

技术：

- Node.js 20+
- TypeScript
- Commander
- pnpm

当前 source layout：

```text
apps/cli/src/
├── index.ts
├── cli/
├── test/
```

当前底座只提供帮助信息：

```bash
todos-cli --help
```

本地构建和测试：

```bash
cd apps/cli
pnpm install
pnpm build
pnpm test
```

从本地 checkout 全局安装当前 CLI：

```bash
cd apps/cli
pnpm build:install
```

### services/api

目的：Backend API 和 Todo business logic。

技术：

- Java 21
- Spring Boot 3
- Gradle
- Spring Web MVC
- Spring Data JPA
- Bean Validation
- Flyway
- H2

允许：

- 拥有 Todo business rules。
- 拥有 persistence。
- 暴露 REST APIs。
- 拥有 database migrations。
- 返回 web 消费的 API response shapes。

不允许：

- 依赖 `apps/web`。
- 依赖 `apps/cli`。
- 让 Hibernate 自动 mutate schema。

当前 Java package root：

```text
com.bytedance.todos
```

当前 source layout：

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

本地 commands：

```bash
cd services/api
./gradlew bootRun
./gradlew test
./gradlew test --rerun-tasks
```

## 产品契约

产品是一个 minimal Todo Kanban board。

当前 user-visible scope：

- List todos。
- 按 title 创建 todo，并可选择性填写描述和优先级。
- 在三个固定 status columns 中展示 todos。
- 显示 total 和 per-status counts。

保持 UI 诚实。可见控件和文案应对应当前真实能力。

## 领域模型

Todo fields：

- `id`: numeric database identifier。
- `title`: required non-blank string。
- `description`: optional free-text string，最大 2000 字符，可为空。
- `status`: fixed workflow status。
- `priority`: optional fixed priority，取值 `LOW` / `MEDIUM` / `HIGH`，可为空。
- `createdAt`: creation timestamp。
- `updatedAt`: last update timestamp。

Todo status 是固定的：

- `TODO`
- `DOING`
- `DONE`

Todo priority 是固定的：

- `LOW`
- `MEDIUM`
- `HIGH`

当前 creation rule：

- Client 发送必填的 `title`，并可选择性发送 `description` 和 `priority`。
- Backend trim title。
- Backend trim description；空白或未提供的 description 存为 `NULL`。
- Backend 不提供 `priority` 默认值；未提供时存为 `NULL`。
- Backend 创建 status 为 `TODO` 的 todo。
- `priority` 不影响列表排序，列表仍按 `createdAt` 倒序返回。

## API 契约

Base URL：

```text
http://localhost:18080
```

Configured CORS origin：

```text
${CORS_ALLOWED_ORIGIN:http://localhost:15173}
```

origin 可通过 `CORS_ALLOWED_ORIGIN` 配置；`scripts/dev.sh` 会让它与 `WEB_PORT`
保持一致。

Endpoints：

```http
GET    /api/todos
POST   /api/todos
```

只 document 和调用本节列出的 endpoints。

Create request：

```json
{
  "title": "Prepare training",
  "description": "准备培训材料和场地",
  "priority": "HIGH"
}
```

`description` 和 `priority` 均为可选字段；`description` 最大 2000 字符，
`priority` 取值为 `LOW`、`MEDIUM`、`HIGH`。

Todo response：

```json
{
  "id": 1,
  "title": "Prepare training",
  "description": "准备培训材料和场地",
  "status": "TODO",
  "priority": "HIGH",
  "createdAt": "2026-08-26T07:00:00Z",
  "updatedAt": "2026-08-26T07:00:00Z"
}
```

未设置的 `description` 和 `priority` 在响应中为 `null`。

## Backend 数据库

本地训练使用 in-memory H2。服务重启后数据会重置。

当前 application configuration：

```yaml
server:
  port: 18080

spring:
  datasource:
    url: jdbc:h2:mem:todos;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
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

Database schema changes 由以下目录中的 Flyway migrations 管理：

```text
services/api/src/main/resources/db/migration/
```

当前 migration：

```text
V1__create_todos.sql
V2__add_todo_fields.sql
```

Hibernate 启动时 validate schema，但不会修改 schema。

Tests 使用以下位置配置的 in-memory H2 database：

```text
services/api/src/test/resources/application.yml
```

## 验证矩阵

运行与变更文件相关的 scoped checks。除非明确要求，否则不要引入 root-level build 或
test orchestrator。

对于 web changes：

```bash
cd apps/web
pnpm build
```

对于 CLI changes：

```bash
cd apps/cli
pnpm build
pnpm test
```

对于 API changes：

```bash
cd services/api
./gradlew test --rerun-tasks
```

对于 documentation-only changes：

```bash
git diff --check
```

commit mixed changes 前，运行每个 changed project 的相关 checks，并额外运行：

```bash
git diff --check
```

## Agents 实现规则

修改本仓库时：

1. 保持 `apps/web`、`apps/cli` 和 `services/api` 独立。
2. 除非明确要求，否则不要添加 `pnpm-workspace.yaml`。
3. 除非明确要求，否则不要添加 root `package.json`。
4. 除非明确要求，否则不要引入 shared packages。
5. 保持 agent instructions 聚焦当前工程事实和稳定约束。
6. 当前 API 使用简单 REST，不使用 generated clients。
7. 相比 full-repo orchestration，优先使用 focused project-level checks。
8. 保持 backend 是单个 Spring Boot service。
9. 除非明确引入其他 database，否则 persistence 保持 in-memory H2。
10. 当前 backend 不包含 authentication，持久化使用 in-memory H2。
11. 保持可见 UI features 与真实 backend capabilities 对齐。
12. 保持 UI、CLI、API 和 docs references 与当前实现一致。
13. 将 user-facing web copy 保持在 `apps/web/src/i18n/zhCN.ts`。
14. 相比 premature abstraction，优先 readable code 和 clear boundaries。
15. 不要给 commits 添加 AI attribution footers。

## Code Review 规则

review 本仓库变更时：

- 标记 `apps/web` 和 `apps/cli` 之间的任何 direct dependency。
- 标记任何不受当前 API contract 支撑的 frontend feature。
- 标记任何没有反映在本文件 API contract 中的 backend endpoint。
- 标记在 `apps/web/src/i18n/zhCN.ts` 外硬编码的 UI copy。
- 标记用于 component-level styling 的大型 custom CSS files，除非有明确理由说明
  Semi 无法表达该 layout。
- 标记跳过 Flyway migrations 的 schema changes。
- 标记会 mutate schema 的 Hibernate schema generation settings。
- 标记未经明确批准添加的 root-level build 或 workspace files。
