# apps/cli 测试策略

本文规定 `apps/cli` 模块的测试组织方式，分层口径与
`apps/cli/docs/architecture.md` 一致。每条判断依据都指向现有测试代码或配置
的具体位置（路径相对 `apps/cli` 模块根目录）；指不到证据的规则不写。本地
命令见 `apps/cli/AGENTS.md`，本文不重复。

## 1. 测试框架与运行方式

- 使用 Node.js 内置测试运行器和断言库：`node:test` 的 `test`
  （`src/test/cli.test.ts:2`）与 `node:assert/strict`
  （`src/test/cli.test.ts:1`）。模块没有任何第三方测试依赖
  （`package.json:22-26` 的 devDependencies 只有 `@types/node`、`rimraf`、
  `typescript`），不引入 Jest、Vitest 等框架。
- 测试跑在编译产物上：`pnpm test` 先 build，再执行
  `node --test dist/test/cli.test.js`（`package.json:16`）。因此测试文件是
  TypeScript，经 `tsc` 编译到 `dist/test/` 后由 Node 直接运行，import 路径
  使用 `.js` 后缀（`src/test/cli.test.ts:3-4`），与生产入口
  （`src/index.ts:2-3`）遵循同一套 NodeNext ESM 解析。

约束什么：新增测试沿用 `node:test` + `node:assert/strict`，测试源码放在
会被编译的位置（见第 5 节），不引入新依赖。

## 2. 测试形态：进程内构造 program，不 spawn 命令行

唯一现存的测试展示了本模块的标准测试形态
（`src/test/cli.test.ts:6-15`）：

1. 用工厂函数在测试进程内构造 program：`const program = createProgram()`
   （`cli.test.ts:7`）；
2. 重定向 Commander 的标准输出到数组：
   `program.configureOutput({ writeOut: ... })`（`cli.test.ts:9`）；
3. 调用 `runCli(program, argv, writeError)`，argv 显式传入
   `['node', 'todos-cli', '--help']`，错误输出传入 no-op
   （`cli.test.ts:11`）；
4. `await` 运行完成后做断言。

判断依据：这种形态成立是因为架构约定把副作用做成了可注入参数——argv 和
错误输出槽由 `runCli` 参数提供（见 `docs/architecture.md` 第 2 节），输出
走 Commander 通道（第 4 节），失败只设 `exitCode` 不终止进程（第 3 节）。
因此测试不需要 spawn 子进程、不需要抓真实进程的 stdout/stderr，也不需要
mock：测试中没有任何 mock 框架或模块替换。

约束什么：新增测试同样以“构造 program → 注入 argv/输出槽 → 断言可观察
结果”的方式写，而不是 `child_process` 执行 `todos-cli`。

## 3. 断言对象：CLI 的公共表面，不是内部函数

测试断言的是用户可见的命令行表面，有三类断言锚点：

- **输出文本**：对捕获的输出做正则匹配，如帮助包含
  `/Usage: todos-cli/`（`cli.test.ts:12`）。
- **命令注册表**：检查 `program.commands` 的状态
  （`cli.test.ts:13` 断言长度为 0）。
- **输出中不出现的内容**：`assert.doesNotMatch` 保证帮助里没有业务命令词
  （`cli.test.ts:14`）。

判断依据：`createProgram` / `runCli` 的内部分解是实现手段（见
`docs/architecture.md` 第 1 节），CLI 对用户的契约是“给定 argv，产生什么
输出、注册了什么命令、以什么退出码结束”。测试只锁定这个契约，内部重构
（重命名、拆分配置）只要不改变命令行表面，测试不需要改动。

## 4. 哪些改动必须补或改测试

以下触发条件均能在现有测试中找到对应的断言锚点：

- **注册、移除或重命名子命令**：命令注册表断言
  （`cli.test.ts:13`）和帮助输出断言（`cli.test.ts:12,14`）描述的就是
  命令表面；新增子命令时这两处断言必须同步更新为新的契约（当前它们守卫
  “底座只有帮助”的基线，见 `docs/architecture.md` 第 6 节），而不是删掉
  断言。
- **改动 program 的名称、描述、帮助或选项配置**：帮助文本断言
  （`cli.test.ts:12`）依赖这些配置渲染出的 `Usage:` 行。
- **改动 `runCli` 的失败行为**：错误信息走注入的 `writeError`、失败设置
  `exitCode` 而非终止进程（见 `docs/architecture.md` 第 2、3 节），测试
  依赖“`await runCli(...)` 之后进程仍在运行、断言继续执行”
  （`cli.test.ts:11-14`）；改动这条路径时，测试必须能在不被杀进程的情况
  下验证失败输出。
- **改动构建/打包边界**：测试入口是编译产物 `dist/test/cli.test.js`
  （`package.json:16`），新增测试文件必须落在会被编译进 `dist/test/` 的
  位置，否则 `pnpm test` 找不到测试。

## 5. 测试文件的位置与命名

- 测试源码放在 `src/test/` 目录，文件名形如 `<name>.test.ts`；编译后对应
  `dist/test/<name>.test.js`，`package.json:16` 的 test 脚本使用
  `node --test dist/test/*.test.js`（由 shell 展开的 glob 模式），因此只要
  源文件落在 `src/test/*.test.ts` 下，就会被自动执行；现状：
  `src/test/cli.test.ts` 与 `src/test/search.test.ts` 分别编译为
  `dist/test/cli.test.js` 与 `dist/test/search.test.js`，二者均随
  `pnpm test` 一同运行。
- 测试文件与生产代码共享 `tsconfig.json`（`include: ["src/**/*.ts"]`，
  `tsconfig.json:13`），类型检查和编译覆盖测试代码；不需要为测试单独维护
  编译配置。
- 测试方法名陈述被验证的命令行行为，如
  `the CLI base exposes help without business commands`
  （`cli.test.ts:6`），不按内部函数名命名。
