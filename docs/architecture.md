# 跨模块架构约束

本文只记录 `apps/web`、`apps/cli`、`services/api` 三个模块之间的跨模块
约束。各模块内部的分层约定留在各自的文档里
（`apps/web/docs/architecture.md`、`apps/cli/docs/architecture.md`、
`services/api/docs/architecture.md`），本文不重复；领域模型、API 端点契约
等产品级内容见根目录 `AGENTS.md`，本文也不重复。每条约束均给出当前代码或
配置中的印证位置（路径相对仓库根目录）。

## 1. 模块间禁止的依赖方向

三个模块是互相独立的工程，各自拥有依赖清单、lockfile 和构建入口：
`apps/web/package.json` + `apps/web/pnpm-lock.yaml`、
`apps/cli/package.json` + `apps/cli/pnpm-lock.yaml`、
`services/api/build.gradle` + `services/api/settings.gradle` + 自带
Gradle wrapper。仓库根目录不存在任何模块清单或构建文件（根目录无
`package.json`、`pnpm-workspace.yaml`、`build.gradle`、`settings.gradle`）。

在此结构上，依赖方向约束为：

1. **`services/api` 不依赖 `apps/web` 或 `apps/cli`。**
   印证：`services/api/build.gradle:20-28` 的依赖只有 Spring Boot
   starters、Flyway、H2 和测试 starter；`services/api/settings.gradle:1`
   是独立的 `rootProject.name = 'todos-api'`，没有任何 `include`；
   `services/api` 源码包根 `com.bytedance.todos` 下不引用 app 侧代码。
2. **`apps/web` 不依赖 `apps/cli`，也不直接访问数据库。**
   印证：`apps/web/package.json:12-17` 的运行依赖只有 `react`、
   `react-dom`、Semi 相关包，没有对 cli 或 api 的引用，也没有
   `workspace:` / `file:` 形式的本地依赖；`apps/web/src` 中不存在对
   `apps/cli` 的 import（唯一出现 "services/api" 字样的位置是
   `apps/web/src/i18n/zhCN.ts:20` 的错误提示文案，不是代码依赖）；web
   侧没有任何数据库驱动或连接配置，数据只能经 services 层 HTTP 出口
   访问（见第 2 节）。
3. **`apps/cli` 不依赖其他两个模块。**
   印证：`apps/cli/package.json:19-21` 的唯一运行依赖是 `commander`；
   `apps/cli/src` 全部源码中没有任何网络调用或 HTTP 相关 import
   （`fetch`/`http`/`https`/`axios` 等均无匹配）。cli 当前是不发起网络
   请求的底座，与 web、api 之间没有代码或运行时连接。
4. **模块之间不通过共享代码包复用逻辑。**
   印证：仓库中不存在 `packages/`、`shared/` 之类的共享包目录（根目录
   只有 `apps/`、`services/`、`docs/`、`scripts/`、`openspec/` 及技能
   配置目录）；需要跨进程一致的数据结构由各方各自定义——web 侧的 Todo
   类型是手写的本地镜像 `apps/web/src/types/todo.ts:4-12`，不是从后端
   包导入。根目录 `AGENTS.md` 的实现规则同样明确：不添加
   `pnpm-workspace.yaml`、不添加 root `package.json`、不引入 shared
   packages（除非明确要求）。

约束的配置后果：三个清单完全独立解析——`scripts/dev.sh:397` 在 web 目录
内运行 `pnpm dev`（使用 web 自己的依赖与 lockfile），
`scripts/dev.sh:388` 在 `services/api` 目录内运行 `./gradlew bootRun`
（使用 api 自己的 Gradle build）。任何跨模块 import 或共享包都无法在这套
各自安装、各自构建的结构中解析，必须先引入 workspace/共享构建才能成立，
而那属于需要明确批准的结构变更。

## 2. 模块间数据交换允许的方式

