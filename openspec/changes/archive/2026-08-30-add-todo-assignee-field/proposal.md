## Why

当前 Todo 的属性只有标题、描述、优先级与状态，没有「负责人/分配人」字段，无法在训练场景中演示"按责任归属分配任务"的协作流程，也导致看板中任务的归属信息缺失。本次变更与此前 description / priority 两字段同构，继续沿用 Todo 领域模型扩展的基线，不引入新的系统层概念。

## What Changes

- 在 Todo 领域模型、API 契约、Web UI、CLI 四层同步新增可选的 `assignee` 字段（纯自由文本，可空）。
- 后端：Flyway V3 migration 为 `todos` 表新增 `assignee VARCHAR(255) NULL` 列；TodoEntity、CreateTodoRequest、UpdateTodoRequest 新增对应字段；对输入执行 trim，trim 后空白或未提供 → NULL；创建时不提供 → NULL；更新时不提供/传 null/空白字符串 → 清空为 NULL（与 priority/description 同派）。
- Web：创建与编辑 Modal 新增「负责人」普通文本输入（非必填，可清空）；TodoCard 以现有 tertiary 文本样式在 priority 行下方展示 `负责人：xxx`（空时不渲染）；不引入颜色体系。
- CLI：`todos-cli create` 子命令新增 `-a, --assignee <name>` 选项并透传后端；`Todo` 接口新增 `assignee: string | null`；`search` 命令输出表格新增 `ASSIGNEE` 列（null 显示 `-`）。
- 列表保持按 `createdAt` 倒序，不受 assignee 影响。

### 明确的 Non-Goals（本次不做）

- 不引入用户/鉴权系统，不创建 `users` 表或 UserEntity。
- 不做负责人枚举、角色、头像、颜色标签。
- 不新增按负责人过滤的后端查询参数或前端看板筛选 UI。
- 不新增 CLI `update` / `assign` 子命令。
- 不做后端 API 按消费方的 URL 路径隔离（沿用现有 `/api/todos`）。
- 不改变列表排序规则，仍按 `createdAt` DESC。
- 不引入负责人下拉、@提及、[[链接]] 补全。

## Capabilities

### New Capabilities

（无）

### Modified Capabilities

- `todos`: Todo 实体、API、Web、CLI 均新增可空的 `assignee` 字段，包含其 trim→NULL 归一化、Create/Update 语义、Web 表单与卡片展示、CLI create/search 联动的全部 requirement 变更。

## Impact

- **数据库**：`services/api/src/main/resources/db/migration/` 新增 `V3__add_assignee.sql`（仅新增可空列 + 可选 CHECK 长度上限，存量行全部为 NULL）。
- **后端 Java 代码**：
  - `TodoEntity.java` 增加 `assignee` 字段、getter/setter、构造函数参数。
  - `CreateTodoRequest.java`、`UpdateTodoRequest.java` records 增加 `String assignee` 组件。
  - `TodoService.java`：`create` 与 `update` 方法增加 assignee 的 trim + 空→NULL 归一化逻辑；`update` 在未提供 assignee 时按"清空"语义（与 priority 对齐）。
  - `TodoController.java`：Controller 保持 `/api/todos` 路径不变，`list`/`create`/`update` 直接返回扩展后的 TodoEntity。
  - `TodoControllerTest.java`：新增 assignee 相关集成测试用例。
  - 新增 `ArchitectureTest.java`（如存在）中不添加任何新规则。
- **Web**：
  - `apps/web/src/types/todo.ts` 的 `Todo` 接口新增 `assignee: string | null`。
  - `apps/web/src/services/todosService.ts`：`createTodo` 与 `updateTodo` input/body 组装新增 `assignee`。
  - `apps/web/src/hooks/useTodos.ts`：`createTodo` 调用参数、`updateTodo` 调用参数新增 `assignee`。
  - `apps/web/src/i18n/zhCN.ts`：新增 `todoAssignee`、`assigneePlaceholder` 等文案常量。
  - 创建/编辑 Modal（CreateTodoModal 或等价组件）新增「负责人」单行文本输入。
  - `TodoCard.tsx` 新增负责人展示渲染。
- **CLI**：
  - `apps/cli/src/services/apiClient.ts`：`Todo` 接口 + `createTodo` 参数新增 `assignee`。
  - `apps/cli/src/cli/commands/create.ts`：注册 `-a, --assignee <name>` 选项（`.exitOverride()` 保持）。
  - `apps/cli/src/cli/commands/search.ts`：输出表格新增 `ASSIGNEE` 列。
- **文档**：
  - 根 `AGENTS.md` 领域模型 / API 契约节：新增 `assignee` 字段描述、长度、可空性、trim 规则、update 语义。
  - `services/api/docs/api-design.md`：端点清单补充 request/response 中 `assignee` 字段。
  - `apps/web/AGENTS.md` §"当前 Web 行为"：补充创建/编辑弹窗与卡片的负责人字段行为。
  - `apps/cli/AGENTS.md` §"模块说明" 与示例：补充 `-a/--assignee` 与 `ASSIGNEE` 列。
