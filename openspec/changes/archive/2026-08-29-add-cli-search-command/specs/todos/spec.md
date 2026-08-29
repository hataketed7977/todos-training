## ADDED Requirements

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
