# services/api API 设计约定

本文记录这套 HTTP 接口已经在遵循的设计约定，目的是让新增端点时有据可循。
端点的字段细节不在本文抄写，指向对应的 DTO 与实体类；内部分层（谁抛异常、
谁做校验、事务边界）见 `docs/architecture.md`，跨模块约束见仓库根
`docs/architecture.md`，领域模型与端点的完整对外描述见根目录 `AGENTS.md`。
引用本模块代码的路径相对 `services/api` 模块根目录；引用其他模块代码的
路径相对仓库根目录。

## 1. 端点清单

| 方法 | 路径 | 语义 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| GET | `/api/todos` | 列出 todo（可选 `title` 查询参数：标题包含关键词且大小写不敏感），按 `createdAt` 倒序；无 `title` 参数时列出全部 | 200，`List<Todo>` | — |
| POST | `/api/todos` | 创建 todo；新建项 `status` 固定为 `TODO` | 201，创建后的 `Todo` | 400 |
| PUT | `/api/todos/{id}` | 更新指定 todo 的 `title`/`description`/`priority`；不修改 `status`；可选字段传 `null`/省略即清空 | 200，更新后的 `Todo` | 400、404 |
| DELETE | `/api/todos/{id}` | 删除指定 todo | 204，无响应体 | 404 |

印证：四个方法映射在 `src/main/java/com/bytedance/todos/controller/TodoController.java:29-50`；
倒序查询在 `src/main/java/com/bytedance/todos/service/TodoService.java:22-24`；
更新不触碰 `status`、可选字段按传入值覆盖在 `TodoService.java:42-51`。

请求体与响应体的字段定义：

- 请求字段：`src/main/java/com/bytedance/todos/dto/CreateTodoRequest.java`、
  `src/main/java/com/bytedance/todos/dto/UpdateTodoRequest.java`（两个 record
  字段同形）。
- 响应字段：`src/main/java/com/bytedance/todos/model/Todo.java` 的 getter
  序列化为 JSON（见第 4 节）。
- 枚举取值：`src/main/java/com/bytedance/todos/model/TodoStatus.java`、
  `src/main/java/com/bytedance/todos/model/TodoPriority.java`。

## 2. 资源与路径命名

约定：

- 所有端点挂在 `/api` 前缀下（类级 `@RequestMapping("/api/todos")`，
  `TodoController.java:21`；CORS 放行范围同样是 `/api/**`，
  `src/main/java/com/bytedance/todos/config/WebConfig.java:18`）。
- 路径用复数名词表示资源集合（`/api/todos`）：在集合路径上 POST 创建，
  单个资源用 `/api/todos/{id}` 表达，`id` 是路径变量
  （`@PathVariable Long id`，`TodoController.java:42,48`），不放在请求体里。
- 路径中不出现动作词；“做什么”由 HTTP 方法表达（POST 创建、PUT 更新、
  DELETE 删除、GET 读取）。

取舍依据：路径只表达“哪个资源”，方法表达“对资源做什么”，因此新增端点时
不需要为每个操作发明路径动词，客户端对同类资源的路径拼接规则保持一致——
现有前端 client 对集合和单项分别拼 `/api/todos` 与
`` `/api/todos/${id}` ``（`apps/web/src/services/todosService.ts:26,41,54`），
不包含任何动作路径段。新增资源端点沿用“`/api/<复数名词>` +
`/api/<复数名词>/{id}`”同一形状。

## 3. 状态码约定

- **创建成功返回 201 CREATED，响应体是创建后的完整资源**
  （`TodoController.java:34-38`）。取舍：`id`、`status`、`createdAt` 等由
  服务端生成，返回完整资源让客户端直接使用、无需再发 GET；前端创建成功后
  直接用响应体前插到本地列表
  （`apps/web/src/hooks/useTodos.ts:65-70`）。
- **更新成功返回 200 OK，响应体是更新后的完整资源**
  （`TodoController.java:40-44`）。取舍：服务端会对输入做归一化（trim、
  空白转 `null`，`TodoService.java:42-50`），返回服务端最终状态让客户端
  直接替换本地对象、无需重拉列表
  （`apps/web/src/hooks/useTodos.ts:118-123`）。
