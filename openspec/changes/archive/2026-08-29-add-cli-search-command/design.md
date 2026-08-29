## Context

当前项目为 monorepo，三个模块相互独立（跨模块约束见根 `docs/architecture.md`）：

- `services/api`：Java 21 + Spring Boot 3 + Spring Data JPA + H2 in-memory + Flyway。REST API 挂在 `/api/**`，CORS 放行 `/api/**`。现有端点：`GET/POST/PUT/DELETE /api/todos`。`TodoRepository` 当前仅有 `findAllByOrderByCreatedAtDesc` 一个自定义方法。
- `apps/cli`：Node.js 20 + TypeScript + Commander + pnpm。ESM 包，源码 `src/` 编译到 `dist/`。当前 `create-program.ts` 只做 program 全局配置，不注册任何子命令；`runCli` 负责解析、异常捕获与 `process.exitCode` 设置。测试通过 `createProgram()` + `runCli(argv, writeError)` 的注入模式在同一进程内运行，不 spawn 子进程。

本变更跨 `services/api` 与 `apps/cli` 两个模块：后端为 `GET /api/todos` 增加 `title` 查询过滤能力，CLI 新增 `search` 子命令作为该能力的首个消费者。

## Goals / Non-Goals

**Goals:**
- 后端 `GET /api/todos` 支持可选 `title` 参数，大小写不敏感过滤标题，保持倒序排序与无参数时的向后兼容。
- CLI 新增 `search <keyword>` 子命令，使用内置 `fetch` 调用后端并以文本表格输出，不新增任何运行时依赖。
- 严格遵守 CLI 分层约定（见 `apps/cli/docs/architecture.md`）：命令注册在 `createProgram`、输出走 Commander 通道、失败只设 `exitCode` 不调 `process.exit`、测试可替换 fetch 与输出槽。
- 同步更新受影响的模块文档（API 端点清单、CLI 架构约定、CLI AGENTS 能力说明）。

**Non-Goals:**
- 不引入按描述搜索、按状态/优先级筛选、正则或模糊匹配等其他搜索维度。
- 不支持分页、排序参数、JSON/YAML 输出格式切换等高级 CLI 特性。
- 不为 CLI 引入认证、token、HTTPS 证书校验等能力。
- 不修改数据库 schema（无需 Flyway migration）。
- 不改变 `apps/web` 模块（Web 端不消费新的过滤能力）。

## Decisions

### D1. 后端过滤：复用 GET /api/todos + @RequestParam，不新增独立搜索路径

**选择：** 在现有 `TodoController#list()` 上新增 `@RequestParam(required = false) String title`，按是否非空决定调用 `TodoService#search(title)` 还是 `TodoService#list()`。

**原因：**
- 符合 REST 语义：`/api/todos` 是资源集合，查询参数表达过滤条件，路径中无动作词（遵循 `api-design.md` 第 2 节）。
- 向后兼容：不传参数时行为与之前完全一致，不破坏现有 `apps/web` 消费方。
- 无需新路由、新 DTO、新状态码；改动最小，测试易写。

**备选：**
- `GET /api/todos/search?title=xxx` 独立路径 —— 放弃，动作词出现在路径中违反既定命名约定；新增 controller 方法和路由注册成本更高。
- `GET /api/search?title=xxx` 顶层搜索资源 —— 放弃，离集合更远，与现有路径风格不一致。

### D2. 查询方法：Spring Data JPA 派生查询 ContainingIgnoreCase

**选择：** 在 `TodoRepository` 新增 `List<Todo> findByTitleContainingIgnoreCaseOrderByCreatedAtDesc(String title);`。

**原因：**
- 无需手写 JPQL；方法名派生直接生成 `LOWER(title) LIKE LOWER(CONCAT('%', ?, '%')) ORDER BY created_at DESC`，与"大小写不敏感包含"语义精确对齐。
- 排序子句 `OrderByCreatedAtDesc` 写在方法名里，与 `list()` 的 `findAllByOrderByCreatedAtDesc` 对称，保证搜索结果与全量列表排序一致。
- H2 数据库内置 `LIKE` 与 `LOWER` 支持，无需额外函数注册。

