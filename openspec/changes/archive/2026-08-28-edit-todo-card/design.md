## Context

当前系统为 monorepo：`services/api`（Java 21 + Spring Boot 3 + Spring Data JPA + Flyway + H2）提供 REST API，`apps/web`（React 18 + Vite + TypeScript + Semi UI）为看板前端。现有能力包括：
- 后端：`GET /api/todos` 列表、`POST /api/todos` 创建、`DELETE /api/todos/{id}` 删除。
- 前端：创建弹窗、卡片 hover 显示删除按钮（Popconfirm 二次确认）、useTodos hook 管理 list/create/delete 状态。
- Todo 实体字段：id / title / description（NULLABLE）/ status（TODO/DOING/DONE）/ priority（NULLABLE）/ createdAt / updatedAt。
- CORS 已放行 `GET, POST, PATCH, DELETE, OPTIONS`，但**尚未包含 `PUT`**。

本变更为"卡片编辑"能力，跨前后端两模块，属于交叉改动。

## Goals / Non-Goals

**Goals:**
- 为每个 Todo 卡片增加编辑入口（hover 可见），打开编辑弹窗后可修改 title / description / priority 三字段。
- 后端新增 `PUT /api/todos/{id}` 更新接口，含空值归一化（与创建时一致）。
- 保存成功后乐观更新本地列表，失败时全量 refresh 兜底。
- CORS 白名单补加 `PUT` 方法，避免浏览器预检拦截。

**Non-Goals:**
- 不允许修改 `status`（状态迁移在其他 change 中另行处理）。
- 不提供批量编辑、撤销编辑、编辑历史/审计。
- 不引入软删除或 schema migration（无需修改表结构）。
- 不重构 CreateTodoModal 与 EditTodoModal 为通用组件（保持最小改动，后续若复用再抽）。
- 不改变列表排序规则（仍按 `createdAt DESC`）。

## Decisions

### D1. HTTP 方法：使用 PUT 而非 PATCH

**选择：** `PUT /api/todos/{id}`

**原因：**
- 提交时始终携带三字段（title/description/priority），语义上是对"编辑域"的完整替换，符合 PUT。
- 相比 PATCH，无需引入额外的 JSON Patch 解析或区分"未传 vs 传 null"二义性。
- 与项目既有 DELETE 的 REST 风格保持一致，更直观。

**备选：** PATCH（可局部更新）—— 放弃，因为本次只改三字段，PUT 更简单直接。

### D2. 前端弹窗：复用 CreateTodoModal 并加 mode 参数

**选择：** 为 `CreateTodoModal` 新增 `mode: 'create' | 'edit'` prop；edit 模式下接收 `initialTodo`，打开时预填表单值，文案切换为"编辑待办/保存"。

**原因：**
- 创建与编辑表单字段完全一致，避免重复代码。
- 当前 CreateTodoModal 结构清晰，加 mode 仅需 `if (mode === 'edit')` 在三处（title、okText、useEffect 预填）调整，成本低。
- 保持单一表单组件，后续新增字段时改动集中。

**备选：**
- 新建独立 EditTodoModal —— 放弃，会导致 Form、validator、priorityOptions 等代码重复。
- 抽一层 TodoFormModal + Create/Edit 包两层 —— 放弃，首次改动保持最小化，后续有复用需求再抽。

### D3. 编辑入口：hover 显示铅笔图标（与删除按钮一致）

**选择：** TodoCard 右侧在 hover 时同时出现"铅笔（编辑）+ 垃圾桶（删除）"两个图标。编辑图标使用中性颜色（如 Semi 默认 icon 色 `--semi-color-text-2`），删除保持红色。

**原因：**
- 与删除按钮交互模式一致，用户学习成本低。
- 保持卡片简洁，非 hover 时无多余视觉元素。
- 两个图标 inline-flex 排列，操作空间足够。

**备选：** 点击卡片主体打开编辑 —— 放弃，易与查看详情的预期冲突，且与删除按钮模式不一致。

### D4. 保存更新：乐观本地替换 + 失败兜底 refresh

**选择：**
1. `updateTodo(id, input)` 发起 PUT 请求。
2. 成功：用响应对象替换 `todos` 中同 id 条目（使用 `setTodos(prev => prev.map(t => t.id === id ? updated : t))`）。
3. 失败：Toast.error + 调用 `refreshTodos()` 全量拉取，确保本地状态与服务端一致。

**原因：**
- 乐观更新无闪烁，体验与删除操作一致。
- 失败兜底策略简单可靠，不引入回滚状态管理的复杂度。

**备选：** 每次成功都 refreshTodos —— 放弃，有 loading 闪烁，体验不如乐观更新。

### D5. 更新中状态：updating Set<number>

**选择：** 新增 `updating: Set<number>` 状态，更新时 `add(id)`，finally 中 `delete(id)`；TodoCard 中编辑按钮依此禁用（not-allowed cursor），编辑弹窗 confirmLoading 绑定 `updating.has(todo.id)`。

**原因：**
- 与现有 `deleting` Set 模式对称，代码风格一致。
- 支持并发编辑不同卡片（虽场景不多，但语义一致）。

### D6. CORS 补加 PUT

**选择：** `WebConfig#addCorsMappings` 中 `allowedMethods` 改为 `"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"`。

**原因：** 浏览器预检 OPTIONS 必须明确包含 PUT，否则 PUT 请求会被拦截。此为 Lessons Learned（上次添加 DELETE 时已遇到过同样问题）。

## Risks / Trade-offs

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 编辑弹窗与创建弹窗共用组件，mode 分支若遗漏一处导致 bug | 创建/编辑文案错配、预填失败 | 在 tasks 中明确列出 "mode === 'edit' 分支全覆盖" 子任务；手动走查两次路径 |
| 乐观更新期间若列表被他人改动（多用户），本地替换会覆盖他人改动 | 单用户训练场景可接受 | H2 为内存单人使用，训练场景不涉及并发；多用户场景后续换真实 DB + refresh 即可 |
| 用户未保存就关闭弹窗，编辑内容丢失 | 轻度体验问题 | 与创建弹窗一致（不做脏检查），保持简单；若后续需要再加 Form dirty 提示 |
| PUT 请求失败时 refreshTodos 会闪 loading | 体验轻微下降 | 失败是小概率事件，且 refreshTodos 为权威恢复手段，可接受 |
| 旧 title 含特殊字符导致 e.stopPropagation 遗漏 | 编辑按钮点击冒泡触发其他交互 | 编辑按钮 onClick 必须执行 `e.stopPropagation()`，与删除按钮保持一致 |

## Migration Plan

无数据库 schema 变更（无需新增 Flyway migration），纯代码发布：

1. 合并后端代码：`TodoController` + `TodoService` + `UpdateTodoRequest` DTO + `WebConfig` PUT 放行 + ControllerTest。
2. 合并前端代码：todosService / useTodos / TodoCard / CreateTodoModal edit-mode / props 传递 / i18n。
3. 验证：`cd services/api && ./gradlew test --rerun-tasks`；`cd apps/web && pnpm build`。
4. 本地启动 `./scripts/dev.sh` 手动走一遍编辑闭环。

**回滚策略：** 前后端均独立，可分别 revert commit；无数据迁移，无回滚风险。

## Open Questions

无。所有决策在探索阶段已与用户确认。
