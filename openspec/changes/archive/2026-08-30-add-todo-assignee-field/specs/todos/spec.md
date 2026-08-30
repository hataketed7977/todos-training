## ADDED Requirements

### Requirement: Todo assignee field

Todo 实体 SHALL 包含一个可空的 `assignee` 字段，用于记录任务的负责人。该字段为自由文本，最大长度 255 字符。创建 Todo 时客户端 MAY 携带该字段；未携带、trim 后为空字符串或值为空白时，系统 MUST 将其持久化为 `NULL`。系统 SHALL 对传入的 assignee 值执行首尾空白裁剪（trim）。`assignee` 字段 MUST NOT 影响列表排序（列表仍按 `createdAt` 倒序返回）。更新 Todo 时，若请求体未提供 `assignee`、`assignee` 为 `null`、或 trim 后为空字符串，系统 MUST 将目标 Todo 的 `assignee` 清空为 `NULL`（与 `priority` 同派语义，不保留现有值）；仅当请求体提供 trim 后非空字符串的 `assignee` 时，才写入该非空值。

#### Scenario: 创建时提供非空 assignee
- **GIVEN** 客户端构造创建请求
- **WHEN** 客户端调用 `POST /api/todos`，请求体为 `{ "title": "准备培训", "assignee": "  张三  " }`
- **THEN** 系统创建 Todo，`assignee` 为 `"张三"`（已 trim），`status` 为 `"TODO"`

#### Scenario: 创建时不提供 assignee
- **WHEN** 客户端调用 `POST /api/todos`，请求体仅含 `{ "title": "准备培训" }`
- **THEN** 系统创建 Todo，其 `assignee` 为 `null`

#### Scenario: 创建时 assignee 为空白字符串
- **WHEN** 客户端调用 `POST /api/todos`，请求体为 `{ "title": "准备培训", "assignee": "   " }`
- **THEN** 系统创建 Todo，其 `assignee` 为 `null`

#### Scenario: 查询响应包含 assignee
- **WHEN** 客户端调用 `GET /api/todos` 获取一个已设置 assignee 的 Todo
- **THEN** 响应体中 MUST 包含 `assignee` 字段，值为 trim 后的字符串，未设置时返回 `null`

#### Scenario: 更新时显式提供 assignee
- **GIVEN** 存在 Todo id=1，assignee 原值为 `"李四"`
- **WHEN** 客户端调用 `PUT /api/todos/1`，请求体为 `{ "title": "标题", "assignee": "王五" }`
- **THEN** 响应体中 `assignee` 为 `"王五"`，后续 GET 返回反映该更新

#### Scenario: 更新时不传 assignee 导致清空
- **GIVEN** 存在 Todo id=1，assignee 原值为 `"李四"`
- **WHEN** 客户端调用 `PUT /api/todos/1`，请求体仅含 `{ "title": "标题" }`（无 assignee 字段）
- **THEN** 响应体中 `assignee` 为 `null`（清空而非保留原值）

#### Scenario: 更新时传空白 assignee 导致清空
- **GIVEN** 存在 Todo id=1，assignee 原值为 `"李四"`
- **WHEN** 客户端调用 `PUT /api/todos/1`，请求体为 `{ "title": "标题", "assignee": "   " }`
- **THEN** 响应体中 `assignee` 为 `null`

#### Scenario: assignee 不影响排序
- **GIVEN** assignee="A" 但 createdAt 较早的 Todo 与 assignee="B" 但 createdAt 较晚的 Todo 同时存在
- **WHEN** 客户端调用 `GET /api/todos`
- **THEN** 返回列表 MUST 按 `createdAt` 倒序排列，与 `assignee` 无关

### Requirement: Database migration for Todo assignee column

系统 MUST 通过 Flyway migration 为 `todos` 表新增 `assignee` 列。列类型 MUST 为 `VARCHAR(255)` 且可空、无默认值；SHOULD 附带长度 CHECK（`CHECK (length(assignee) <= 255)`）以保障最大 255 字符的硬约束。存量行在迁移后 `assignee` 列 MUST 为 `NULL`。Hibernate MUST 继续以 `validate` 模式运行，不得自动修改 schema。迁移脚本命名 MUST 为 `V3__add_assignee.sql`，且 MUST 在 `V1`、`V2` 之后顺序执行。

