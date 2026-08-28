# services/api 测试策略

本文规定 `services/api` 模块的测试组织方式，分层口径与
`services/api/docs/architecture.md` 完全一致（controller → service →
repository，`model` 共用，`dto` 在 controller 与 service 之间）。每条
判断依据都指向现有测试代码的具体位置（路径相对 `services/api` 模块根
目录）；指不到证据的规则不写。模块技术栈与运行命令见
`services/api/AGENTS.md`，本文不重复。

## 1. 测试形态：在 HTTP 边界做全栈测试

模块现有测试只有一种形态：启动完整 Spring context 的全栈测试。

- 类注解是 `@SpringBootTest` + `@AutoConfigureMockMvc`
  （`src/test/java/com/bytedance/todos/controller/TodoControllerTest.java:24-25`），
  注入 `MockMvc` 发请求（`TodoControllerTest.java:27-28`）。一次请求走完整
  条链路：Spring MVC 路由 → Jackson 反序列化 → Bean Validation →
  controller → service → repository → 真实 H2 数据库，再把实体序列化回
  JSON。
- 测试使用独立的 in-memory H2（数据源 `todos-test`，
  `src/test/resources/application.yml:3`），context 启动时 Flyway 迁移和
  Hibernate `validate` 真实执行（生产配置 `ddl-auto: validate`，
  `src/main/resources/application.yml:13`）。
- 测试不使用任何 mock：整个 `src/test` 下没有 Mockito 或其他 mock 框架的
  使用，测试依赖只有 `spring-boot-starter-test`
  （`build.gradle:26-27`，测试任务 `useJUnitPlatform()`，
  `build.gradle:30-32`）。

约束什么：新增测试沿用同一形态——`@SpringBootTest` + `MockMvc` 发真实
HTTP 请求、对状态码和响应 JSON 断言，不引入新的测试框架或 mock 依赖。

判断依据：架构文档中每一类可观察行为都是跨层链路的结果，而不是某一层的
内部状态。例如非法 `priority` 在 Jackson 反序列化阶段就被拒绝、请求到不
了 service（架构文档 4.2）；空白 `title` 由 controller 参数上的 `@Valid`
在进 service 前拦截（架构文档 4.1）；响应字段形状由 controller 直接返回
实体、Jackson 序列化 getter 决定（架构文档 3.2）。把某一层 mock 掉的隔离
测试无法表达“请求在某层之前就被拒绝”或“实体 getter 即响应字段”这类
链路事实，因此本模块的测试单元是“一个 HTTP 请求的完整处理结果”。

## 2. 每一层该测什么、断言落在哪里

所有业务断言都落在 HTTP 响应上（状态码、JSON 体、响应头）；各层的行为
通过它在响应上的可观察结果来验证，而不是直接调用该层的类。

### 2.1 controller 层：路由、HTTP 状态码、跨切面配置

- 路由与 HTTP 方法：用 `get/post/put/delete/options` 打到
  `/api/todos...` 路径
  （`TodoControllerTest.java:40,51,59,130,148,192`），路径或动词映射错了
  请求就到不了对应方法。
- 成功状态码：create 断言 201（`TodoControllerTest.java:47`）、update
  断言 200（`TodoControllerTest.java:157`）、delete 断言 204
  （`TodoControllerTest.java:131`）。
- 跨切面 HTTP 配置（CORS）：发 OPTIONS 预检请求并断言响应头
  （`TodoControllerTest.java:58-64`）。

controller 方法体本身没有分支（架构文档 3.1），因此不存在“把 controller
单独隔离起来测”的形态；它的职责全部通过上述 HTTP 可观察项验证。

### 2.2 校验链：四类把关各有对应的断言方式

按架构文档第 4 节的分类，每类校验的测试断言点不同，不能互换：

- Bean Validation 拒绝（架构 4.1）：发空白 `title`，断言 400
  （`rejectsBlankTitleOnUpdate`，`TodoControllerTest.java:202-214`）。
- Jackson 枚举反序列化拒绝（架构 4.2）：发枚举外的 `"URGENT"`，断言
  4xx（`rejectsInvalidPriority`，`TodoControllerTest.java:113-124`）。
  这条能成立的前提是请求体以 JSON 文本发送（见 5.3）——在测试里直接构造
  DTO 就无法表达非法枚举值。
