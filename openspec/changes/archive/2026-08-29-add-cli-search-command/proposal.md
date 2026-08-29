## Why

当前 `apps/cli` 仅暴露帮助信息，不具备任何业务能力；同时后端 `GET /api/todos` 只能全量返回，用户在 CLI 中无法按标题快速定位任务。本变更为 CLI 增加按标题搜索 todos 的命令，并配套后端搜索过滤能力，让命令行用户能在终端中直接查询任务。

## What Changes

- 后端 `GET /api/todos` 新增可选查询参数 `title`，传入时对 todos 执行"标题包含关键词、大小写不敏感"的过滤，并仍按 `createdAt` 倒序返回；未传 `title` 时保持原有全量列表行为不变。
- 后端 `TodoRepository` 新增按标题模糊查询的方法（`findByTitleContainingIgnoreCaseOrderByCreatedAtDesc` 或等价 JPQL），`TodoService` 新增带 title 参数的搜索方法（无参数时委托现有 list）。
- 后端 `TodoController` 的 `list()` 方法接收可选 `@RequestParam title`，按是否传参决定调用 list 还是 search。
- CLI 新增 `search <keyword>` 子命令：接收必填的标题关键词位置参数，通过 HTTP GET 调用后端 `http://<api-base>/api/todos?title=<encoded-keyword>`，将返回的 todos 以文本表格形式输出（列：id、status、priority、title）。
- CLI 新增 `--api-url` 全局选项（默认值 `http://localhost:18080`），`search` 命令使用该选项作为 API 基地址；输出走 Commander 的 `writeOut` 通道，错误走 `writeError` 通道。
- CLI 新增网络层模块 `services/apiClient.ts`（ESM，fetch 调用），供 `search` 命令调用，测试时可替换 fetch 实现。
- CLI `package.json` 不新增依赖（使用 Node 20 内置 `fetch`）。

## Capabilities

### New Capabilities

- `cli-todo-search`：CLI `search` 子命令的行为规范——参数解析、API 基址配置、HTTP 调用、输出格式、错误处理与退出码。

### Modified Capabilities

- `todos`：修改 `GET /api/todos` 的行为——新增可选 `title` 查询参数，语义为"标题包含关键词且大小写不敏感"的过滤；无参数时保持原有全量倒序列表不变。

## Impact

- 后端：
  - `services/api/src/main/java/com/bytedance/todos/repository/TodoRepository.java`（新增搜索查询方法）
  - `services/api/src/main/java/com/bytedance/todos/service/TodoService.java`（新增带 title 参数的 search 方法）
  - `services/api/src/main/java/com/bytedance/todos/controller/TodoController.java`（list 接收 @RequestParam(required=false) title）
  - `services/api/src/test/java/com/bytedance/todos/controller/TodoControllerTest.java`（新增搜索过滤测试）
  - `services/api/docs/api-design.md`（端点清单补充 title 参数）
- CLI：
  - `apps/cli/src/cli/create-program.ts`（注册全局 --api-url 选项与 search 子命令）
  - `apps/cli/src/services/apiClient.ts`（新增 fetch 封装模块）
  - `apps/cli/src/cli/commands/search.ts`（新增 search 命令 action）
  - `apps/cli/src/test/cli.test.ts`（更新断言，验证 search 命令注册）
  - `apps/cli/src/test/search.test.ts`（新增 search 命令专项测试）
  - `apps/cli/docs/architecture.md`（补记新增文件的职责归属、fetch 注入测试约定）
  - `apps/cli/AGENTS.md`（更新模块说明：当前已发起网络请求）
- API 契约：`GET /api/todos` 增加可选 `title` query param；无 BREAKING 变更。
