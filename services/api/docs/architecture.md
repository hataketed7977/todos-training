# services/api 分层架构约定

本文记录 `services/api` 模块内部已经在执行、但从单个文件的注解或类型声明上
看不出意图的分层约定。每条约定写明它约束什么、违反后会导致什么后果；后果均
指向当前代码或测试中的具体位置（路径相对 `services/api` 模块根目录）。
领域模型、API 契约等跨模块内容见仓库根目录 `AGENTS.md`，模块技术栈与本地
命令见 `services/api/AGENTS.md`。

## 1. 分层与调用方向

后端内部分为 `controller` / `service` / `repository` / `model` / `dto`
五层，调用方向固定为 controller → service → repository，`model` 被各层
共用，`dto` 只在 controller 与 service 之间出现。

约束什么：

- controller 只注入 service，不导入 `repository` 包
  （`src/main/java/com/bytedance/todos/controller/TodoController.java:23-27`）。
- main 代码中 repository 只被 service 引用
  （`src/main/java/com/bytedance/todos/service/TodoService.java:6,15`）；
  repository 自身只依赖 `model`
  （`src/main/java/com/bytedance/todos/repository/TodoRepository.java:3,7`）。

违反后果：controller 或其他层直接访问 repository，会绕过 service 内唯一的
输入归一化执行点（`trim()` 在整个 main 代码中只出现在 `TodoService`，
见 2.1）和唯一的事务边界（见 2.3）。测试代码例外：controller 测试可以直接
注入 repository 做造数与结果断言
（`src/test/java/com/bytedance/todos/controller/TodoControllerTest.java:31,35,128`），
但这只是测试夹具，不构成生产代码的调用路径。

## 2. 业务逻辑放在 service 层

### 2.1 输入归一化是 service 的职责

字符串清洗规则——trim `title`、trim `description`、空白 `description`
存为 `NULL`——在 create 和 update 两条路径上都由 service 执行
（`src/main/java/com/bytedance/todos/service/TodoService.java:28-35,42-50`）。

约束什么：归一化逻辑只能出现在 service；controller 方法体只做委托
（`TodoController.java:36-37,42-43`），repository 收到的是已经构造完成的
实体（`TodoService.java:35,52` 的 `save` 调用点传入的均为 trim 后的值）。

违反后果：归一化后的结果被 HTTP 测试逐条钉住——

- description 去首尾空白：`createsTodoWithTrimmedDescriptionAndPriority`
  （`src/test/java/com/bytedance/todos/controller/TodoControllerTest.java:67-82`）；
- 纯空白 description 落库为 `null`：`normalizesBlankDescriptionToNull`
  （`TodoControllerTest.java:98-111`）；
- update 时 title 去空白：`updatesExistingTodoWithAllFields`
  （`TodoControllerTest.java:145-170`，请求 `"  新标题  "`，响应断言
  `"新标题"`）。

省略清洗或把清洗移到 controller，上述测试会直接失败。注意归一化与校验的
区别：归一化**接受**请求并改写内容；空白 `title` 不属于归一化范围，而是
在更早的阶段被拒绝（见 4.1）。

### 2.2 “资源不存在”的判断在 service

update 和 delete 先 `findById`，查不到时抛
`ResponseStatusException(NOT_FOUND)`
（`src/main/java/com/bytedance/todos/service/TodoService.java:40-41,57-58`）。

约束什么：存在性判断是业务决策，归 service；controller 不做任何存在性
分支。业务错误用 `ResponseStatusException` 直接表达 HTTP 状态码，而不是
返回 `null` / `Optional` 交给 controller 翻译。

违反后果：404 行为被测试钉住（`returns404WhenDeletingNonExistentTodo`，
`TodoControllerTest.java:138-142`；`returns404WhenUpdatingNonExistentTodo`，
`TodoControllerTest.java:190-200`）。service 抛异常后控制器方法不会继续
执行，因此在 controller 里补一个“先查再判 404”的分支是不可达代码——
controller 根本拿不到“不存在”这个信息。

### 2.3 事务边界划在 service 的公开方法上

service 的每个公开方法都在一个事务内执行，读操作声明为只读
（`src/main/java/com/bytedance/todos/service/TodoService.java:21,26,38,55`）；
配置中 `spring.jpa.open-in-view` 为 `false`
（`src/main/resources/application.yml:14`），请求处理线程在 service 方法
之外没有打开的 persistence context。

约束什么：需要访问数据库的操作序列必须整体放在一个 service 方法内。
update 的“查 → 改 → 存”三步就是在同一个 `@Transactional` 方法里完成的
（`TodoService.java:40-52`）。

违反后果：把多步持久化操作拆到 controller 等非 service 位置，这些步骤会
在没有事务的请求线程里执行，且 main 代码中当前所有 repository 调用点都
位于 `TodoService` 内，没有其他现成的事务入口可以依赖。

### 2.4 列表读取语义由 repository 方法名承载

“列表按 `createdAt` 倒序”这一规则的唯一代码表达是 repository 的派生查询
方法名 `findAllByOrderByCreatedAtDesc`
（`src/main/java/com/bytedance/todos/repository/TodoRepository.java:8`）；
service 的 `list()` 直接返回它的结果
（`src/main/java/com/bytedance/todos/service/TodoService.java:22-24`），
service 和 controller 中都没有排序代码。

