## 1. 后端 Repository 与 Service 层扩展

- [x] 1.1 在 `services/api/src/main/java/com/bytedance/todos/repository/TodoRepository.java` 新增派生查询方法：`List<Todo> findByTitleContainingIgnoreCaseOrderByCreatedAtDesc(String title)`
- [x] 1.2 在 `services/api/src/main/java/com/bytedance/todos/service/TodoService.java` 新增 `@Transactional(readOnly = true) List<Todo> search(String title)` 方法：对 title 做 `trim()`，若 trim 后为空则委托 `list()`，否则调用 repository 的派生搜索方法

## 2. 后端 Controller 接入搜索参数

- [x] 2.1 修改 `services/api/src/main/java/com/bytedance/todos/controller/TodoController.java` 的 `list()`：新增 `@RequestParam(name = "title", required = false) String title` 参数；title 为 null 时调用 `todoService.list()`，否则调用 `todoService.search(title)`

## 3. 后端 TodoControllerTest 搜索用例

- [x] 3.1 在 `services/api/src/test/java/com/bytedance/todos/controller/TodoControllerTest.java` 新增 5 条测试：title 精确单匹配、大小写不敏感多匹配且按 createdAt 倒序、无匹配返回 `[]`、title 全空白时回退全量列表、不传 title 保持原全量行为

## 4. 后端 API 设计文档更新

- [x] 4.1 更新 `services/api/docs/api-design.md` §1 端点清单：`GET /api/todos` 行补充"可选 `title` 查询参数，语义为标题包含且大小写不敏感的过滤；无参数时返回全量"的描述

## 5. CLI 网络层与 search 命令实现

- [x] 5.1 新建 `apps/cli/src/services/apiClient.ts`（ESM，TypeScript）：导出 `fetchTodosByTitle({ apiUrl, title, fetchImpl })`，内部拼接 URL、`encodeURIComponent(title)`、携带 `Accept: application/json`、判定 2xx、JSON 解析；`fetchImpl` 默认取全局 `fetch`，抛出自定义错误区分"网络异常"与"HTTP 非 2xx"两类
- [x] 5.2 新建 `apps/cli/src/cli/commands/search.ts`：导出 `registerSearchCommand(program: Command)`，注册 `search <keyword>` 子命令，帮助文案为"按标题搜索 todos"；action 内通过 `program.getOptionValue('apiUrl')` 读取基址，调用 `fetchTodosByTitle`，成功时用 Commander `writeOut` 输出 "Found N todo(s)" 加 ID/STATUS/PRIORITY/TITLE 四列左对齐表格（priority 为 null 显示 `-`，空结果显示 "No todos found."），失败时通过 `writeError` 输出对应错误并设置 `process.exitCode = 1`（不直接调用 `process.exit()`）
- [x] 5.3 修改 `apps/cli/src/cli/create-program.ts`：在 program 上注册全局选项 `.option('--api-url <url>', 'API base URL', 'http://localhost:18080')`，随后调用 `registerSearchCommand(program)`（import 路径加 `.js` 后缀，保持 NodeNext ESM 一致）

## 6. CLI 测试运行器配置

- [x] 6.1 修改 `apps/cli/package.json` 的 `scripts.test`：将 `"node --test dist/test/cli.test.js"` 改为 `"node --test dist/test/"`，使新增的 `search.test.ts` 编译产物也被执行

## 7. CLI 测试代码

- [x] 7.1 更新 `apps/cli/src/test/cli.test.ts`：将 `assert.equal(program.commands.length, 0)` 改为断言 `program.commands.length >= 1` 且 `program.commands[0].name() === 'search'`；将 `assert.doesNotMatch(output.join(''), /list|add/)` 替换为对帮助输出 `assert.match(output.join(''), /search.*按标题搜索 todos/)`
- [x] 7.2 新建 `apps/cli/src/test/search.test.ts`（使用 `node:test` + `node:assert/strict`）：每个 case setup 重置 `process.exitCode = 0`；覆盖 6 个场景：(a) 正常两条结果→输出含"Found 2"表格且第二条 priority 为 `-`；(b) 空数组→输出"No todos found." 且 exitCode 0；(c) fetch 抛异常→writeError 含"Failed to reach API"且 exitCode 1；(d) 非 2xx（500）→writeError 含"Search failed with status 500"且 exitCode 1；(e) 缺少 keyword 位置参数→Commander 报错且 exitCode 非零；(f) `--api-url` 自定义值生效→注入的 fetchImpl 收到对应 URL 与编码后的 title 参数；全部用"构造 program→注入 writeOut/writeError 和自定义 fetchImpl→await runCli→断言"形态

## 8. CLI 模块文档更新

- [x] 8.1 更新 `apps/cli/docs/architecture.md`：补记新增 `src/services/` 目录（apiClient，HTTP 封装、`fetchImpl` 可注入）与 `src/cli/commands/` 目录（子命令注册函数，action 不读全局 argv/console）的职责归属与违反后果；新增第 7 节说明全局 `--api-url` 选项的注册位置、默认值与在子命令中的读取方式，并在 §2 中追加 `fetchImpl` 注入与 §6 中追加"新增命令→cli.test.ts 命令注册表断言同步更新"的印证
- [x] 8.2 更新 `apps/cli/AGENTS.md` §"模块说明"：将"当前底座只提供帮助信息，不发起任何网络请求"改为"当前底座提供帮助信息与 `search` 子命令；`search` 通过内置 `fetch` 调用 `services/api` 的 `GET /api/todos?title=xxx`"，并同步 `todos-cli search --help` 使用示例
- [x] 8.3 更新 `apps/cli/docs/testing.md` §5"测试文件的位置与命名"：将 `package.json:16` 的印证从单文件 `dist/test/cli.test.js` 更新为目录 glob `dist/test/`，并说明新增 `*.test.ts` 文件只要落在 `src/test/` 下即会被自动执行

## 9. 本地验证

- [x] 9.1 运行 `cd services/api && ./gradlew test --rerun-tasks`，确认所有搜索用例与既有用例均通过
- [x] 9.2 运行 `cd apps/cli && pnpm build && pnpm test`，确认 cli.test.ts 与 search.test.ts 全部通过，无 TypeScript 编译错误