**备选：** `@Query` 手写 JPQL —— 放弃，方法名派生已足够，手写 JPQL 增加维护成本。

### D3. Service 层：search(title) 方法内部做空白归一化

**选择：** `TodoService` 新增 `search(String title)`：对入参先 `trim()`，若 trim 后为 `isEmpty()` 则直接委托 `list()` 走全量路径，否则调用 repository 的搜索方法。`TodoController` 不做字符串处理，只透传。

**原因：**
- 与 `TodoService#create` / `#update` 中对 `description` 的 trim 归一化处理模式一致（分层原则：业务规则归 service，见 `services/api/docs/architecture.md` 2.1）。
- controller 保持轻量：只接收参数、选择方法、返回结果，不混入 if-else 分支。

### D4. CLI 新增文件：src/services/apiClient.ts + src/cli/commands/search.ts

**选择：** 新增两个源文件：
1. `src/services/apiClient.ts`：导出 `fetchTodosByTitle({ apiUrl, title, fetchImpl })` 函数，封装 URL 拼接、encodeURIComponent、Accept 头、fetch 调用、2xx 判定、JSON 解析与错误抛出自定义类型。`fetchImpl` 可选参数默认取全局 `fetch`，测试时可替换。
2. `src/cli/commands/search.ts`：导出 `registerSearchCommand(program: Command): void`，在 program 上注册 `search <keyword>` 子命令与 action；action 通过 Commander 的 `program.getOptionValue('apiUrl')` 读取全局选项。

`create-program.ts` 改为：
- 顶部 `import { registerSearchCommand } from './commands/search.js'`
- 在返回 program 之前 `program.option('--api-url <url>', 'API base URL', 'http://localhost:18080')`，然后 `registerSearchCommand(program)`。

**原因：**
- 遵循单一职责：`apiClient` 只关心 HTTP，`commands/search` 只关心 Commander 注册与 action，`createProgram` 只负责装配。
- 与 `apps/cli/docs/architecture.md` 第 1 节"命令注册归 createProgram"兼容：create-program 内调用注册函数即可，不把 action 逻辑嵌进去。
- `fetchImpl` 注入符合第 2 节"运行期副作用通过参数注入"约定；测试不碰网络。

**备选：**
- 把所有逻辑直接写在 `create-program.ts` 里 —— 放弃，单文件膨胀，违反分层，测试难拆。
- 新增 `src/http/` 目录而不是 `src/services/` —— 放弃，当前模块只有 `cli/`、`test/` 两类子目录，`services/` 与前端 `apps/web` 目录命名一致，更直观。

### D5. 表格输出：手动 format，不引 table 库

**选择：** 先算各列最大宽度（ID 列按最长数字，STATUS 固定 5，PRIORITY 固定 6 或按最长字符串，TITLE 按最长标题），然后 `writeOut(`${id.padEnd(idW)} ${s.padEnd(stW)} ${p.padEnd(prW)} ${t}`)` 逐行输出。

**原因：**
- CLI 当前只有 `commander` 一个运行时依赖（`package.json:19-21`），新增 table / cli-table3 会引入额外依赖。
- 四列简单文本对齐，手写 10~15 行即可覆盖，依赖引入收益不高。
- Node 20 环境没有任何原生 table API，所以不引包就是最小实现。

### D6. 测试策略：后端全栈集成 + CLI 注入 fetch mock

**后端测试（`TodoControllerTest`）：**
沿用现有全栈集成测试形态（`@SpringBootTest` + `MockMvc`，无 mock）。新增至少 4 条用例，对应 spec 中 todos 的 4 个搜索 scenario：
1. 精确单匹配
2. 大小写不敏感多匹配 + 排序
3. 无匹配返回空数组
4. 空白关键词回退全量
另加一条"不传 title 保持原行为"（scenario 5），可通过与原 list 结果长度做断言。