违反后果：根目录 `AGENTS.md` 的 API 契约规定 `GET /api/todos` 按
`createdAt` 倒序返回；重命名该方法、在 service 中另写排序或改为内存排序，
都会使代码与该契约脱节。

## 3. Controller 的职责边界

### 3.1 controller 只做 HTTP 适配

controller 负责四件事：路由映射、HTTP 状态码、触发请求体校验、委托
service。它的方法体内没有条件分支、没有字符串处理、没有 repository
访问（`src/main/java/com/bytedance/todos/controller/TodoController.java:29-50`）。

约束什么：成功路径的状态码全部由 controller 上的 `@ResponseStatus` 声明
（create 201、update 200、delete 204，`TodoController.java:35,41,47`）；
错误路径的状态码则来自其他层——400 来自校验/反序列化（见 4.1、4.2），
404 来自 service 异常（见 2.2）。

违反后果：三个成功状态码都被测试钉住：201
（`TodoControllerTest.java:47`）、200（`TodoControllerTest.java:157`）、
204（`TodoControllerTest.java:131`）。其中 delete 的 204 依赖 controller
方法返回 `void` 配合 `@ResponseStatus(NO_CONTENT)`
（`TodoController.java:46-50`），service 的 `delete` 同样返回 `void`
（`TodoService.java:55-60`）；改成返回体就会破坏 204 无响应体的契约。
在 controller 中新增业务判断只会与 service 已做出的决策重复或不可达。

### 3.2 controller 直接返回领域实体，没有 response DTO

list / create / update 直接返回 `Todo` 或 `List<Todo>`
（`TodoController.java:30,36,42`），模块内不存在专门的响应对象。

违反后果：实体的每个 getter 都会被 Jackson 序列化为响应字段，未设值字段
输出为 `null`——`createsTodoWithNullDescriptionAndPriorityWhenOmitted`
断言省略的 `description` / `priority` 在响应中是 `null`
（`TodoControllerTest.java:84-96`）。因此给 `Todo` 增加 getter 会在不改
controller 的情况下自动改变 API 响应形状；实体 getter 列表
（`src/main/java/com/bytedance/todos/model/Todo.java:62-100`）必须与根目录
`AGENTS.md` 记录的 response shape 保持一致，新增持久化字段前先要确认它
是否应该出现在 API 响应中。

## 4. 参数校验分几类、各放在哪里

当前对请求的把关按发生顺序分为四类，位置各不相同，不要在同一处重复
实现：

### 4.1 Bean Validation：声明在 DTO，由 controller 的 `@Valid` 触发

请求体字段上唯一的声明式校验是 `title` 的非空非空白约束
（`src/main/java/com/bytedance/todos/dto/CreateTodoRequest.java:7`、
`src/main/java/com/bytedance/todos/dto/UpdateTodoRequest.java:7`），它靠
controller 参数上的 `@Valid` 在请求绑定之后、进入 service 之前执行
（`TodoController.java:36,42`），失败返回 400。

约束什么：字段级声明式校验只放在 DTO 上；service 不重复判断 title 是否
为空——它对 title 只做 `trim()`（`TodoService.java:35,42`）。

违反后果：空白 title 被 400 拒绝有测试钉住
（`rejectsBlankTitleOnUpdate`，`TodoControllerTest.java:202-214`，请求体
为全空格 title）。这道注解是唯一的拦截点：service 不判空，而数据库的
`title ... NOT NULL`（`src/main/resources/db/migration/V1__create_todos.sql:3`）
不拒绝空字符串。去掉 `@Valid` 或该注解，空白 title 会被 trim 成 `""`
正常落库，而不是返回 400。

`description` 和 `priority` 上刻意没有校验注解：它们是可选字段，缺省或
空白的语义由 service 归一化处理（见 2.1、4.4），不属于校验错误。

### 4.2 枚举取值：Jackson 反序列化阶段拒绝，请求到不了 service

`priority` 的合法取值由 Java 枚举类型本身界定。请求中出现枚举之外的值
（如 `"URGENT"`）时，Jackson 在反序列化为 `TodoPriority` 时即失败，
请求不会进入 controller 方法体，返回 400。

约束什么：不要在 DTO 上再加枚举取值注解，也不要在 service 里写枚举值
判断——service 中 `priority` 是直接透传的（`TodoService.java:35,51`），
非法请求永远到不了那里。

违反后果：`rejectsInvalidPriority` 对非法 priority 断言 4xx
（`TodoControllerTest.java:113-124`）。新增合法优先级值的正确位置是枚举
类型本身（并配套数据库 CHECK 约束，见 4.5），而不是在校验代码里放宽。

### 4.3 存在性校验：service 层，失败为 404

见 2.2。`id` 不存在的判断发生在 service 的 `findById` 之后，产生 404，
与 4.1/4.2 的 400 分属不同层、不同语义。

### 4.4 归一化不是校验

