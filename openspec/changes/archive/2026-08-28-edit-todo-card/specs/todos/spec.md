## ADDED Requirements

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
