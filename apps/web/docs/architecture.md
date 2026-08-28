# apps/web 分层架构约定

本文记录 `apps/web` 模块内部已经在执行、但从单个文件的 import 或类型声明上
看不出意图的分层约定。每条约定写明它约束什么、违反后会导致什么后果；后果均
指向当前代码中的具体位置（路径相对 `apps/web` 模块根目录）。跨模块的产品
契约、领域模型、API 契约见仓库根目录 `AGENTS.md`；模块技术栈、目录意图、
styling 规则与本地命令见 `apps/web/AGENTS.md`，本文不重复。

## 1. 分层与依赖方向

模块内部分为 `pages` / `components` / `hooks` / `services` / `types` /
`i18n` 六层，依赖方向固定为：

```text
pages → hooks → services → HTTP(services/api)
pages → components → types
hooks/components/pages → types、i18n
```

约束什么（依赖方向由当前 import 关系印证，不允许反向）：

- `fetch` 在整个 `src/` 中只出现在 services 层
  （`src/services/todosService.ts:6`），是模块唯一的网络出口。
- services 层只被 hooks 层引用
  （`src/hooks/useTodos.ts:3-8` 是 `src/` 中唯一 import
  `services/todosService` 的位置）。
- hooks 层只被 page 引用
  （`src/pages/TodosBoardPage.tsx:8` 是 `src/` 中唯一 import
  `hooks/useTodos` 的位置）；`components/` 下任何文件都不 import hooks 或
  services。
- `types` 和 `i18n` 是被各层共用的叶子依赖，不反向 import 任何层
  （`src/types/todo.ts` 无项目内 import；`src/i18n/zhCN.ts` 无项目内
  import）。

违反后果：组件或 page 直接调 `fetch` / services，会绕过 hooks 层唯一的
错误处理通道——service 抛出的错误只有在 `useTodos` 的 catch 块里才会被
翻译成 i18n 文案并弹 Toast（`src/hooks/useTodos.ts:26-28,73-76,89-91,
126-129`），直接调用方拿不到这条路径，失败时用户无任何反馈。同理，组件
自己 import services 会让服务端状态散落在多个组件里，而当前列表状态只有
`useTodos` 一份（`src/hooks/useTodos.ts:14` 的 `todos` state），增删改后的
本地同步（见 3.2）也只在这一份状态上发生。

## 2. pages 与 components 的边界

### 2.1 page 是唯一的组合根

`TodosBoardPage` 做且只做三件事：调用 `useTodos` 取状态与动作
（`src/pages/TodosBoardPage.tsx:17-28`）、持有弹层开关状态（`isCreateOpen`
/ `editingTodo`，`TodosBoardPage.tsx:15-16`）、把状态和回调作为 props 传给
组件（`TodosBoardPage.tsx:53,80-104`）。`App.tsx` 只渲染该 page
（`src/App.tsx:3-5`），`main.tsx` 只负责挂载（`src/main.tsx:7-10`）。

约束什么：页面级状态（当前打开哪个 Modal、编辑目标是谁）归 page；服务端
数据状态归 hook；组件不自己决定“现在是创建还是编辑”——`CreateTodoModal`
通过 `mode` 和 `initialTodo` props 被告知
（`src/components/CreateTodoModal.tsx:18-19,43`），同一个组件被 page 渲染
两次分别承担创建和编辑（`TodosBoardPage.tsx:90-104`）。

违反后果：在组件内部自行拉取数据或持有弹层开关，会绕过 page 的单一组合
点，创建/编辑两个 Modal 实例的状态（`TodosBoardPage.tsx:90-104`）就会出现
第二份事实来源。

### 2.2 组件是受控的：数据与回调全部经 props 进入

`TodoBoard` / `BoardColumn` / `TodoCard` / `AppHeader` 不 import services
或 hooks，所需数据和动作全部来自 props
（`src/components/TodoBoard.tsx:9-17`、
`src/components/BoardColumn.tsx:12-20`、
`src/components/TodoCard.tsx:18-24`、
`src/components/AppHeader.tsx:28-30`）。

约束什么：组件不发起状态变更，只回调——删除按钮经 Popconfirm 确认后调
`onDelete(todo.id)`（`src/components/TodoCard.tsx:76-78`），新增按钮调
`onCreate`（`src/components/BoardColumn.tsx:46-54`），编辑入口调
`onEdit(todo)`（`TodoCard.tsx:58-61`）。进行中的操作以 `deleting` /
`editing` 标志位 props 下传，组件只负责禁用入口
（`TodoCard.tsx:27,60,78`），不自己判断操作状态。