- service 存在性判断（架构 4.3）：对不存在的 id 发请求，断言 404
  （`TodoControllerTest.java:139-142,191-200`）。
- 归一化（架构 4.4）：不是错误路径，断言 2xx 且响应体内容被改写——
  trim 后的字段值（`TodoControllerTest.java:78-81,158-160`）、空白
  description 落为 `null`（`TodoControllerTest.java:108-110`）、update
  显式传 `null` 清空字段（`TodoControllerTest.java:185-187`）。

### 2.3 service 层：归一化结果与业务决策，通过响应体观察

service 不被测试直接引用（`TodoControllerTest.java` 的 import 中没有
`com.bytedance.todos.service`），它的行为通过响应 JSON 验证：

- 归一化结果用 `jsonPath` 断言字段最终值
  （`TodoControllerTest.java:80,109,158-160,186-187`）。
- 省略可选字段时响应中为 `null`，用 Hamcrest `nullValue()` 断言
  （`TodoControllerTest.java:94-95`）。
- 404 决策通过状态码断言（见 2.2）。

### 2.4 repository 层：验证持久化副作用，不直接断言查询方法

- repository 在测试中的合法用途是夹具：`@BeforeEach` 里 `deleteAll()`
  清表（`TodoControllerTest.java:33-36`），用 `save` 造前置数据
  （`TodoControllerTest.java:128,146,174`）。
- 业务断言不放在 repository 返回值上：写操作的持久化效果通过**再发一个
  请求**验证——delete 后 `GET /api/todos` 列表为空
  （`TodoControllerTest.java:133-135`）；update 后再 `GET` 确认新值已落库
  （`TodoControllerTest.java:164-169`）。
- 列表读取的对外结果（列表内容）通过 `GET /api/todos` 的 `jsonPath`
  断言（`TodoControllerTest.java:53-54,166-169`），而不是在测试里调用
  repository 查询方法。

### 2.5 model 层：响应形状与不可变字段

实体直接作为响应体（架构 3.2），因此模型层的约定通过响应 JSON 验证：

- 未设值字段序列化为 `null`（`TodoControllerTest.java:94-95`）。
- create 响应 `status` 为 `TODO`（`TodoControllerTest.java:49,79`）；
  update 提交全字段后 `id`、`status` 保持原值
  （`TodoControllerTest.java:161-162`）——对应架构文档 6.1/6.2 的写入面
  限制。

### 2.6 schema 与 Flyway 迁移：由 context 启动兜底，不写专门测试

实体与表结构的一致性、迁移脚本能否执行，在每个测试启动 Spring context
时就被真实执行（Flyway 迁移 + `ddl-auto: validate`，见第 1 节）。迁移
脚本有问题或实体与表不匹配，整套测试在 context 启动阶段即失败，不需要
也不存在单独的测试方法。

## 3. 单元与集成的分工依据

本模块当前只有第 1 节描述的全栈集成测试，没有分层隔离的单元测试，这一
选择的依据是：

1. 架构文档中的行为规则全部定义在层与层的交界处：校验发生在请求进入
   service 之前（架构 4.1/4.2），归一化发生在 service 内（架构 2.1），
   响应形状由出口处的实体序列化决定（架构 3.2）。这些规则没有一条是
   “某个类的纯内部计算”，mock 掉邻层后规则本身就不存在了。
2. 测试与内部结构解耦：测试不 import `service`、`dto` 包
   （`TodoControllerTest.java:1-22` 的 import 只有 `model`、`repository`
   和 Spring Test），请求和断言都只针对 HTTP 契约。因此 service /
   repository / model 内部的重构（重命名、拆方法、调整实现）只要不改变
   API 行为，测试不需要改动；测试随 API 契约变化，不随内部结构变化。
3. `model` 和 `repository` 出现在测试中仅用于夹具（造数、清表，见
   2.4），不是被直接断言业务行为的对象。

判断依据的可印证位置：全部现有测试方法都遵循“HTTP 请求 → 响应断言”的
同一形状（`TodoControllerTest.java:38-214`），没有一个方法直接实例化或
调用 service。

## 4. 哪些改动必须补测试

