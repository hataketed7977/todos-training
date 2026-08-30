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

### Requirement: Todo update API endpoint

系统 SHALL 通过 `PUT /api/todos/{id}` 接口提供 Todo 更新能力。请求体 MUST 包含必填的 `title` 字段（非空白字符串），MAY 包含可空的 `description`（最大长度 2000 字符）与可空的 `priority`（取值 `LOW`/`MEDIUM`/`HIGH`）。更新时，系统 MUST 对 `title` 执行 trim，对 `description` 执行 trim 并将空白字符串归一化为 `NULL`；未提供或为 `null` 的 `priority` MUST 保持为 `NULL`。更新成功时系统 MUST 返回 `200 OK` 与更新后的完整 Todo 对象（含自动刷新的 `updatedAt`）。若目标 id 不存在，系统 MUST 返回 `404 Not Found`。

#### Scenario: 更新成功（修改全部三个字段）

- **GIVEN** 系统中存在一个 Todo，其 id=1，title="旧标题"，description="旧描述"，priority="LOW"
- **WHEN** 客户端调用 `PUT /api/todos/1`，请求体为 `{ "title": "  新标题  ", "description": "  新描述  ", "priority": "HIGH" }`
- **THEN** 系统返回 `200 OK`，响应体中 `title` 为 `"新标题"`，`description` 为 `"新描述"`，`priority` 为 `"HIGH"`，`updatedAt` 晚于原值
- **AND** 后续 `GET /api/todos` 返回的该 Todo 反映上述更新值

#### Scenario: 清空 description 和 priority

- **GIVEN** 系统中存在一个 Todo，其 id=1，description="有描述"，priority="HIGH"
- **WHEN** 客户端调用 `PUT /api/todos/1`，请求体为 `{ "title": "标题", "description": "   ", "priority": null }`
- **THEN** 响应体中 `description` 为 `null`，`priority` 为 `null`

#### Scenario: 更新不存在的 Todo 返回 404

- **WHEN** 客户端调用 `PUT /api/todos/99999`，请求体为 `{ "title": "任意" }`
- **THEN** 系统返回 `404 Not Found`，且 MUST NOT 持久化任何数据

#### Scenario: 空白 title 被拒绝

- **WHEN** 客户端调用 `PUT /api/todos/1`，请求体为 `{ "title": "   " }`
- **THEN** 系统 MUST 返回 `400 Bad Request`（或等价 4xx），且 MUST NOT 修改任何数据

### Requirement: Todo card edit entry (hover)

Web TodoCard 组件 SHALL 在 hover 时显示编辑图标（与删除按钮一致的交互模式），图标样式与删除按钮形成视觉区分（例如使用铅笔图标，非红色）。编辑中（`updating` 包含该 id）时图标 MUST 禁用并显示 not-allowed 光标。用户点击编辑图标 MUST 触发编辑弹窗打开，且点击事件 MUST 停止冒泡以避免误触发其他卡片行为。

#### Scenario: 非 hover 状态不显示编辑按钮

- **WHEN** 鼠标不在 TodoCard 上
- **THEN** 编辑按钮的 opacity MUST 为 0（不可见）

#### Scenario: hover 时显示编辑按钮

- **WHEN** 鼠标移入 TodoCard 区域
- **THEN** 编辑按钮的 opacity 过渡为可见（0.6+），并在 hover 到按钮本体时达到 1.0

#### Scenario: 编辑中禁用编辑按钮

- **GIVEN** 某 Todo 正在更新中（`updating` 包含其 id）
- **WHEN** 用户尝试点击编辑按钮
- **THEN** 按钮 MUST 不触发任何弹窗，cursor 为 not-allowed

### Requirement: Web edit modal with prepopulated values

Web 编辑弹窗 MUST 使用与创建弹窗一致的表单布局（标题输入框、描述多行输入框、优先级下拉），并满足：
- 弹窗标题 MUST 为"编辑待办"（而非"新增待办"）。
- 确认按钮文案 MUST 为"保存"（而非"添加"）。
- 弹窗打开时表单 MUST 预填当前 Todo 的 `title`、`description`、`priority` 值。
- `title` 在提交前 MUST 被 trim，空白 MUST 校验失败。
- `description` 在提交前 MUST 被 trim，空白字符串按未填写（NULL）处理。
- `priority` MUST 允许清空为未选状态。
- 保存按钮 MUST 展示 loading（confirmLoading）直到保存完成。

#### Scenario: 打开编辑弹窗时预填值

