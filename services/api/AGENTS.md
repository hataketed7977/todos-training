# services/api Agents 指南

本文件记录只对 `services/api` 模块成立的约定，供在本模块内改代码的 coding
agents 使用。跨模块的仓库结构、产品契约、领域模型、API 契约、验证矩阵和全局
实现规则见根目录 `AGENTS.md`。

## 文档索引

本模块 `docs/` 下的专题文档，按任务类型先读：

- `docs/architecture.md`：模块内部分层约定——业务逻辑归 service、controller
  的 HTTP 适配边界、四类参数校验的位置、repository 与 model 的职责限制。
  新增端点、改动 controller/service/repository 分层或新增校验逻辑前先读。
- `docs/api-design.md`：HTTP 接口设计约定——资源命名、201/200/204 状态码
  选型、错误表达形式。新增或修改 endpoint、调整状态码或错误响应前先读。
- `docs/testing.md`：测试策略——全栈集成测试形态、各层测试侧重、必须补
  测试的改动场景、测试文件位置与命名。编写测试或改动需要补测试的代码前先读。

## 模块说明

`services/api` 拥有 Todo business logic、persistence 和 REST APIs，是系统里
唯一的 backend service。

技术：

- Java 21
- Spring Boot 3
- Gradle
- Spring Web MVC
- Spring Data JPA
- Bean Validation
- Flyway
- H2

允许：

- 拥有 Todo business rules。
- 拥有 persistence。
- 暴露 REST APIs。
- 拥有 database migrations。
- 返回 web 消费的 API response shapes。

不允许：

- 依赖 `apps/web`。
- 依赖 `apps/cli`。
- 让 Hibernate 自动 mutate schema。

Java package root 是 `com.bytedance.todos`。源码在
`src/main/java/com/bytedance/todos/`，按 `controller` / `dto` / `model` /
`repository` / `service` / `config` 分包；配置文件和 Flyway migrations 在
`src/main/resources/`。

## 本地命令

在 `services/api` 目录下运行：

```bash
./gradlew bootRun
./gradlew test
./gradlew test --rerun-tasks
```

api changes 的 focused check 是 `./gradlew test --rerun-tasks`。

## 数据库

本地训练使用 in-memory H2，服务重启后数据会重置。

配置以 `src/main/resources/application.yml` 为准：服务端口 `18080`，
`spring.jpa.hibernate.ddl-auto` 为 `validate`，H2 console 启用，CORS allowed
origin 通过 `app.cors.allowed-origin`（环境变量 `CORS_ALLOWED_ORIGIN`，默认
`http://localhost:15173`）配置。

Database schema changes 由 `src/main/resources/db/migration/` 下的 Flyway
migrations 管理（当前为 `V1__create_todos.sql`、
`V2__add_todo_fields.sql`）。Hibernate 启动时 validate schema，但不会修改
schema。

Tests 使用 `src/test/resources/application.yml` 配置的独立 in-memory H2
database。

## 实现规则

- 保持 backend 是单个 Spring Boot service。
- 除非明确引入其他 database，否则 persistence 保持 in-memory H2。
- 当前 backend 不包含 authentication。

## Code Review 规则

review 本模块变更时：

- 标记跳过 Flyway migrations 的 schema changes。
- 标记会 mutate schema 的 Hibernate schema generation settings。
