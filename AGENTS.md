# Todos Training Agents 指南

## 目的

这个仓库是一个 training monorepo，用于 Workshop Demo 中的小型 Todo Kanban
系统。

仓库刻意保持简单。它用于说明一个 full-stack project 如何为 AI-assisted
development 组织结构，同时不要在真正需要之前增加基础设施。

## 指令范围

`README.md` 面向人类 onboarding：说明项目是什么、如何启动，以及应该运行哪些
focused checks。

根目录 `AGENTS.md` 是 coding agents 的 LLM Wiki entrypoint，包含跨模块的
repository map、module ownership、product contracts、API contracts、
validation matrix，以及 agents 在改代码前必须遵守的 implementation rules。
只对单个模块成立的约定在各模块自己的 `AGENTS.md`。

这些文件可以比 README 更详细，但内容应描述当前工程事实和稳定约束，避免记录实现
过程中的临时决策。

## 文档索引

索引只指向下一层：根目录文档和各模块的 `AGENTS.md`。各模块 `docs/` 下的
专题文档由对应模块的 `AGENTS.md` 索引，本文件不跨层列出。

- `docs/architecture.md`：跨模块约束——模块之间禁止的依赖方向、模块间唯一
  允许的数据交换方式、仓库根目录禁止出现的文件。任何涉及跨模块调用、新增
  模块间依赖、或在仓库根目录新增构建/配置文件的任务，动手前先读。
- `apps/web/AGENTS.md`：`apps/web` 模块专属约定（目录意图、styling 规则、
  本地命令、模块级 review 检查项），并索引本模块 `docs/` 下的专题文档。
  改动 `apps/web/` 下任何文件前先读。
- `apps/cli/AGENTS.md`：`apps/cli` 模块专属约定（模块结构、本地命令与
  focused checks），并索引本模块 `docs/` 下的专题文档。改动 `apps/cli/`
  下任何文件前先读。
- `services/api/AGENTS.md`：`services/api` 模块专属约定（数据库与迁移、
  配置、本地命令、模块级 review 检查项），并索引本模块 `docs/` 下的专题
  文档。改动 `services/api/` 下任何文件前先读。

## 系统图

```text
apps/web  ----\
               ---> services/api ---> H2 database
apps/cli  ----/
```

`apps/web` 是 API client，`services/api` 拥有 persistence 和 Todo business
rules，二者彼此不依赖。`apps/cli` 是供学员扩展的 CLI 底座，当前不发起网络
请求；图中指向 API 的连线表示学员扩展时的预期方向。

## 仓库结构

```text
.
├── AGENTS.md
├── README.md
├── skills-lock.json
├── .agents/
│   └── skills/
├── .claude/
│   ├── commands/
│   └── skills/
├── .trae/
│   ├── commands/
│   └── skills/
├── openspec/
├── docs/
├── scripts/
│   ├── dev.sh
│   └── dev.ps1
├── apps/
│   ├── web/
│   │   └── AGENTS.md
│   └── cli/
│       └── AGENTS.md
└── services/
    └── api/
        └── AGENTS.md
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

已安装的 skill 清单以三个 skills 目录中的实际文件为准（三处保持同步安装）：
OpenSpec workflows（propose、explore、apply、update、sync、archive）、
`grill-me` / `grilling`，以及来自 `obra/superpowers` 的全套 superpowers
skills。

OpenSpec planning boundaries：

- `propose` 只创建 planning artifacts。
- `apply` 基于已批准的 change 执行 implementation。
- `archive` 只用于已完成且已验证的 changes。
- 不要把生成的 OpenSpec proposal 当作 implementation 授权。
- 不要因为 OpenSpec artifacts 存在就跳过 validation。

OpenSpec generated files 应通过 OpenSpec CLI 刷新，而不是手工编辑。常用入口：
Codex `$openspec-*`、Claude `/opsx:*`、Trae `/opsx-*`。

`grill-me` 是一个由用户调用的轻量 entrypoint，会委托给 `grilling`，因此两者
必须一起保持安装。当 design、plan 或 architecture decision 在 implementation
前需要 adversarial questioning 时使用它。常用入口：Codex `$grill-me`、
Claude `/grill-me`、Trae `/grill-me`。

Superpowers skills 通过 project-local copy 安装到 Codex、Claude Code 和 Trae
对应目录，让 trainee 不需要额外安装全局 Superpowers plugin 也能使用完整
workflow。`using-superpowers` 刻意保持严格，它要求 agent 在行动前检查 relevant
skills；如果它与直接的用户指令或本文件的 repository rules 冲突，则直接的用户
指令和本文件优先。

### Skill 维护规则

Third-party skill files 视为 generated/vendor content。正常项目行为不要手工
编辑 third-party `SKILL.md` files；`skills-lock.json` 应与已安装的
non-OpenSpec skills 保持一致。

## 本地 Launcher

`scripts/dev.sh` 是用于本地开发的 convenience script（Windows 下有对应
`scripts/dev.ps1`）。它不是 build system，也不改变 module ownership
boundaries。

支持的参数（`--detach`、`--build`、`--skip-install`、`--no-takeover`、
`--reset`、`--help`）和完整默认行为以 `./scripts/dev.sh --help` 输出和脚本
本身为准。默认行为要点：检查 Java 21+、Node.js 20+、pnpm、curl 和 lsof；在
`http://localhost:18080` 启动 `services/api`，在 `http://localhost:15173`
启动 `apps/web`；除非使用 `--no-takeover`，否则启动前停止这些端口上已有的
listeners；当 `node_modules` 缺失或 manifests 发生变化时自动安装 web/cli
dependencies，除非使用 `--skip-install`；把选定的 Web origin 通过
`CORS_ALLOWED_ORIGIN` 传给 API 用于 CORS；API 使用 in-memory H2，每次重启
都是干净 database，`--reset` 仅用于明确表达本次启动需要干净状态；logs 和 PID
files 写到 `/tmp/todos-training/`；foreground 模式 Ctrl+C 只停止该 script
启动的 services；不会把 CLI 作为 long-running service 运行或托管。

