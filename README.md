# Todos Training

用于小型 Todo Kanban 系统的 Workshop Demo。

这个仓库在一个 Git repository 中包含三个独立应用：

- `apps/web`: React + Vite + Semi Design web client
- `apps/cli`: Node.js command-line client
- `services/api`: Java 21 + Spring Boot 3 API service

这是一个 monorepo，但不是 pnpm workspace。每个应用都拥有自己的依赖清单、
lockfile、build command 和 release path。

## 前置条件

- Java 21+
- Node.js 20+
- pnpm

## 快速开始

同时启动 API 和 Web：

```bash
./scripts/dev.sh
```

打开：

- Web: `http://localhost:15173`

以后台模式运行 launcher：

```bash
./scripts/dev.sh --detach
```

launcher 默认使用 API port `18080` 和 Web port `15173`。需要时可以覆盖
Web port；launcher 会把匹配的 origin 传给 API，确保 CORS 保持一致：

```bash
WEB_PORT=15174 ./scripts/dev.sh
```

如果需要干净的 workshop 状态，可以在启动前重置本地 H2 数据：

```bash
./scripts/dev.sh --reset
```

不使用 `--reset` 时，基于文件的 H2 database 会在服务重启后继续保留。

日志和 PID 文件会写入 `/tmp/todos-training/`。

## 分别运行

启动 API service：

```bash
cd services/api
./gradlew bootRun
```

启动 web client：

```bash
cd apps/web
pnpm install
pnpm dev
```

使用 CLI：

```bash
cd apps/cli
pnpm install
pnpm build
pnpm exec todos-cli list
pnpm exec todos-cli add "Prepare training"
```

全局安装已发布的 CLI：

```bash
npm install --global todos-training-cli
todos-cli --help
```

对于本地 checkout，可以用一条命令全局安装当前 CLI：

```bash
cd apps/cli
pnpm build:install
```

向 public npm registry 发布新版本：

```bash
cd apps/cli
npm login
pnpm pack
pnpm publish
```

Web 和 CLI 默认都会调用 `http://localhost:18080` 上的 API。API 允许
`WEB_PORT` 选定的 Web origin；手动启动服务时，请把
`CORS_ALLOWED_ORIGIN` 设置为 Web URL。

## 本地数据库

API 默认使用 H2 file storage。本地训练不需要外部数据库。

数据库文件会创建在：

```text
services/api/data/
```

## 验证

在发生变更的项目内运行 focused checks：

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

## 项目形态

```text
apps/web     ----\
                  ---> services/api ---> H2 database
apps/cli     ----/
```

`apps/web` 和 `apps/cli` 之间没有直接依赖。

## Agent Skills

本项目为三个 agent 环境提供 project-local skills：

- Codex: `.agents/skills`
- Claude Code: `.claude/skills` 和 `.claude/commands`
- Trae: `.trae/skills` 和 `.trae/commands`
- OpenSpec project configuration: `openspec/`

clone 后请重启 agent 或 IDE，让它重新扫描 local skills 和 commands。

已安装的 workflow families：

- OpenSpec core workflows: propose, explore, apply, update, sync, archive。
- `grill-me` 及其来自 `mattpocock/skills` 的必需依赖 `grilling`。
- 完整的 `obra/superpowers` skills：`using-superpowers`、`brainstorming`、
  `writing-plans`、`test-driven-development`、`systematic-debugging`、
  `verification-before-completion`、`using-git-worktrees`、
  `dispatching-parallel-agents`、`subagent-driven-development`、
  `executing-plans`、`requesting-code-review`、`receiving-code-review`、
  `finishing-a-development-branch` 和 `writing-skills`。

常用入口：

```text
Codex:      $openspec-propose "your idea"
Claude:     /opsx:propose "your idea"
Trae:       /opsx-propose "your idea"

Codex:      $grill-me
Claude:     /grill-me
Trae:       /grill-me
```

本仓库刻意不使用 `~/.codex/prompts` 下的 Codex custom prompts。它们是
user-local 的，在可复用 workflow 共享场景下已 deprecated，也不会通过本仓库共享。
请改用 `$skill-name` 形式的 Codex skills。

## Agent 与架构说明

编码 agent 需要遵守的 repository boundaries、product contracts、API
contracts、implementation rules 和 validation guidance，请见 `AGENTS.md`。