违反后果：组件内直接改数据会与 hook 的状态更新时机冲突（见 3.2）；操作
进行中禁用按钮的依据（`deleting`/`editing` 两个 `Set<number>`，
`src/hooks/useTodos.ts:18-19`）由 hook 按 id 维护，组件拿不到这份状态就会
允许重复提交。

## 3. hooks 层：状态与异步编排的唯一归属

### 3.1 服务端状态、加载/错误标志、分组派生数据都在 hook 里

`useTodos` 持有：列表数据与错误/加载状态
（`src/hooks/useTodos.ts:14-16`）、按操作类型区分的进行中标志（创建是
布尔、删除/更新是按 id 的 `Set`，`useTodos.ts:17-19`）、挂载时拉取
（`useTodos.ts:34-36`）、按状态分组的派生数据
（`useTodos.ts:38-48`）。

约束什么：

- 分组逻辑归 hook，且分组依据是 `types` 层的固定状态表 `todoStatuses`
  （`useTodos.ts:40-45` 对 `todoStatuses` 做 reduce），组件只消费分好组的
  `todosByStatus`（`src/components/TodoBoard.tsx:65`）。
- 错误反馈归 hook：失败时设置 `error` 状态并弹 Toast，文案全部取自 i18n
  （`useTodos.ts:27-28,74-75,90-91,127-128`）。

违反后果：在组件里分组会复制一份状态→列的映射，而看板列定义本身在
`types/todoBoard.ts` 的 `todoBoardColumns`（见 4.2），分组和列定义两处各
写一遍状态清单必然漂移；跳过 hook 直接弹错误则错误文案脱离 i18n（见
5.2）。

### 3.2 本地状态只在服务调用成功后更新；三个动作的失败契约不同

三个写操作都在 `await` 成功之后才改本地状态：创建成功后前插
（`src/hooks/useTodos.ts:65-70`）、删除成功后过滤掉
（`useTodos.ts:85-86`）、更新成功后按 id 替换
（`useTodos.ts:118-123`）。失败契约有意做成三种：

- `addTodo` 失败后**重新抛出**异常（`useTodos.ts:76`）。
- `removeTodo` 失败后吞掉异常，本地状态不动
  （`useTodos.ts:89-91`；状态本来就在成功后才移除，无需回滚）。
- `editTodo` 失败后吞掉异常，但调用 `refreshTodos()` 全量重拉
  （`useTodos.ts:129`），让界面回到服务端真实状态。

约束什么：调用方（page → Modal）依赖这个契约。Modal 的提交逻辑在 try 中
await 创建回调，catch 里保持 Modal 打开以便重试
（`src/components/CreateTodoModal.tsx:76-95`，注释明确说明依赖 hook 已弹
Toast）；创建路径能保持打开，正是因为 `addTodo` 会 rethrow，而编辑路径
`editTodo` 不 rethrow，page 的 `handleUpdate` 随后照常关闭弹层
（`src/pages/TodosBoardPage.tsx:39-49`）。

违反后果：把 `addTodo` 改成吞异常，创建失败时 Modal 会关闭、用户输入丢失
且无重试入口；把 `editTodo` 改成 rethrow，异常会穿过 page 的
`handleUpdate`（无 catch，`TodosBoardPage.tsx:47-48`）成为未处理 rejection；
在 `await` 之前就乐观改本地状态，失败路径上三个动作都没有回滚代码
（`useTodos.ts:63-79,82-99,101-137` 中不存在状态恢复逻辑），界面会停留在
服务端并不存在的状态。

## 4. services 与 types 层

### 4.1 services 层只做传输：URL、方法、序列化、错误翻译

`todosService` 的职责边界是：拼 base URL（`VITE_API_BASE_URL`，缺省回退
`http://localhost:18080`，`src/services/todosService.ts:3`）、发请求、
统一 `content-type` 头（`todosService.ts:7-10`）、`!response.ok` 时抛错
（`todosService.ts:14-16`）、204 无响应体时返回 `undefined`
（`todosService.ts:18-20`）、其余情况解析 JSON（`todosService.ts:22`）。
四个导出函数与后端四个端点一一对应（`todosService.ts:25-58`）。

约束什么：services 层不做任何输入清洗——`body: JSON.stringify(input)`
原样发送调用方给的数据（`todosService.ts:36,56`）；trim、空白转 null、
优先级缺省转 null 都发生在调用它之前（见 3.2 与 5.1）。services 层也不
弹 Toast、不碰 React 状态。

