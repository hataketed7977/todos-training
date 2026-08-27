# todos Specification

## Purpose
TBD - created by archiving change add-todo-description-and-priority. Update Purpose after archive.
## Requirements
### Requirement: Todo description field

Todo 实体 SHALL 包含一个可空的 `description` 字段，用于记录任务的详细说明。该字段为自由文本，最大长度 2000 字符。创建 Todo 时客户端 MAY 携带该字段；未携带或为空白时，系统 MUST 将其持久化为 `NULL`。系统 SHALL 对传入的描述执行首尾空白裁剪（trim），裁剪后为空字符串的值 MUST 被归一化为 `NULL`。

#### Scenario: 创建时提供非空描述

- **WHEN** 客户端调用 `POST /api/todos`，请求体为 `{ "title": "Prepare training", "description": "  准备培训材料和场地  " }`
- **THEN** 系统创建 Todo，其 `description` 为 `"准备培训材料和场地"`（已 trim），`title` 为 `"Prepare training"`，`status` 为 `"TODO"`

#### Scenario: 创建时不提供描述

- **WHEN** 客户端调用 `POST /api/todos`，请求体仅含 `{ "title": "Prepare training" }`
- **THEN** 系统创建 Todo，其 `description` 为 `null`

#### Scenario: 创建时描述仅为空白字符

- **WHEN** 客户端调用 `POST /api/todos`，请求体为 `{ "title": "Prepare training", "description": "   " }`
- **THEN** 系统创建 Todo，其 `description` 为 `null`

#### Scenario: 查询响应包含描述

- **WHEN** 客户端调用 `GET /api/todos` 或 `GET /api/todos/{id}` 获取一个已设置描述的 Todo
- **THEN** 响应体中 MUST 包含 `description` 字段，值为创建时 trim 后的文本

### Requirement: Todo priority field

Todo 实体 SHALL 包含一个可空的 `priority` 字段，取值为 `LOW`、`MEDIUM`、`HIGH` 三者之一，或 `NULL`。该字段 MUST 以字符串形式持久化，并由数据库约束保证取值合法。创建 Todo 时客户端 MAY 携带该字段；未携带时系统 MUST 保持其为 `NULL`，且系统 MUST NOT 为其设置任何默认优先级。该字段 MUST NOT 影响列表排序（列表仍按 `createdAt` 倒序返回）。

#### Scenario: 创建时指定优先级

- **WHEN** 客户端调用 `POST /api/todos`，请求体为 `{ "title": "Prepare training", "priority": "HIGH" }`
- **THEN** 系统创建 Todo，其 `priority` 为 `"HIGH"`

#### Scenario: 创建时不指定优先级

- **WHEN** 客户端调用 `POST /api/todos`，请求体仅含 `{ "title": "Prepare training" }`
- **THEN** 系统创建 Todo，其 `priority` 为 `null`

#### Scenario: 拒绝非法优先级取值

- **WHEN** 客户端调用 `POST /api/todos`，请求体为 `{ "title": "Prepare training", "priority": "URGENT" }`
- **THEN** 系统 MUST 拒绝该请求（返回 4xx 错误），且 MUST NOT 持久化该 Todo

#### Scenario: 优先级不影响排序

- **WHEN** 一个 `HIGH` 优先级但创建时间较早的 Todo 与一个 `LOW` 优先级但创建时间较晚的 Todo 同时存在
- **WHEN** 客户端调用 `GET /api/todos`
- **THEN** 返回列表 MUST 按 `createdAt` 倒序排列，与 `priority` 无关

### Requirement: Database migration for new Todo fields

系统 MUST 通过 Flyway migration 为 `todos` 表新增 `description` 与 `priority` 两列。两列 MUST 均可空且无默认值。`priority` 列 MUST 带有 CHECK 约束，仅允许 `'LOW'`、`'MEDIUM'`、`'HIGH'`。存量行在迁移后两列 MUST 为 `NULL`。Hibernate MUST 继续以 `validate` 模式运行，不得自动修改 schema。

#### Scenario: 迁移后存量数据字段为空

- **WHEN** 对已存在若干 Todo 的数据库执行 V2 migration
- **THEN** 所有存量 Todo 的 `description` 与 `priority` 列均为 `NULL`

#### Scenario: Hibernate 校验通过

- **WHEN** 应用在迁移完成后启动
- **THEN** Hibernate schema 校验 MUST 通过，实体字段与数据库列一致

### Requirement: Web creation form supports description and priority

Web 创建 Todo 的弹窗 MUST 提供"描述"多行输入框与"优先级"下拉选择，两者均为非必填。优先级下拉选项 MUST 为低（`LOW`）、中（`MEDIUM`）、高（`HIGH`），且默认 MUST NOT 选中任何值，用户 MAY 清空选择。提交创建时，系统 MUST 将已填写的描述与优先级一并发送给 `POST /api/todos`；描述在提交前 MUST 被 trim。

#### Scenario: 用户仅填写标题创建

- **WHEN** 用户在创建弹窗中只填写标题并提交
- **THEN** 发送的请求体仅含非空 `title`（或等价的空字段被省略），创建成功

#### Scenario: 用户填写描述并选择优先级创建

- **WHEN** 用户填写标题、输入描述、选择"高"优先级并提交
- **THEN** 发送的请求体包含 `title`、trim 后的 `description` 与 `"HIGH"` 的 `priority`

### Requirement: Web card displays optional description and priority

Web Todo 卡片 MUST 在现有标题展示基础上，当 Todo 的 `priority` 非空时展示其优先级文本，当 `description` 非空时展示其描述文本。卡片 MUST NOT 为优先级引入新的颜色或视觉体系（保持现有视觉风格）。长描述 MUST 被截断展示，并在需要时提供完整内容查看。字段为空时对应元素 MUST NOT 渲染。

#### Scenario: 卡片展示已设置的字段

- **WHEN** 一个 Todo 同时具有非空 `priority` 与 `description`
- **THEN** 卡片展示标题、优先级文本与（截断后的）描述文本

#### Scenario: 卡片对空字段不渲染

- **WHEN** 一个 Todo 的 `priority` 与 `description` 均为 `null`
- **THEN** 卡片 MUST 仅展示标题，外观与本次变更前保持一致