1. **唯一在运行的数据通道是 `apps/web` → `services/api` 的 HTTP REST
   （JSON）。**
   印证：
   - web 侧网络出口只有一处：`apps/web/src/services/todosService.ts:6`
     的 `fetch(`${apiBaseUrl}${path}`)`；`fetch` 在整个 `apps/web/src`
     中只出现这一次。四个导出函数与后端四个端点一一对应
     （`apps/web/src/services/todosService.ts:25-58`）。
   - 目标地址由环境变量配置：`VITE_API_BASE_URL`，缺省回退
     `http://localhost:18080`（`apps/web/src/services/todosService.ts:3`）。
   - api 侧只通过 CORS 放行这条通道：
     `services/api/src/main/java/com/bytedance/todos/config/WebConfig.java:18-21`
     对 `/api/**` 放行配置的 origin 与 GET/POST/PUT/PATCH/DELETE/
     OPTIONS；origin 来自 `app.cors.allowed-origin`（环境变量
     `CORS_ALLOWED_ORIGIN`），缺省 `http://localhost:15173`
     （`WebConfig.java:12`、
     `services/api/src/main/resources/application.yml:22-24`）。
   - 本地启动脚本负责把两端接线：启动 api 时注入
     `CORS_ALLOWED_ORIGIN="http://localhost:${WEB_PORT}"`
     （`scripts/dev.sh:388`），启动 web 时注入
     `VITE_API_BASE_URL="$API_BASE_URL"`（`scripts/dev.sh:397`）。
2. **交换的契约是根目录 `AGENTS.md` 记录的 REST API；不使用生成的
   client，不共享类型包。**
   印证：web 侧 client 是手写的 fetch 封装（`todosService.ts` 全文），
   仓库中不存在 codegen 配置或生成代码目录；请求/响应形状以 web 本地
   类型镜像表达（`apps/web/src/types/todo.ts`），后端不发布任何供前端
   消费的代码包。这与根目录 `AGENTS.md`“当前 API 使用简单 REST，不使用
   generated clients”的规则一致。
3. **数据持久化只属于 `services/api`，其他模块不碰存储。**
   印证：api 使用 in-memory H2
   （`services/api/src/main/resources/application.yml:5`，
   `jdbc:h2:mem:todos`），数据库迁移只在 api 内
   （`services/api/src/main/resources/db/migration/`）；web 和 cli 各自的
   依赖清单中没有任何数据库驱动。
4. **`apps/cli` 当前不参与任何模块间数据交换。**
   印证见第 1 节第 3 条：cli 源码无网络调用、依赖中无 HTTP 库。本文不
   规定 cli 未来接入后端的方式——当前代码里不存在这条通道。

## 3. 仓库根目录不允许出现的文件

根目录不是构建单元，以下文件的缺失本身就是当前结构的一部分，新增即构成
跨模块结构变更：

1. **`pnpm-workspace.yaml`**：根目录不存在该文件。它会把
   `apps/web`、`apps/cli` 两个独立 pnpm 工程（各自带 `pnpm-lock.yaml`）
   合并进同一个 workspace 安装图，改变两个模块独立安装、独立 lockfile 的
   现状。根目录 `AGENTS.md` 明确要求除非明确要求否则不添加。
2. **根级 `package.json`**：根目录不存在该文件。两个 Node 模块的清单分别
   是 `apps/web/package.json`、`apps/cli/package.json`，根级清单会制造
   第三个依赖解析位置和根级脚本入口。
3. **根级构建/测试编排文件**：根目录不存在 `build.gradle`、
   `settings.gradle`、`turbo.json`、`nx.json`、`lerna.json` 等编排文件。
   `services/api` 是自包含的独立 Gradle 工程
   （`services/api/settings.gradle:1`），Node 侧两个模块各自构建；根目录
   `AGENTS.md` 要求优先使用 focused project-level checks，不引入
   root-level build 或 test orchestrator（除非明确要求），其 Code Review
   规则要求标记未经批准添加的 root-level build 或 workspace files。
4. **共享包目录或共享代码文件**：根目录下不存在 `packages/`、`shared/`
   等供多模块 import 的代码目录；跨模块复用只能通过第 2 节的 HTTP 契约
   或各自本地定义类型实现。

根目录允许存在的是文档与工具性内容：`AGENTS.md`、`README.md`、
`skills-lock.json`、`docs/`（含本文）、`scripts/`（本地启动便利脚本，
不改变模块边界，见 `scripts/dev.sh`）、`openspec/` 以及各 agent/技能的
配置目录。