违反后果：在 service 里 trim/判空会与 hook 和 Modal 里已有的归一化
（`useTodos.ts:55-61,109-114`、
`src/components/CreateTodoModal.tsx:68-74`）形成两套规则；service 抛出的
错误信息只含 HTTP 状态码（`API request failed: ${status}`，
`todosService.ts:15`），它的唯一消费者是 hook 的 catch（见 3.1），在 UI
上直接展示这条英文信息会违反 i18n 约定（见 5.2）。

### 4.2 types 层：API 形状镜像与看板结构的单一出处

`Todo` 接口逐字段镜像后端响应（`src/types/todo.ts:4-12`），services 的
泛型和 hook 的状态都引用它（`todosService.ts:1,25,33,41,53`、
`useTodos.ts:9`）。看板的三列结构不是写死在 JSX 里，而是
`todoBoardColumns` 一条数据：每列绑定 `status`、i18n 标签和色调
（`src/types/todoBoard.ts:10-14`），看板渲染
（`src/components/TodoBoard.tsx:56-72`）和 header 统计
（`src/components/AppHeader.tsx:33-39,62-69`）都 map 这同一张表。

约束什么：固定状态清单 `todoStatuses`（`src/types/todo.ts:14`）是分组的
唯一依据（见 3.1）；列定义是列数、列名、列色调的唯一出处。

违反后果：绕过 `todoBoardColumns` 在组件里硬编码列，header 计数和看板列
会各自演化——当前两者都从这张表取标签和色调
（`TodoBoard.tsx:56`、`AppHeader.tsx:62-65`）；改 `Todo` 接口字段而不跟
随后端响应形状，类型错误会集中暴露在 service 泛型与 hook 状态的使用点
（`todosService.ts` 全部返回类型、`useTodos.ts:14`），这正是 `pnpm build`
中 `tsc` 的拦截范围（见 `docs/testing.md`）。

## 5. 横切约定

### 5.1 提交前归一化在表单和 hook 两处执行，services 不参与

标题非空校验在 Semi Form 的 `validator` 上：trim 后为空则返回 i18n 错误
文案（`src/components/CreateTodoModal.tsx:133`）；提交时 Modal 再 trim 一次
标题、trim 描述并把空白描述转为 `null`、缺省优先级转为 `null`
（`CreateTodoModal.tsx:68-74`）；hook 的 `addTodo` / `editTodo` 对同样的
规则再做一次（`src/hooks/useTodos.ts:55-61,109-114`），空白标题直接
return 不发请求（`useTodos.ts:56-58,110-112`）。

约束什么：这是有意的双层防御——Modal 是表单入口，hook 是唯一的服务调用
前置点；新增调用 service 的入口时，归一化必须在调用前完成，因为
services 层不清洗（见 4.1）。

违反后果：跳过 Modal 的 validator，空白标题可以触发表单提交，最终靠 hook
的 `return` 静默丢弃（`useTodos.ts:56-58`），用户得不到
`i18n.titleRequired` 的提示（`CreateTodoModal.tsx:133`）；跳过 hook 层的
归一化直接调 service，空白描述和缺省优先级的 `null` 规范化
（`useTodos.ts:60-61,68`）就不会发生。

### 5.2 用户可见文案全部来自 i18n，包括错误文案

所有用户可见字符串集中在 `src/i18n/zhCN.ts`（`as const` 单一对象），
组件与 hook 只引用 `i18n.*`（如 `src/components/BoardColumn.tsx:48,78-79`、
`src/hooks/useTodos.ts:27`）。service 层的错误信息不进 UI——hook catch 后
一律替换为 i18n 文案（`useTodos.ts:27,74,90,127`）。

约束什么：新增文案先加到 `zhCN.ts` 再引用；网络/服务错误的用户反馈走
hook 的 catch → i18n + Toast 通道，不直接展示 `Error.message`。

违反后果：在组件或 hook 里硬编码中文，`apps/web/AGENTS.md` 的 review
规则要求标记；直接展示 service 抛出的 `API request failed: ...`
（`src/services/todosService.ts:15`）会让用户看到英文技术信息，且绕过
zhCN 这个唯一文案出处。

### 5.3 样式归属

样式规则（Semi 优先、inline style 范围、`index.css` 只放全局样式、不建
组件级 CSS 文件）已在 `apps/web/AGENTS.md` 的 Styling 规则中明确，本文不
重复；分层上的对应事实是：组件样式以 inline style 和 Semi props 表达
（如 `src/components/TodoBoard.tsx:30-43`、
`src/components/BoardColumn.tsx:57-63`），`src/index.css` 不承载组件内部
样式。