以下每一条都是“改动发生在哪一层、就补哪种断言”的触发条件，括号内为该
断言方式在现有测试中的印证位置：

- 新增 endpoint，或改动路由、HTTP 动词、成功状态码：补 MockMvc 请求与
  状态码断言（印证：201/200/204 断言，
  `TodoControllerTest.java:47,131,157`）。
- 改动 DTO 上的声明式校验（架构 4.1）：补非法输入返回 400 的用例
  （印证：`TodoControllerTest.java:202-214`）。
- 改动枚举类型取值（架构 4.2）：补枚举外取值返回 4xx 的用例，请求体用
  JSON 文本（印证：`TodoControllerTest.java:113-124`）。
- 改动 service 的归一化、缺省值或清空语义（架构 2.1/4.4）：补响应体
  `jsonPath` 断言，断言改写后的最终值（印证：
  `TodoControllerTest.java:67-82,98-111,172-188`）。
- 改动“资源不存在”的判断或状态码（架构 2.2）：补 404 用例（印证：
  `TodoControllerTest.java:138-142,190-200`）。
- 改动实体暴露给响应的字段或形状（架构 3.2/6.1/6.2）：补 `jsonPath`
  断言，包括未设值字段为 `null` 的语义（印证：
  `TodoControllerTest.java:94-95,161-162`）。
- 改动 CORS 等 HTTP 跨切面配置：补对应请求与响应头断言（印证：
  `TodoControllerTest.java:58-64`）。
- 改动 Flyway 迁移或实体表结构映射（架构 4.5）：不补测试方法，但必须
  让整套测试完成 context 启动——启动失败即迁移或映射有误（见 2.6）。

## 5. 测试文件的位置、命名与数据约定

### 5.1 位置与命名

- 测试代码在 `src/test/java/com/bytedance/todos/` 下，包结构镜像 main
  代码：现有的 `controller/TodoControllerTest.java` 对应 main 的
  `controller/TodoController.java`。
- 测试类命名为 `<被测入口类>Test`；测试资源放在
  `src/test/resources/`（现有 `application.yml` 提供测试专用数据源）。
- 测试方法名陈述“行为 + 预期结果”，如 `createsTodoWithTrimmedDescriptionAndPriority`、
  `rejectsInvalidPriority`、`returns404WhenDeletingNonExistentTodo`、
  `updatesTodoClearsDescriptionAndPriority`
  （`TodoControllerTest.java:67,114,139,173`）；不按内部方法名命名。

### 5.2 框架与断言工具

- JUnit 5（`org.junit.jupiter.api.Test` / `BeforeEach`，
  `TodoControllerTest.java:16-17`），Spring Boot Test 的 `MockMvc`
  发请求、`MockMvcResultMatchers`（`status` / `jsonPath` / `header`）
  做断言，Hamcrest matcher（`hasSize`、`nullValue`）表达 JSON 预期
  （`TodoControllerTest.java:5-6,12-14`）。不引入这些之外的框架。

### 5.3 请求体用 JSON 文本，不构造 DTO

所有请求体都以 JSON 文本块书写
（`TodoControllerTest.java:42-46,70-76,117-122` 等），测试中不实例化
`dto` 包的类。这样 Jackson 反序列化链路被真实执行，非法枚举、缺字段等
请求才能和生产中一样被拒绝（印证：`rejectsInvalidPriority` 能发出
`"URGENT"` 这样的非法值，`TodoControllerTest.java:117-122`）。

### 5.4 数据隔离与夹具

- 每个测试方法开始前清表：`@BeforeEach` 调 `todoRepository.deleteAll()`
  （`TodoControllerTest.java:33-36`），测试不依赖其他方法留下的数据，也
  不依赖执行顺序。
- 前置数据通过注入的 `TodoRepository` 配合 `Todo` 实体构造器直接造
  （`TodoControllerTest.java:128,146,174`），被测行为本身仍走 HTTP
  请求。
- 需要测试专用配置时，用 `@SpringBootTest(properties = ...)` 在注解上
  覆盖（CORS 用例把 allowed-origin 覆盖为
  `http://localhost:15174`，`TodoControllerTest.java:24,60`），不修改
  `src/main/resources/` 下的生产配置。