#### Scenario: 迁移后存量数据 assignee 为空
- **WHEN** 对已存在若干 Todo 的数据库执行 V3 migration
- **THEN** 所有存量 Todo 的 `assignee` 列为 `NULL`

#### Scenario: Hibernate 校验通过
- **WHEN** 应用在 V3 迁移完成后启动
- **THEN** Hibernate schema 校验 MUST 通过，TodoEntity 字段与数据库列一一对应

### Requirement: Todo create/update API shapes carry assignee

`POST /api/todos` 的请求体 Record `CreateTodoRequest` SHALL 新增可选 `assignee: String` 组件（无 Bean Validation 非空约束，允许 `null`）。`PUT /api/todos/{id}` 的请求体 Record `UpdateTodoRequest` SHALL 新增可选 `assignee: String` 组件。两条接口的响应体 SHALL 在 Todo 对象中包含 `assignee` 字段，值为 trim 后的字符串或 `null`。反序列化非法的 JSON 类型（例如 assignee 为对象或数组）MUST 触发 400 级别错误且不持久化任何数据。

#### Scenario: Create 请求体含非法 assignee 类型
- **WHEN** 客户端调用 `POST /api/todos`，请求体为 `{ "title": "X", "assignee": { "name": "张三" } }`
- **THEN** 系统 MUST 返回 4xx 错误，且 MUST NOT 创建任何 Todo

#### Scenario: Update 请求响应中出现 assignee
- **GIVEN** 存在 Todo id=1
- **WHEN** 客户端调用 `PUT /api/todos/1` 并携带非空 `assignee`
- **THEN** 200 响应体中的 Todo JSON MUST 包含 `"assignee": <trimmed-string>` 键

### Requirement: Web creation/edit form supports assignee

Web 创建与编辑 Todo 的弹窗 MUST 提供"负责人"单行文本输入，该输入为非必填，默认为空并可清空。该输入框的文案/占位符 MUST 走 `zhCN.ts` i18n 常量，不得硬编码中文。提交前，系统 MUST 对 assignee 输入值执行 trim；trim 后为空字符串的 MUST 按"未填写"处理（序列化为 `null` 或在请求体中省略字段，两者等价）。编辑模式下打开弹窗时 MUST 预填当前 Todo 的 `assignee` 值（若为 `null` 则填空）。保存时 Web MUST 将 assignee 一并发送到对应的创建/更新接口。

#### Scenario: 用户仅填写标题创建（assignee 留空）
- **WHEN** 用户在创建弹窗中只填写标题并提交
- **THEN** 发送的请求体中 `assignee` 字段要么为 `null`，要么被省略；创建成功

#### Scenario: 用户填写 assignee 创建
- **WHEN** 用户在创建弹窗中填写标题 + 输入"  张三  "并提交
- **THEN** 前端在发送前 trim assignee 为 `"张三"`，请求体 JSON 中包含 `"assignee": "张三"`

#### Scenario: 编辑弹窗打开时预填 assignee
- **GIVEN** Todo 的 assignee = `"李四"`
- **WHEN** 用户在该 Todo 卡片上点击编辑图标打开弹窗
- **THEN** "负责人"输入框中预填文本为 `"李四"`，其他字段也按既有规则预填

#### Scenario: 编辑中清空 assignee 并保存
- **GIVEN** Todo 原 assignee = `"李四"`
- **WHEN** 用户在编辑弹窗中删除"负责人"输入的全部内容并提交
- **THEN** 前端发送的请求体中 `"assignee"` 为 `null`（或省略），最终 Todo.assignee 被后端按"清空"语义归一化为 `null`

### Requirement: Web Todo card displays optional assignee

Web TodoCard 组件 MUST 在现有标题/优先级/描述的渲染结构中，新增 `assignee` 文本展示位。展示位 MUST 复用现有 `type="tertiary" size="small"` 样式（与 priority 行保持一致视觉风格），不得引入颜色标签、头像块或其他新视觉体系。展示文案格式 MUST 为 `负责人：<assignee值>` 或等价 i18n 拼接（中文常量 + 值）。当 `assignee` 为 `null` 时，该展示行元素 MUST NOT 渲染，保持空 assignee 的卡片视觉与本次变更前的基线一致。