**CLI 测试：**
- 更新 `cli.test.ts`：原断言 `program.commands.length === 0` 与 `doesNotMatch /list|add/` 改成 `commands.length >= 1` 并断言 `commands[0].name() === 'search'`。
- 新增 `src/test/search.test.ts`：
  - `createProgram()` + 覆盖 `configureOutput(writeOut, writeErr)`
  - 注入自定义 `fetchImpl`：模拟 2xx 返回 Todo 数组、空数组、500、抛异常四种
  - 断言 `writeOut` / `writeError` 内容符合 spec 中的 scenario
  - 断言 `process.exitCode` 正确（或保持 0）

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| `ContainingIgnoreCase` 在不同数据库下的行为差异 | H2 与真实生产库（如 PostgreSQL）的 `LOWER(LIKE)` 对 Unicode 处理可能不一致 | 当前项目约定使用 H2 in-memory 训练（`services/api/AGENTS.md` §数据库），生产替换场景不在 change 范围内；如后续切换 DB，加测试即可 |
| CLI 用户 keyword 含特殊字符（&、=、空格、中文）导致 URL 拼接错误 | 请求发到后端时参数被截断或误解析 | 严格使用 `encodeURIComponent`，测试覆盖含空格中文的 scenario（spec 已覆盖） |
| fetch 实现依赖 Node 20 内置全局；在低于 Node 20 的环境下未定义 | `fetchImpl is not a function` 报错 | `package.json` 已声明 `"engines": { "node": ">=20" }`（第 31-33 行），且模块 AGENTS 明定 Node 20+；不额外 polyfill |
| 测试直接设置 `process.exitCode = 1` 导致后续测试污染 | 同一进程内多个测试，一个失败场景会改全局 exitCode | 在 search.test.ts 每个 case 的 setup/teardown 里显式 `process.exitCode = 0` 重置 |
| 命令输出列太宽，终端换行导致对齐错位 | 长 title 时表格观感差 | 当前标题无长度上限（DB 端 title 未限长），但训练场景下 title 通常较短；不做截断，保持信息完整 |

## Migration Plan

无数据库 schema 变更（无需 Flyway migration），纯代码发布：

1. **后端（services/api）**：
   - `TodoRepository` 加搜索派生方法；`TodoService` 加 `search(title)` 方法；`TodoController#list` 加 `@RequestParam`。
   - `TodoControllerTest` 补 5 条搜索用例。
   - `docs/api-design.md` 端点清单补 `GET /api/todos` 的 title query param。
   - 验证：`cd services/api && ./gradlew test --rerun-tasks`。

2. **CLI（apps/cli）**：
   - 新建 `src/services/apiClient.ts` 与 `src/cli/commands/search.ts`。
   - 修改 `create-program.ts`：注册 `--api-url` 全局选项 + 调用 `registerSearchCommand(program)`。
   - 更新 `cli.test.ts` 中 `commands.length === 0` 的基线断言。
   - 新建 `src/test/search.test.ts` 覆盖 spec 中 7 个 CLI scenario。
   - `docs/architecture.md` 补记新增文件职责、全局选项约定、fetchImpl 注入测试约定。
   - `AGENTS.md` 修正"底座不发起网络请求"文案为已支持 search 命令。
   - 验证：`cd apps/cli && pnpm build && pnpm test`。

3. **手动联调（可选）**：
   - `./scripts/dev.sh` 启动 api + web，创建若干带不同标题的 todo。
   - `cd apps/cli && pnpm build:install`，`todos-cli search <关键词>` 观察输出。

**回滚策略：** 两模块代码相互独立，可分别 revert commit；无数据迁移，无状态风险。

## Open Questions

无。关键技术决策（查询参数 vs 独立路径、方法名派生 vs JPQL、fetchImpl 注入、无 table 库）在设计中已确定并给出取舍依据。
