# apps/web 测试策略

本文记录 `apps/web` 模块当前真实存在的自动化验证手段，分层口径与
`apps/web/docs/architecture.md` 一致。每条判断依据都指向当前仓库中的具体
位置（路径相对 `apps/web` 模块根目录）。

## 1. 当前没有自动化测试套件

模块目前不包含任何测试代码，也没有测试框架：

- `package.json` 的 `scripts` 只有 `dev` / `build` / `lint` / `preview`
  （`package.json:6-11`），没有 `test` 脚本；`devDependencies` 中没有任何
  测试运行器或断言库（`package.json:18-26`，只有 Vite、TypeScript、
  oxlint 和类型声明）。
- 模块的 focused check 是 `pnpm build`（见 `apps/web/AGENTS.md`），即
  TypeScript 编译 + Vite 构建，而不是跑测试。

因此本文不规定测试文件位置、命名或断言写法——这些约定在仓库里没有任何
现存实践可以印证，凭空规定会与“按现有做法组织”的原则冲突。引入测试框架
属于一次明确的架构变更，应在变更时连同约定一起确立，而不是在本文预先
推演。

## 2. 现存的两道自动化门禁

虽然没有测试，以下两类检查在每次改动时真实执行，它们各自能拦住的问题
不同：

### 2.1 类型检查与构建：`pnpm build`

`pnpm build` 执行 `tsc -b && vite build`（`package.json:8`）。TypeScript
配置（`tsconfig.app.json`）打开的检查中，与分层约定直接相关的有：

- `noUnusedLocals` / `noUnusedParameters`
  （`tsconfig.app.json:20-21`）：未使用的 import 和变量编译失败，跨层
  误引（如组件 import 了 service 却没走 hook）会以未使用符号或类型不匹配
  的形式暴露。
- `noFallthroughCasesInSwitch`（`tsconfig.app.json:23`）。
- `verbatimModuleSyntax`（`tsconfig.app.json:14`）：类型 import 必须显式
  写 `import type`，分层间的类型依赖与值依赖在语法上可区分。

类型系统同时是 API 契约的镜像防线：services 层的返回类型和 hook 的状态
都引用 `src/types/todo.ts` 的 `Todo`（见 `docs/architecture.md` 4.2），
后端响应字段变化导致的形状漂移会在 service 泛型使用点和组件 props 使用点
编译失败。

### 2.2 Lint：`pnpm lint`（oxlint）

oxlint 配置（`.oxlintrc.json`）启用了 `react` / `typescript` / `oxc`
插件，并显式开启两条 React 规则：

- `react/rules-of-hooks: "error"`（`.oxlintrc.json:5`）：Hook 必须在组件
  或自定义 Hook 顶层调用。这与分层约定互相印证——hooks 层
  （`src/hooks/useTodos.ts`）是 React 状态/effect 的唯一归属（见
  `docs/architecture.md` 第 3 节），在普通组件函数或工具函数里误用 Hook
  会被 lint 直接拦截。
- `react/only-export-components: ["warn", ...]` 且
  `allowConstantExport: true`（`.oxlintrc.json:6`）：组件文件默认只导出
  组件；与组件同文件导出常量是被显式允许的例外，现有代码就用了这个例外
  （`src/components/TodoBoard.tsx:7` 的 `TODO_BOARD_ARIA_LABEL` 常量与
  组件同文件导出）。

### 2.3 两道门禁的边界

类型检查和 lint 都不执行代码、不发起请求、不渲染组件：hook 的异步编排
（成功后更新状态、失败后的三种处理，见 `docs/architecture.md` 3.2）、
service 的 HTTP 行为、表单校验与归一化（`docs/architecture.md` 5.1）都
不在这两道门禁的拦截范围内。改动这些逻辑时，`pnpm build` 和 `pnpm lint`
通过不代表行为正确；这是当前验证手段的真实边界，新增测试时应优先覆盖
这条边界以内的行为。