## 产品契约

产品是一个 minimal Todo Kanban board。

当前 user-visible scope：

- List todos。
- 按 title 创建 todo，并可选择性填写描述和优先级。
- 编辑已有 todo 的标题、描述和优先级。
- 删除 todo（删除前二次确认）。
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

当前 update rule：

- Client 发送必填的 `title`，并可选择性发送 `description` 和 `priority`。
- Backend trim title；空白 title 校验失败。
- Backend trim description；空白或未提供的 description 存为 `NULL`。
- 未提供 `priority` 时存为 `NULL`（即清空已有优先级）。
- Update 不修改 `status`。

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
保持一致。CORS 对 `/api/**` 放行 `GET`、`POST`、`PUT`、`PATCH`、`DELETE`、
`OPTIONS` 方法。

Endpoints：

```http
GET    /api/todos
POST   /api/todos
PUT    /api/todos/{id}
DELETE /api/todos/{id}
```

只 document 和调用本节列出的 endpoints。

- `GET /api/todos` 返回 todo 列表，按 `createdAt` 倒序。
- `POST /api/todos` 创建 todo，返回 201 和创建后的 todo。
- `PUT /api/todos/{id}` 更新 todo 的 `title`、`description`、`priority`，
  返回 200 和更新后的 todo；`id` 不存在时返回 404。Update 不修改 `status`。
- `DELETE /api/todos/{id}` 删除 todo，返回 204 且无响应体；`id` 不存在时
  返回 404。

Create / Update request：

```json
{
  "title": "Prepare training",
  "description": "准备培训材料和场地",
  "priority": "HIGH"
}
```

`description` 和 `priority` 均为可选字段；`description` 最大 2000 字符，
`priority` 取值为 `LOW`、`MEDIUM`、`HIGH`。空白 `title` 由 Bean Validation
（`@NotBlank`）在 DTO 层拒绝；非法 `priority` 因枚举反序列化失败被拒绝；
两者均返回 400。2000 字符长度限制当前由数据库列长度和前端输入框 maxCount
保证，API DTO 层不校验长度。Update request 的请求体与 Create 形状相同。

Todo response（`GET` 列表元素、`POST`、`PUT` 均返回该形状）：

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

未设置的 `description` 和 `priority` 在响应中为 `null`。`DELETE` 成功返回
204，无响应体。

## 验证矩阵

运行与变更文件相关的 scoped checks。除非明确要求，否则不要引入 root-level
build 或 test orchestrator。各模块要运行的 focused checks 和本地命令见对应
模块的 `AGENTS.md`（`apps/web/AGENTS.md`、`apps/cli/AGENTS.md`、
`services/api/AGENTS.md`）。

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
8. 保持可见 UI features 与真实 backend capabilities 对齐。
9. 保持 UI、CLI、API 和 docs references 与当前实现一致。
10. 相比 premature abstraction，优先 readable code 和 clear boundaries。
11. 不要给 commits 添加 AI attribution footers。

## Code Review 规则

review 本仓库变更时：

- 标记 `apps/web` 和 `apps/cli` 之间的任何 direct dependency。
- 标记任何不受当前 API contract 支撑的 frontend feature。
- 标记任何没有反映在本文件 API 契约中的 backend endpoint。
- 标记未经明确批准添加的 root-level build 或 workspace files。

各模块专属的 review 检查项见 `apps/web/AGENTS.md`、`apps/cli/AGENTS.md` 和
`services/api/AGENTS.md`。
