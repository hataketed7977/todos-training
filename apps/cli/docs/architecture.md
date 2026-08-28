# apps/cli 分层架构约定

本文记录 `apps/cli` 模块内部已经在执行、但从单个文件的 import 或类型声明上
看不出意图的分层约定。每条约定写明它约束什么、违反后会导致什么后果；后果均
指向当前代码或测试中的具体位置（路径相对 `apps/cli` 模块根目录）。模块定位
（供学员扩展的 CLI 底座，当前不发起网络请求）、技术栈与本地命令见
`apps/cli/AGENTS.md`，本文不重复。

## 1. 三个文件的职责划分

源码只有三个执行文件，职责边界固定：

- `src/index.ts`：入口，只做接线——构造 program 并运行
  （`src/index.ts:2-5`，shebang + `await runCli(createProgram())`），不含
  任何解析逻辑或错误处理。
- `src/cli/create-program.ts`：program 工厂，纯声明。创建并配置
  Commander program（名称、描述、出错后显示帮助、帮助选项排序）后返回
  （`src/cli/create-program.ts:3-14`）。它不读取 `process.argv`、不访问
  `process` 上的任何东西、不产生输出。
- `src/cli/run.ts`：执行器，拥有运行期副作用。对 program 执行
  `parseAsync`，捕获异常并负责失败时的退出码与错误输出
  （`src/cli/run.ts:8-13`）。

约束什么：**命令注册归 `createProgram`，解析与错误处理归 `runCli`，两者
之间通过返回值/参数连接**。新增子命令、选项、帮助配置，加在
`createProgram` 返回的 program 上；解析失败怎么办、写到哪里，只在 `runCli`
里决定。

违反后果：这个拆分是测试能够不启动子进程就验证 CLI 的前提（见
`src/test/cli.test.ts:7-11`：测试自己调 `createProgram()` 拿到 program，
再把自定义 argv 和错误输出函数传给 `runCli`）。如果把命令注册写进
`index.ts` 或 `runCli` 内部，测试就无法在解析之前拿到 program 实例去重定向
输出（`src/test/cli.test.ts:9` 的 `configureOutput`）和检查命令注册表
（`src/test/cli.test.ts:13`）；如果在 `createProgram` 里直接解析 argv，
工厂就不再可复用，测试也无法替换入参。

## 2. 运行期副作用通过参数注入，不直接依赖全局对象

`runCli` 的签名把两个运行期依赖做成带默认值的参数
（`src/cli/run.ts:3-7`）：

- `argv = process.argv`：待解析的参数数组；
- `writeError = console.error`：错误信息输出槽。

约束什么：业务代码（program 配置、命令动作）不直接读 `process.argv`、不
直接 `console.error`；需要这两个能力时经由 `runCli` 的参数。默认值保证
真实入口 `index.ts` 不传参也能工作（`src/index.ts:5`）。

违反后果：测试正是靠覆盖这两个参数实现进程内验证——传入
`['node', 'todos-cli', '--help']` 而不是真实 `process.argv`
（`src/test/cli.test.ts:11`），传入 `() => undefined` 吞掉错误输出
（`src/test/cli.test.ts:11`）。在命令代码里直接碰全局对象，测试就无法替换
它们，只能退化为 spawn 子进程再抓 stdout/stderr，而当前测试没有任何子进程
开销。

## 3. 失败时设置 exitCode，不调用 process.exit

`runCli` 捕获解析异常后，把错误消息交给 `writeError`，然后设置
`process.exitCode = 1`（`src/cli/run.ts:10-13`），全程不调用
`process.exit()`。

约束什么：命令动作和错误处理都通过“退出码 + 输出”表达失败，让 Node 进程
自然结束；不要在代码里强行终止进程。

违反后果：`process.exit()` 会立即终止当前进程——测试是在同一个 Node 进程
里 `await runCli(...)` 之后继续做断言的
（`src/test/cli.test.ts:11-14`），任何一处 `process.exit()` 都会直接杀掉
测试进程，后续断言无法执行。设置 `exitCode` 则让测试可以在解析完成后继续
检查 program 状态。

## 4. CLI 输出走 Commander 的输出通道

帮助文本等 CLI 输出由 Commander 产生，测试通过
`program.configureOutput({ writeOut })` 即可重定向捕获
（`src/test/cli.test.ts:9`），不需要拦截 `console.log`。

约束什么：面向用户的 CLI 文本（帮助、版本、选项说明）通过 Commander 的
配置和 action 的 Commander 上下文输出；在 program 构建路径上直接用
`console.log` 写用户可见内容，会绕开这条可重定向通道。

违反后果：`src/test/cli.test.ts:12` 对捕获到的输出做 `/Usage: todos-cli/`
正则断言，依赖帮助文本经过 Commander 的 `writeOut`；直接 `console.log`
的内容不会进入测试捕获的 `output` 数组，测试无法断言，也无法被
`configureOutput` 重定向。

## 5. 构建、测试与打包的边界

模块是编译后运行的 ESM 包，边界由 `package.json` 和 `tsconfig.json`
共同界定：

- 源码用 TypeScript 编写，`tsc` 编译到 `dist/`
  （`tsconfig.json:9-11`，`module`/`moduleResolution` 为 `NodeNext`，
  `strict: true`，`tsconfig.json:4-7`）；源码里的相对 import 带 `.js`
  后缀（`src/index.ts:2-3`），与编译产物的 ESM 解析一致。
- 可执行入口指向编译产物：`bin.todos-cli = ./dist/index.js`
  （`package.json:10-12`）。
- 发布包只含 `dist` 且排除编译后的测试：`files: ["dist", "!dist/test"]`
  （`package.json:6-9`）。测试源码放在 `src/test/` 一并编译进
  `dist/test/` 供本地运行，但不进入发布 tarball。

约束什么：测试与发布共享同一份编译产物——`pnpm test` 先 build 再用 Node
内置 test runner 运行 `dist/test/cli.test.js`（`package.json:16`），测的是
编译后的代码，不是 TS 源文件；因此测试 import 路径同样是 `.js`
（`src/test/cli.test.ts:3-4`）。

违反后果：在测试里 import `.ts` 路径或依赖 TS 运行时会与
`node --test dist/test/...` 的运行方式不兼容（测试目录下没有任何 TS loader
依赖，`package.json:22-26` 的 devDependencies 只有类型声明、rimraf 和
typescript）；把测试放到 `src/` 之外的非编译目录，`dist/test/` 不会生成，
`pnpm test` 指定的入口（`package.json:16`）直接失败；把运行时代码写进
`src/test/` 之外但被 `files` 覆盖的路径虽会发布，`!dist/test` 的排除意味着
测试目录是唯一“编译但不发布”的约定位置。

## 6. 当前底座的扩展点

program 当前不注册任何子命令（`src/cli/create-program.ts:6-13` 只有全局
配置），这一状态被测试钉住：`program.commands.length` 断言为 0，且帮助
输出不得出现业务命令词（`src/test/cli.test.ts:13-14`）。

约束什么：扩展 CLI 时，新子命令注册在 `createProgram` 内（见第 1 节），
遵循同样的副作用注入与输出通道约定（见第 2、4 节）；底座不发起网络请求，
新增网络能力属于功能扩展而非底座结构变更。

违反后果：新增子命令后，`src/test/cli.test.ts:13-14` 两条断言会失败——
这不是测试写错，而是该测试在显式守卫“底座只有帮助信息”的基线；扩展命令
时应同步更新这两条断言以描述新的命令表面（见 `docs/testing.md` 第 4 节）。