trim 与空白转 `NULL` 是接受请求后的数据清洗
（`TodoService.java:28-35,43-50`），不产生错误响应：纯空白 description
返回 201 且字段为 `null`（`TodoControllerTest.java:98-111`）；update 时
显式传 `"priority": null` 与空白 description 同样被接受并清空
（`updatesTodoClearsDescriptionAndPriority`，
`TodoControllerTest.java:172-188`）。title 的空白在 4.1 阶段已被 400
拒绝，service 的 trim 只处理“带空白的合法值”
（`TodoControllerTest.java:145-170`）。

### 4.5 存储层约束：数据库兜底，schema 由 Flyway 管理

最后一道把关在数据库，且它拦截的问题与前几层不同：

- `description` 的长度边界是数据库列 `VARCHAR(2000)`
  （`src/main/resources/db/migration/V2__add_todo_fields.sql:1`），实体上
  对应同样的长度声明（`src/main/java/com/bytedance/todos/model/Todo.java:27`）；
  DTO 层没有长度校验，超长请求不会在 400 阶段被拦，而是在写库时失败
  （根目录 `AGENTS.md` 已明确“API DTO 层不校验长度”）。
- `status` / `priority` 的取值在数据库有 CHECK 约束
  （`V1__create_todos.sql:8`、`V2__add_todo_fields.sql:3-4`）。经由 API
  的写入在 4.2 和实体类型阶段已被枚举限制，CHECK 是库内防线。
- `ddl-auto` 为 `validate`（`src/main/resources/application.yml:13`），
  Hibernate 启动时只校验实体与表结构一致，不建表、不改列。实体新增字段
  必须配套新增 Flyway migration（`description` / `priority` 两列即由
  `V2__add_todo_fields.sql` 添加）；只加实体字段不加 migration，服务
  启动即因 schema 校验失败而无法启动。

## 5. Repository 的职责限制

repository 只承载数据访问：查询意图通过 Spring Data 派生方法名声明
（排序见 2.4），模块内没有 repository 实现类、没有手写 SQL 或 JDBC 代码
（`src/main/java/com/bytedance/todos/repository/TodoRepository.java:7-9`）。

约束什么：

- 业务规则不进入 repository。归一化、存在性判断、错误响应都在 service
  完成；repository 的 `save` 调用点
  （`TodoService.java:35,52`）拿到的实体已经是最终待存状态。
- repository 不被 service 之外的生产代码调用（见第 1 节）。

违反后果：把业务判断放进 repository，或让 controller 直接注入
repository，都会使 2.1 的归一化和 2.3 的事务失去唯一执行点——当前代码里
`trim()` 与 `@Transactional` 各只有一个归属层，绕过 service 没有任何
补偿机制。

## 6. Model（Todo 实体）的职责限制

### 6.1 业务代码的写入面只有 title / description / priority

实体对外暴露的写入入口是构造器参数与三个 setter：
`Todo(title, description, priority)`
（`src/main/java/com/bytedance/todos/model/Todo.java:44-48`）和
`setTitle` / `setDescription` / `setPriority`
（`Todo.java:70-88`）。`id`、`status`、`createdAt`、`updatedAt` 既没有
setter，也不出现在构造器参数中。

约束什么：service 能修改的字段因此被实体结构限定为这三个
（`TodoService.java:42-51`）；数据库托管的值（主键、时间戳）和工作流
状态不允许业务代码直接赋值。

违反后果：update 后 `id` 与 `status` 保持原值被测试钉住
（`TodoControllerTest.java:161-162`）。需要让业务代码写入这些字段时，
改动点是实体本身的公开 API 及对应的 API 契约，而不是在 service 里补一次
方法调用。

### 6.2 status 在创建时固定为 TODO，之后不可变

`status` 字段初始化为 `TODO`（`Todo.java:25`），构造器不接收 status，
类中只有 `getStatus` 没有 `setStatus`（`Todo.java:90-92`）；service 中
没有任何对 status 的赋值。

约束什么：当前 API 不存在状态流转，“update 不修改 status”不是靠 service
自觉，而是实体不提供修改入口，在编译期就无法表达。

违反后果：create 响应 `status` 为 `TODO`
（`TodoControllerTest.java:49,79`）；update 提交全字段后 `status` 仍为
`TODO`（`TodoControllerTest.java:161`）。不要为了尚未存在的流转接口添加
`setStatus`；若未来契约引入状态变更，应先改契约与实体，再由 service
使用新入口。

### 6.3 时间戳只由实体生命周期回调写入

`createdAt` / `updatedAt` 只在 `@PrePersist` / `@PreUpdate` 回调中赋值
（`Todo.java:50-60`），service 和 controller 中没有任何设置时间戳的
代码。

约束什么：时间戳是持久化托管字段，业务代码不读取系统时钟去填充它们。

违反后果：数据库两列均为 `NOT NULL`
（`src/main/resources/db/migration/V1__create_todos.sql:5-6`），而插入
路径上唯一给它们赋值的就是 `@PrePersist` 回调；删掉回调或在 service
手工赋值，都会与这一既有机制冲突——前者导致插入直接失败，后者会被回调
覆盖，形成两套时间来源。
