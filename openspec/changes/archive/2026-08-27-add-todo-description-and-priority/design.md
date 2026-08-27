## Context

当前 Todo 是一个极简实体：`id / title / status / createdAt / updatedAt`。`services/api` 用 Spring Boot 3 + Spring Data JPA + Flyway + H2，schema 由 [V1__create_todos.sql](file:///Users/bytedance/workspace/bytedance/todos-training/services/api/src/main/resources/db/migration/V1__create_todos.sql) 管理，`status` 列用 `VARCHAR` + `CHECK` 约束，JPA 端用 `@Enumerated(EnumType.STRING)`。Hibernate 配置为 `ddl-auto: validate`，不自动改 schema。

创建流程在 [TodoService.create](file:///Users/bytedance/workspace/bytedance/todos-training/services/api/src/main/java/com/bytedance/todos/service/TodoService.java#L30-L33)：trim title，status 强制为 `TODO`。Web 创建弹窗 [CreateTodoModal.tsx](file:///Users/bytedance/workspace/bytedance/todos-training/apps/web/src/components/CreateTodoModal.tsx) 目前只有一个 title input；卡片 [TodoCard.tsx](file:///Users/bytedance/workspace/bytedance/todos-training/apps/web/src/components/TodoCard.tsx) 只渲染 title。

本次需求是纯粹的字段扩展：新增 `description` 与 `priority`，两者均可空、无默认值，不引入排序、颜色、编辑能力等额外行为。

## Goals / Non-Goals

**Goals:**
- 在数据库、后端实体/DTO/服务、Web 类型/创建表单/卡片展示上端到端打通两个新字段。
- 字段可空：客户端可以不传，存量数据保持 `NULL`。
- `description` 与 `title` 一样做 trim，但空白串归一化为 `null`（描述允许不填）。
- `priority` 取值受控（`LOW/MEDIUM/HIGH`），与 `status` 采用相同的存储与约束惯例。
- 保持三个模块（web / cli / api）独立，不引入 shared package。

**Non-Goals:**
- 不实现编辑入口；`PATCH /api/todos/{id}` 保持只更新 title。
- 不改变列表排序（仍 `createdAt DESC`）。
- 不改变状态工作流（新建仍为 `TODO`）。
- 不做 CLI 改动。
- 不引入新的颜色体系、优先级排序或视觉重构。
- 不做字段长度校验之外的复杂校验。

## Decisions

### D1. 数据库列设计：nullable、无默认值

新增 Flyway V2 migration：

```sql
ALTER TABLE todos ADD COLUMN description VARCHAR(2000);
ALTER TABLE todos ADD COLUMN priority VARCHAR(255);
ALTER TABLE todos ADD CONSTRAINT chk_todos_priority
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH'));
```

- 两列均 nullable 且无 `DEFAULT`，符合用户"存量数据与未传值均为空"的要求。
- `priority` 加 `CHECK` 约束，与既有 `chk_todos_status` 对称，保证枚举值干净；未来扩展取值需新增 migration，demo 阶段可接受。
- `description` 用 `VARCHAR(2000)`，H2/PostgreSQL 通用，无需引入 `@Lob`。
- 不加索引：优先级暂不参与查询/排序。

备选方案：`priority` 不加 CHECK（更灵活但可能写入脏值）；用整型权重（排序方便但语义差）。均不采纳。

### D2. 后端枚举与实体

新增 `TodoPriority { LOW, MEDIUM, HIGH }`，与 [TodoStatus](file:///Users/bytedance/workspace/bytedance/todos-training/services/api/src/main/java/com/bytedance/todos/model/TodoStatus.java) 对称。`Todo` 实体新增：

```java
@Column(length = 2000)
private String description;

@Enumerated(EnumType.STRING)
private TodoPriority priority;
```

两字段无 Java 侧初始值，保持 `null`。新增对应 getter/setter。

### D3. CreateTodoRequest 与归一化

`CreateTodoRequest` 新增两个**可选**字段，均不加 `@NotBlank`：

```java
public record CreateTodoRequest(
        @NotBlank String title,
        String description,
        TodoPriority priority
) {}
```

`TodoService.create` 处理：

- `title`：沿用 trim（非空由 `@NotBlank` 保证）。
- `description`：`trim` 后若为空白串则置 `null`，否则存 trim 后值。
- `priority`：原样透传，可为 `null`；不做服务端默认值兜底（与 DB 无默认一致）。

构造器调整为 `new Todo(title, description, priority)` 或使用 setter 注入。

### D4. UpdateTodoRequest 不变

本次不开放编辑，`UpdateTodoRequest` 与 `TodoService.update` 保持只处理 title。避免暴露未在产品契约中使用的能力。

### D5. Web 创建表单

[CreateTodoModal.tsx](file:///Users/bytedance/workspace/bytedance/todos-training/apps/web/src/components/CreateTodoModal.tsx) 表单值扩展：

- `description`：`Form.TextArea`，非必填，placeholder 走 i18n；提交时 trim，空白不传或传 `null`。
- `priority`：`Form.Select`，选项为低/中/高（值 `LOW/MEDIUM/HIGH`），非必填，**不设默认选中项**，允许清空；`allowClear` 保持可空。
- 表单布局沿用 Semi `Form layout="vertical"`，不新增自定义 CSS。

`createTodo` service 入参扩展为 `{ title, description?, priority? }`。

### D6. Web 卡片展示（沿用现有样式，不引入颜色）

[TodoCard.tsx](file:///Users/bytedance/workspace/bytedance/todos-training/apps/web/src/components/TodoCard.tsx) 在现有 `Typography.Text strong` title 基础上，按需追加：

- 优先级：用普通文本（`Typography.Text`，弱于 title 的字重/类型）显示，例如 `优先级：高`；**不使用带颜色的 Tag 或 Badge**，保持视觉现状。
- 描述：用 `Typography.Paragraph` 次要样式，`ellipsis` 截断（如 2 行），长文本以 Tooltip 展示全文。
- 仅当字段非空时渲染对应元素，保证存量数据卡片外观基本不变。

所有新增文案统一进 [zhCN.ts](file:///Users/bytedance/workspace/bytedance/todos-training/apps/web/src/i18n/zhCN.ts)，包括"描述""优先级""低/中/高"、描述 placeholder、优先级 placeholder 等。

### D7. CLI 与文档

- CLI 不动，其 [types/todo.ts](file:///Users/bytedance/workspace/bytedance/todos-training/apps/cli/src/types/todo.ts) 不强制加字段（多余字段在反序列化时被忽略，`list` 输出仍为 `#id [STATUS] title`）。
- [AGENTS.md](file:///Users/bytedance/workspace/bytedance/todos-training/AGENTS.md) 同步更新"领域模型"和"API 契约"：Todo fields 增加两项、Create request 增加可选字段、Todo response 增加两个可空字段、创建规则补充描述/优先级说明。

## Risks / Trade-offs

- **[CHECK 约束限制未来取值]** → 未来新增优先级需新 migration；当前三值稳定，可接受。
- **[可空 priority 导致语义"未设置"与"中"混淆]** → 用户明确要求可空、无默认；前端用"未选择"状态表达，不强制赋值。
- **[长描述撑破卡片布局]** → 使用 `Typography.Paragraph` 的 `ellipsis` + Tooltip 截断，不做详情页。
- **[H2 文件库已有存量行]** → `ALTER TABLE ADD COLUMN` 可空列无需回填，存量行自动为 `NULL`；本地可用 `./scripts/dev.sh --reset` 重置。
- **[API 响应体扩展为可选字段]** → 对旧客户端向后兼容（CLI 忽略多余字段），无破坏性变更。