- **删除成功返回 204 NO_CONTENT，无响应体**：controller 方法返回 `void`
  配合 `@ResponseStatus(NO_CONTENT)`（`TodoController.java:46-50`），service
  的 `delete` 同样返回 `void`（`TodoService.java:55-60`）。取舍：删除后资源
  不存在，没有可返回的表示；前端 HTTP 层对 204 特判为不解析 body
  （`apps/web/src/services/todosService.ts:18-20`）。
- **读取成功返回 200**：GET 不写 `@ResponseStatus`，使用 Spring 默认的 200
  （`TodoController.java:29-32`）。

新增端点时按结果选状态码：新建资源用 201 并返回创建后的对象；修改资源用
200 并返回服务端最终状态；删除或其他“无资源可返回”的操作用 204 且方法
返回 `void`；读取默认 200。成功状态码全部在 controller 上用 `@ResponseStatus`
显式声明，不靠方法名或返回值隐式决定。

## 4. 请求体与响应体

- 请求体是 JSON，每个写操作对应一个 DTO record，controller 参数用
  `@Valid @RequestBody`（`TodoController.java:36,42`）；字段与校验注解以
  DTO 类为准（见第 1 节指针），新增写操作按同样方式新增 DTO，而不是复用
  `Map` 或实体类接收请求。
- 响应直接序列化领域实体 `Todo`，没有专门的 response DTO
  （`TodoController.java:30,36,42`）。取舍与后果见
  `docs/architecture.md` 3.2：实体 getter 即响应字段，未设值字段序列化为
  `null`；给 `Todo` 增加 getter 会在不改 controller 的情况下改变响应形状，
  新增持久化字段前必须先确认它是否应出现在 API 响应中。
- 更新端点的请求体与创建同形（两个 DTO 字段一致），PUT 是整体提交语义：
  可选字段未传或为 `null` 时按“清空”落库（`TodoService.java:50-51` 直接用
  请求值覆盖；清空行为有测试钉住，
  `src/test/java/com/bytedance/todos/controller/TodoControllerTest.java:172-188`）。

## 5. 错误表达

错误按产生位置分三类，形式各不相同，新增端点沿用同一分类：

1. **业务错误：service 抛 `ResponseStatusException`，状态码由抛出点携带。**
   现有一类：资源不存在抛 404
   （`TodoService.java:40-41,57-58`，消息形如
   `"Todo not found: " + id`）。controller 不捕获、不翻译，方法体内没有
   错误分支（`TodoController.java:29-50`）。新增业务错误时在 service 用同一
   异常类型携带对应 `HttpStatus` 即可被 Spring 映射，不需要为每种错误新增
   异常类或处理类。
2. **请求格式错误：框架在进入 controller 方法前拒绝，产生 400，业务代码
   不手写。** 现有两条路径：DTO 上的 Bean Validation（`@NotBlank` 配合
   controller 的 `@Valid`，拒绝空白 `title`）和 Jackson 反序列化失败（非法
   `priority` 枚举值）。声明式校验加在 DTO 上，不在 controller/service 里
   写判空分支；各层校验归属的细节见 `docs/architecture.md` 第 4 节。
3. **错误响应体没有自定义格式。** 模块内不存在 `@ControllerAdvice`、
   `@ExceptionHandler` 或 `ErrorController` 实现（main 源码中无任何异常处理
   类，`config` 包只有 `WebConfig.java`），错误体是 Spring Boot 默认错误
   JSON。对外契约承诺的是状态码（400/404），错误体结构不是被本项目定制的
   契约；前端也只按状态码区分失败
   （`apps/web/src/services/todosService.ts:14-16` 对所有非 2xx 统一抛错，
   hook 按操作类型给出固定文案，见 `apps/web/docs/architecture.md` 3.1）。

400 与 404 的分界：请求本身不合法（空白必填字段、非法枚举）在到达 service
之前就是 400；请求合法但目标资源不存在，由 service 判定为 404。测试按同一
分界断言：400 用例
（`TodoControllerTest.java:113-124,202-214`）与 404 用例
（`TodoControllerTest.java:138-142,190-200`）分别钉住两类状态码。
