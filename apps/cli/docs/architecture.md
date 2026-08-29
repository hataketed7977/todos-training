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

除 argv 与 writeError 外，业务模块新增的网络层函数（如 `fetchTodosByTitle`）还支持把 `fetch` 实现作为参数注入（`src/services/apiClient.ts` 中的 `fetchImpl?: FetchLike`，默认取全局 `fetch`），以避免测试发起真实网络请求。违反后果：search.test.ts 中 5 个 case 均依赖注入假 `fetchImpl` 返回构造数据（见 `src/test/search.test.ts` 的 `makeProgramWithFetch`），若直接在 apiClient 内调用 `globalThis.fetch` 而不提供注入点，测试只能通过 monkey-patch 全局 fetch，易在同一进程内相互污染。

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

`createProgram` 在 program 上调用 `.exitOverride()`
（`src/cli/create-program.ts:10`），这保证 Commander 在遇到解析错误、
帮助显示、版本显示时一律抛异常，绝不内部调用 `process.exit()` 强杀进
程；随后这些异常由 `runCli` 统一捕获。
`runCli` 捕获解析异常后（`src/cli/run.ts:12-20`），读取异常对象上的
`exitCode` 属性（Commander 抛出的 CommanderError 自带该属性，如
`commander.helpDisplayed` 的 exitCode 为 0、缺参错误为 1），无属性时
兜底为 1。仅当最终 exitCode 非 0 时，`runCli` 才把错误消息通过
`writeError` 参数写出；无论是否写错误消息，都设置
`process.exitCode = <exitCode>`。全程不调用 `process.exit()`。

约束什么：命令动作和错误处理都通过"退出码 + 输出"表达失败，让 Node 进程
自然结束；不要在代码里强行终止进程。Commander 的正常/异常分支统一走
throw → catch → exitCode 这条路径。

违反后果：若去掉 `.exitOverride()`，Commander 会在解析错误/帮助分支上
直接 `process.exit(code)`。由于测试是在同一 Node 进程里
`await runCli(...)` 之后继续断言（`src/test/cli.test.ts:7-14` 与
`src/test/search.test.ts` 各 case），任何一处 `process.exit()` 都会把
测试进程当场杀掉，后续断言、后续用例全部无法执行。改用
`process.exitCode` 并加 `.exitOverride()`，测试才能在解析完成后继续
检查 program 状态、错误输出和退出码。

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
这不是测试写错，而是该测试在显式守卫"底座只有帮助信息"的基线；扩展命令
时应同步更新这两条断言以描述新的命令表面（见 `docs/testing.md` 第 4 节）。
印证：`src/test/cli.test.ts:12-14` 已更新为断言 `commands[0].name() === 'search'` 并匹配帮助含"按标题搜索 todos"。

## 7. 新增目录与全局选项

源码下新增两类目录，职责固定：
- `src/services/`（如 `src/services/apiClient.ts`）：仅承载纯业务资源访问（HTTP、IO 封装），不依赖 Commander、不读 `process` 全局、不写 `console`。每个导出函数的运行期副作用（如 fetch 实现）必须通过参数注入。
- `src/cli/commands/`（如 `src/cli/commands/search.ts`）：每个文件导出一个 `register<Name>Command(program, options?)` 函数，只做一件事——在传入的 Commander program 上注册一个子命令和它的 action。action 内部必须通过 `program.getOptionValue(...)` 读取全局选项，通过 Commander 的 `configureOutput._writeOut/_writeErr` 访问输出通道（或同等 Commander API），不得直接 `process.stdout/stderr` 或 `console.log/error`。

全局 `--api-url <url>` 选项注册在 program 顶层（`src/cli/create-program.ts:11`），默认值 `http://localhost:18080`，所有需要调用后端的子命令均 MUST 通过 `program.getOptionValue('apiUrl')` 读取该值而不得硬编码。

约束什么：新目录下的文件必须按职责分类，不得把 HTTP 封装混进 command action，不得把 Commander 依赖渗进 services 层。违反后果：测试无法独立替换 fetch 实现（services 读了 Commander 状态）；命令 action 内直接写 stdout 会导致 `configureOutput(writeOut)` 捕获不到输出，search.test.ts 的捕获断言失效（见 `src/test/search.test.ts` 各 case 对 out/err 数组的断言）。