#### Scenario: 卡片展示已设置的 assignee
- **GIVEN** Todo 有非空 `assignee = "张三"`
- **WHEN** TodoCard 渲染该 Todo
- **THEN** 卡片在标题/优先级区域下方展示 tertiary 样式的"负责人：张三"文本

#### Scenario: 空 assignee 时卡片不渲染对应行
- **GIVEN** Todo 的 assignee 为 `null`
- **WHEN** TodoCard 渲染该 Todo
- **THEN** 卡片 DOM 中 MUST 不出现"负责人"相关元素，视觉与字段新增前基线一致

### Requirement: CLI create supports assignee flag

CLI `todos-cli create <title>` 子命令 SHALL 新增可选短/长选项 `-a, --assignee <name>` 用于指定负责人。选项值 MUST 透传给 `createTodo` API client 函数的 `assignee` 参数，由 API client 负责放入 JSON body（键名 `assignee`）。`createTodo` 请求体中，当 `--assignee` 未提供时值 MUST 为 `undefined`（省略键）；当提供了值时 MUST 原样提交（trim 与 NULL 归一化由后端执行，前端/CLI 不重复执行以避免双端不一致）。`ERROR_CODES` 中无需新增新错误码，已有 `CREATE_HTTP_ERROR` 即可覆盖。

#### Scenario: create 携带 --assignee
- **WHEN** 用户执行 `todos-cli create 任务X -a "张三"`（并提供合理的 `--api-url`，默认 localhost:18080 或自定义）
- **THEN** `createTodo` 构造的 POST JSON body 包含 `"title": "任务X"` 与 `"assignee": "张三"`，请求发送成功时 CLI 输出创建结果

#### Scenario: create 未提供 --assignee
- **WHEN** 用户执行 `todos-cli create 任务X`（不传 `-a`）
- **THEN** POST JSON body 中 MUST 省略 `assignee` 键（或值为 `undefined`，序列化时被剔除），后端按"未提供→ NULL"处理

### Requirement: CLI search output includes ASSIGNEE column

CLI `search` 子命令的输出表格 SHALL 在现有列集合（ID / STATUS / PRIORITY / TITLE）的合适位置新增 `ASSIGNEE` 列。列顺序建议为 `ID / STATUS / PRIORITY / ASSIGNEE / TITLE` 或与前序描述一致；该列的左对齐格式与其他列保持一致。当 Todo.assignee 为 `null` 时单元格 MUST 显示 `-`（与 priority=null 显示 `-` 的既有约定一致）。

#### Scenario: search 结果中 assignee 非空显示值
- **GIVEN** API 返回的 Todo 列表含一条 `{ id: 1, status: "TODO", priority: null, assignee: "张三", title: "任务X" }`
- **WHEN** search 命令输出表格
- **THEN** 表格中该条目的 ASSIGNEE 列显示 `张三`，PRIORITY 列显示 `-`

#### Scenario: search 结果中 assignee 为 null 显示连字符
- **GIVEN** API 返回的 Todo 列表含一条 `{ id: 1, status: "TODO", priority: "HIGH", assignee: null, title: "任务X" }`
- **WHEN** search 命令输出表格
- **THEN** 表格中该条目的 ASSIGNEE 列显示 `-`

### Requirement: CLI Todo shape carries nullable assignee

CLI `apps/cli/src/services/apiClient.ts` 中 `Todo` 接口 SHALL 新增 `assignee: string | null` 字段。API client 函数（`fetchTodosByTitle`、`createTodo`）返回值的 JSON 解析路径 MUST 正确将 `assignee` 带到返回对象；`createTodo` 的 `body: Record<string, unknown>` 组装逻辑中 MUST 在 `assignee !== undefined` 时加入该键。

#### Scenario: createTodo 返回值含 assignee
- **GIVEN** 后端 `POST /api/todos` 返回的 JSON 含 `"assignee": "张三"`
- **WHEN** CLI `createTodo` 函数解析响应
- **THEN** 返回的 `Todo` 对象中 `.assignee === "张三"`（类型为 string）

#### Scenario: fetchTodosByTitle 返回列表中每条带 assignee
- **GIVEN** 后端 `GET /api/todos?title=...` 返回的两条 Todo JSON 中分别有 `"assignee": "张三"` 与 `"assignee": null`
- **WHEN** CLI `fetchTodosByTitle` 函数解析响应
- **THEN** 返回数组的第 0 条 `.assignee === "张三"`，第 1 条 `.assignee === null`
