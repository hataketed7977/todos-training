## ADDED Requirements

### Requirement: CLI search 子命令注册与参数解析

CLI SHALL 在 `todos-cli` program 下注册名为 `search` 的子命令。该命令 MUST 接收一个位置参数 `<keyword>`（必填、非空），用于指定标题关键词。命令 SHALL 支持一个全局可复用的 `--api-url <url>` 选项，默认值为 `http://localhost:18080`；该选项在 `search` 命令中 MUST 可被读取并用作 API 基地址。`search` 命令的帮助描述文案 MUST 为"按标题搜索 todos"。

#### Scenario: 列出命令可见 search 子命令

- **WHEN** 执行 `todos-cli --help`
- **THEN** 帮助输出中 MUST 包含 `search` 命令条目，描述为"按标题搜索 todos"

#### Scenario: search 命令帮助显示参数

- **WHEN** 执行 `todos-cli search --help`
- **THEN** 帮助输出中 MUST 显示位置参数 `<keyword>` 与全局选项 `--api-url`（含默认值 `http://localhost:18080`）

#### Scenario: 缺少 keyword 参数时报错

- **WHEN** 执行 `todos-cli search`（不提供 keyword）
- **THEN** Commander MUST 输出缺失参数错误，`process.exitCode` MUST 为非零值

### Requirement: CLI search 命令 HTTP 调用

`search` 命令执行时，MUST 使用 Node.js 内置 `fetch` 对后端发起 `GET` 请求：`<api-url>/api/todos?title=<encoded-keyword>`。其中 `keyword` MUST 先被 `encodeURIComponent` 编码后再拼接到 URL 查询参数。请求 MUST 携带 `Accept: application/json` 头。响应状态码为 2xx 时 MUST 将响应体按 JSON 解析为 `Todo[]`；非 2xx 状态码时 MUST 视为错误。

#### Scenario: 正常搜索发起正确 HTTP 请求

- **GIVEN** 用户输入 `todos-cli search "培训 材料" --api-url http://localhost:18080`
- **WHEN** 执行 search action
- **THEN** 发送的请求 MUST 为 `GET http://localhost:18080/api/todos?title=%E5%9F%B9%E8%AE%AD%20%E6%9D%90%E6%96%99`，并带有 `Accept: application/json` 头

#### Scenario: 使用默认 --api-url

- **GIVEN** 用户输入 `todos-cli search foo`（不指定 --api-url）
- **WHEN** 执行 search action
- **THEN** 请求目标 MUST 为 `http://localhost:18080/api/todos?title=foo`

### Requirement: CLI search 命令输出格式

搜索成功并拿到 `Todo[]` 结果时，`search` 命令 MUST 通过 Commander 的 `writeOut` 通道输出文本表格。表格 MUST 包含四列：`ID`、`STATUS`、`PRIORITY`、`TITLE`，各列左对齐并以足够的空格分隔。空结果时 MUST 输出单行文案"No todos found."。结果计数 MUST 显示在表头之前或之后（任选其一），格式如"Found N todo(s)"。优先级为 `null` 时 `PRIORITY` 列显示 `-`。

#### Scenario: 多条搜索结果的表格输出

- **WHEN** API 返回两个 Todo：`{id:1,title:"培训材料",status:"TODO",priority:"HIGH"}`、`{id:2,title:"培训报告",status:"DOING",priority:null}`
- **THEN** `writeOut` 接收到的输出中 MUST 包含 "Found 2 todo(s)" 行，以及两行表格数据，分别包含 ID 1/2、对应 STATUS/TITLE，其中第二条的 PRIORITY 显示为 `-`

#### Scenario: 空搜索结果的输出

- **WHEN** API 返回空数组 `[]`
- **THEN** `writeOut` 接收到的输出 MUST 包含 "No todos found."

### Requirement: CLI search 命令错误处理与退出码

搜索过程中发生以下任一情况时，`search` 命令 MUST 通过 Commander 的 `writeError` 通道输出人类可读的错误消息，并设置 `process.exitCode = 1`（不得直接调用 `process.exit()`）：
1. 网络不可达 / fetch 抛出异常 → "Failed to reach API: <原始错误消息>"
2. 响应非 2xx → "Search failed with status <code>"；如响应体可解析为 Spring 默认错误 JSON 且含 `message` 字段，可附于其后
3. JSON 解析失败 → "Failed to parse API response"

成功场景下 `process.exitCode` MUST 保持为默认值 0。

#### Scenario: 网络失败输出错误且 exitCode=1

- **WHEN** fetch 抛出 `ECONNREFUSED` 异常
- **THEN** `writeError` 收到包含 "Failed to reach API" 的消息，且 `process.exitCode === 1`

#### Scenario: 后端返回非 2xx

- **WHEN** 后端返回 500 状态码
- **THEN** `writeError` 收到包含 "Search failed with status 500" 的消息，且 `process.exitCode === 1`

#### Scenario: 搜索成功不改变 exitCode

- **WHEN** 搜索请求正常返回（无论是否有匹配结果）
- **THEN** `process.exitCode` MUST 为 0（或保持未设置）
