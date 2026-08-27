## Why

当前 Todo 只有 `title` 和 `status`，无法记录任务的详细说明，也无法区分任务的轻重缓急。为了让看板承载更真实的任务信息，需要给 Todo 增加 `description`（描述）和 `priority`（优先级）两个字段。

## What Changes

- Todo 领域模型新增两个可选字段：
  - `description`：任务描述，自由文本，可空。
  - `priority`：任务优先级，取值 `LOW` / `MEDIUM` / `HIGH`，可空。
- 后端通过新的 Flyway migration 为 `todos` 表增加两列，均 nullable、无默认值；存量数据两列均为 `NULL`。
- `POST /api/todos` 请求体可选携带 `description` 和 `priority`；后端对 `description` 做 trim，空白字符串归一化为 `null`。
- Web 端创建弹窗新增"描述"输入（多行，非必填）和"优先级"选择（非必填，可不选）。
- Web 端卡片在现有展示逻辑基础上呈现已填写的描述与优先级；不引入新的颜色体系或视觉改造。
- 不改变列表排序（仍按 `createdAt` 倒序），不改变状态工作流，不新增编辑入口。
- CLI 不做改动。

## Capabilities

### New Capabilities
- `todos`: Todo 任务的领域模型与创建/查询契约，包括 title、status、description、priority 等字段及其校验、归一化和持久化规则。

### Modified Capabilities
<!-- 无既有 spec。 -->

## Impact

- **services/api**：新增 Flyway V2 migration；`Todo` 实体新增字段；新增 `TodoPriority` 枚举；`CreateTodoRequest` 新增可选字段；`TodoService.create` 处理新字段归一化；补充 controller 测试。
- **apps/web**：`types/todo.ts`、`services/todosService.ts` 扩展字段；`CreateTodoModal` 新增描述与优先级输入；`TodoCard` 呈现新字段；`i18n/zhCN.ts` 新增文案。
- **API 契约**：`POST /api/todos` 请求体扩展两个可选字段；Todo 响应体扩展两个可空字段。`PATCH` 不变。
- **apps/cli**：无影响。
- **文档**：`AGENTS.md` 的领域模型与 API 契约章节需同步更新。
