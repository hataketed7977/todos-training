## 1. 后端数据库与领域模型

- [x] 1.1 新增 Flyway migration `V2__add_todo_fields.sql`：为 `todos` 表增加可空、无默认值的 `description VARCHAR(2000)` 与 `priority VARCHAR(255)`，并为 `priority` 添加 `CHECK (priority IN ('LOW','MEDIUM','HIGH'))` 约束
- [x] 1.2 新增枚举 `com.bytedance.todos.model.TodoPriority`，取值 `LOW / MEDIUM / HIGH`
- [x] 1.3 在 `Todo` 实体中新增 `description`（`@Column(length = 2000)`）与 `priority`（`@Enumerated(EnumType.STRING)`）字段，均不设初始值，并补充 getter/setter
- [x] 1.4 调整 `Todo` 构造器以支持注入 `description` 与 `priority`（保留或替换现有 `Todo(String title)` 构造器的调用点）

## 2. 后端 DTO 与服务

- [x] 2.1 在 `CreateTodoRequest` 中新增可选字段 `String description` 与 `TodoPriority priority`（不加 `@NotBlank`）
- [x] 2.2 在 `TodoService.create` 中对 `description` 执行 trim，并将空白串归一化为 `null`；`priority` 原样透传（可为 `null`，不做默认值兜底）
- [x] 2.3 保持 `UpdateTodoRequest` 与 `TodoService.update` 不变（仍只更新 title）

## 3. 后端测试

- [x] 3.1 在 `TodoControllerTest` 中新增用例：创建时携带 `description`（含首尾空白）与 `priority` 时响应正确返回 trim 后的描述与优先级
- [x] 3.2 新增用例：创建时不携带 `description`/`priority` 时响应中两者均为 `null`，且仅含空白的 `description` 被归一化为 `null`
- [x] 3.3 新增用例：非法 `priority` 取值（如 `URGENT`）返回 4xx
- [x] 3.4 运行 `./gradlew test --rerun-tasks` 确认全部通过

## 4. Web 类型与服务层

- [x] 4.1 在 `apps/web/src/types/todo.ts` 中新增 `TodoPriority` 类型（`'LOW' | 'MEDIUM' | 'HIGH'`）与 `todoPriorities` 常量，并为 `Todo` 接口增加 `description: string | null` 与 `priority: TodoPriority | null`
- [x] 4.2 在 `apps/web/src/services/todosService.ts` 中扩展 `createTodo` 入参，支持可选的 `description` 与 `priority`

## 5. Web 创建表单

- [x] 5.1 在 `apps/web/src/i18n/zhCN.ts` 中新增文案：描述、描述 placeholder、优先级、优先级 placeholder、低/中/高
- [x] 5.2 在 `CreateTodoModal` 表单中新增 `Form.TextArea`（描述，非必填）与 `Form.Select`（优先级，选项低/中/高，非必填、无默认选中、允许清空）
- [x] 5.3 提交时对描述做 trim，空白则不传或传 `null`，并将 `description`/`priority` 透传给 `onCreate`/`createTodo`

## 6. Web 卡片展示

- [x] 6.1 在 `TodoCard` 中，当 `priority` 非空时用现有 `Typography.Text` 普通样式展示优先级文本（不引入带颜色的 Tag/Badge，保持现有视觉）
- [x] 6.2 当 `description` 非空时用 `Typography.Paragraph` 次要样式展示描述，配置 `ellipsis` 截断，并以 Tooltip 提供完整内容
- [x] 6.3 确保 `description`/`priority` 为 `null` 时不渲染对应元素，存量卡片外观与变更前一致

## 7. 文档同步

- [x] 7.1 更新 `AGENTS.md` 领域模型章节：Todo fields 增加 `description`（可空，max 2000）与 `priority`（可空，LOW/MEDIUM/HIGH）
- [x] 7.2 更新 `AGENTS.md` API 契约：Create request 与 Todo response 增加两个可选/可空字段，并补充创建规则中对描述 trim 与优先级可空的说明
- [x] 7.3 确认文档不暗示编辑能力、排序变化或 CLI 变更

## 8. 验证

- [x] 8.1 运行 `cd services/api && ./gradlew test --rerun-tasks`
- [x] 8.2 运行 `cd apps/web && pnpm build`
- [x] 8.3 运行 `git diff --check`
- [x] 8.4 本地通过 `./scripts/dev.sh --reset` 启动，验证：只填标题可创建、带描述与优先级可创建、卡片正确展示、存量/空字段卡片外观不变