- **GIVEN** Todo 的 title="工作项"，description="详情"，priority="HIGH"
- **WHEN** 用户点击该 Todo 的编辑按钮
- **THEN** 弹窗表单中的标题输入框显示"工作项"，描述输入框显示"详情"，优先级下拉选中"高"

#### Scenario: 修改内容并保存

- **WHEN** 用户在编辑弹窗中修改标题为"新标题"，清空描述，优先级改为"中"，并点击保存
- **THEN** 前端发送的请求体 MUST 包含 `title: "新标题"`、`description: null`、`priority: "MEDIUM"`

#### Scenario: 保存失败保持弹窗打开

- **WHEN** 保存请求返回错误
- **THEN** 弹窗 MUST 保持打开状态，用户可以重试或继续修改

### Requirement: Optimistic list refresh after edit

当保存编辑成功时，前端 MUST 以乐观方式更新本地 todo 列表：用 API 返回的更新后 Todo 对象替换列表中原 id 对应的条目，并展示"已更新"成功 Toast。若保存失败，前端 MUST 展示"更新失败"错误 Toast，并回退为调用 `refreshTodos()` 全量刷新以恢复与服务端一致的状态。`createdAt` MUST NOT 因编辑而改变；`updatedAt` MUST 更新为新值并正确反映在响应中。

#### Scenario: 成功保存后列表即时更新

- **GIVEN** 看板中显示一个 Todo，title="旧值"
- **WHEN** 用户编辑该 Todo 并保存成功（API 返回更新后对象）
- **THEN** 看板中该卡片标题立即显示为新值，不出现全页 loading 或闪烁

#### Scenario: 保存失败后全量回退刷新

- **WHEN** 用户编辑某个 Todo 并提交，保存请求失败
- **THEN** 前端 MUST 触发全量 `refreshTodos`，并展示失败 Toast

#### Scenario: 更新后排序不变

- **GIVEN** 列表按 `createdAt` 倒序排列
- **WHEN** 编辑中间位置某个 Todo 的 title/description/priority 并保存成功
- **THEN** 该 Todo 在列表中的位置 MUST 保持不变（仍按原 `createdAt` 排序）

### Requirement: GET /api/todos 支持 title 查询参数过滤

`GET /api/todos` 接口 SHALL 接受可选的查询参数 `title`（`@RequestParam(required = false)`）。当 `title` 被提供且为非空白字符串时，系统 MUST 执行"标题包含关键词、大小写不敏感"的过滤，仅返回满足条件的 todos，结果仍 MUST 按 `createdAt` 倒序排列。当 `title` 未提供、为 `null` 或为空白字符串时，接口 MUST 保持原有全量列表行为，等同于 `title` 参数不存在。关键词参数的值 MUST 先被 trim，trim 后为空字符串时视为未提供。成功时返回 `200 OK`，响应体为过滤后的 `List<Todo>`（无匹配时为空数组）。

#### Scenario: 提供 title 参数精确匹配单个结果

- **GIVEN** 系统中存在三个 Todo：title="准备培训"、title="培训报告"、title="代码 review"
- **WHEN** 客户端调用 `GET /api/todos?title=代码`
- **THEN** 响应体中仅包含 title="代码 review" 的 Todo，且按 createdAt 倒序

#### Scenario: 提供 title 参数大小写不敏感匹配多个结果

- **GIVEN** 系统中存在两个 Todo：title="Prepare training"（较早）、title="TRAINING report"（较晚）
- **WHEN** 客户端调用 `GET /api/todos?title=training`
- **THEN** 响应体中包含两条 Todo，顺序为 "TRAINING report" 在前、"Prepare training" 在后（按 createdAt 倒序）

#### Scenario: 提供的 title 关键词无匹配

- **GIVEN** 系统中存在若干 Todo，无任何标题含 "不存在关键词"
- **WHEN** 客户端调用 `GET /api/todos?title=不存在关键词`
- **THEN** 响应状态为 `200 OK`，响应体为空数组 `[]`

#### Scenario: title 参数为空白字符串时回退为全量列表

- **GIVEN** 系统中存在若干 Todo
- **WHEN** 客户端调用 `GET /api/todos?title=   ` 或 `GET /api/todos?title=`
- **THEN** 返回结果 MUST 与未传 `title` 参数的 `GET /api/todos` 完全一致（全量倒序）

#### Scenario: 未提供 title 参数时保持原有全量行为

- **GIVEN** 系统中存在若干 Todo
- **WHEN** 客户端调用 `GET /api/todos`（不带任何查询参数）
- **THEN** 返回结果 MUST 为全部 Todo，按 createdAt 倒序，与变更前行为一致

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

