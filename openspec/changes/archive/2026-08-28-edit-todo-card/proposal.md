## Why

当前 Todo 看板仅支持创建与删除任务，一旦创建后标题、描述或优先级有误无法修正，用户只能通过删除重建的方式纠错，体验不佳。本变更为 Todo 卡片增加编辑能力，支持修改标题、描述与优先级，保存后即时刷新列表。

## What Changes

- 后端新增 `PUT /api/todos/{id}` 接口，接收 title（必填）、description（可空）、priority（可空），返回更新后的 Todo。找不到目标时返回 404。
- 后端新增 `UpdateTodoRequest` DTO 与 `TodoService#update` 方法；description 执行与创建一致的 trim + 空白归一化（空字符串→NULL）。
- Web 前端 TodoCard 在 hover 时显示编辑图标（与删除按钮一致的交互方式），点击打开编辑弹窗。
- 编辑弹窗复用创建弹窗的表单结构（标题、描述、优先级），打开时预填当前 Todo 值；保存后乐观更新本地列表，失败时回退为全量刷新。
- 新增编辑相关 i18n 文案、loading 状态（`updating` Set）及 Toast 反馈。
- CORS 配置已放行 `PUT`（当前允许 `GET, POST, PATCH, DELETE, OPTIONS`，补加 `PUT`）。

## Capabilities

### New Capabilities

（无新增能力目录）

### Modified Capabilities

- `todos`: 新增"编辑 Todo"能力：后端 PUT 更新接口、前端卡片编辑入口、编辑弹窗、保存后列表刷新。涉及标题/描述/优先级三字段的修改语义与空值归一化。

## Impact

- 后端：
  - `services/api/src/main/java/com/bytedance/todos/controller/TodoController.java`
  - `services/api/src/main/java/com/bytedance/todos/service/TodoService.java`
  - `services/api/src/main/java/com/bytedance/todos/dto/UpdateTodoRequest.java`（新增）
  - `services/api/src/main/java/com/bytedance/todos/config/WebConfig.java`（allowedMethods 补加 PUT）
  - `services/api/src/test/java/com/bytedance/todos/controller/TodoControllerTest.java`（新增测试）
- 前端：
  - `apps/web/src/services/todosService.ts`（新增 updateTodo）
  - `apps/web/src/hooks/useTodos.ts`（新增 updating 状态与 updateTodo）
  - `apps/web/src/components/TodoCard.tsx`（新增编辑入口）
  - `apps/web/src/components/CreateTodoModal.tsx`（支持 edit mode）
  - `apps/web/src/components/TodoBoard.tsx`、`BoardColumn.tsx`、`TodosBoardPage.tsx`（props 传递）
  - `apps/web/src/i18n/zhCN.ts`（新增编辑文案）
- API：新增 `PUT /api/todos/{id}`，不涉及 schema migration。
