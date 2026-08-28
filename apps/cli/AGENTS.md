# apps/cli Agents 指南

本文件记录只对 `apps/cli` 模块成立的约定，供在本模块内改代码的 coding agents
使用。跨模块的仓库结构、产品契约、领域模型、API 契约、验证矩阵和全局实现规则
见根目录 `AGENTS.md`。

## 文档索引

本模块 `docs/` 下的专题文档，按任务类型先读：

- `docs/architecture.md`：模块内部分层约定——program 工厂与运行入口的职责
  划分、argv 与输出槽的注入方式、退出码约束。新增命令、改动 program 构建
  或运行入口前先读。
- `docs/testing.md`：测试策略——node:test 进程内测试形态、针对 dist 产物
  运行、测试文件位置与命名。新增命令或改动 cli 逻辑并补测试前先读。

## 模块说明

`apps/cli` 是供学员扩展的 CLI 底座。

技术：

- Node.js 20+
- TypeScript
- Commander
- pnpm

源码在 `src/`：`index.ts` 是入口，`cli/` 放 Commander program 的构建与运行
逻辑，`test/` 放测试。

当前底座只提供帮助信息，不发起任何网络请求：

```bash
todos-cli --help
```

## 本地命令

在 `apps/cli` 目录下运行：

```bash
pnpm install
pnpm build
pnpm test
pnpm pack
```

- `pnpm test` 先 build，再用 Node.js 内置 test runner（`node --test`）运行
  `dist/test/` 下的测试。
- `pnpm pack` 先跑测试，再 `npm pack --dry-run` 检查打包内容。

从本地 checkout 全局安装当前 CLI：

```bash
pnpm build:install
```

cli changes 的 focused checks 是 `pnpm build` 和 `pnpm test`。
