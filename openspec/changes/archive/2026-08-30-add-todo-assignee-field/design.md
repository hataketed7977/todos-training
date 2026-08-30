## Context

本训练仓库是一个包含 `services/api`（JPA + H2 in-memory + Flyway）、`apps/web`（React + Semi + Vite）、`apps/cli`（Node.js 20 + Commander + node:fetch）三个独立模块的 monorepo，三模块之间不共享代码、无 shared packages、无 pnpm workspace。Todo 领域模型目前包含 id、title、status（TODO/DOING/DONE，enum）、description（VARCHAR(2000) NULL，trim→NULL）、priority（LOW/MEDIUM/HIGH enum NULL，"不传→NULL、update 不传→清空"）、createdAt、updatedAt 七字段。列表接口按 createdAt DESC 排序。

当前已存在 8+ 条 requirement 级别的 spec（description、priority、update API、edit modal、title search filter 等），`TodoController` 暴露 `/api/todos` 单路径服务两个消费方（URL 路径隔离按用户最新确认保持现状）。

## Goals / Non-Goals

**Goals:**
- 在不改变既有 status 工作流、不引入用户体系前提下，在 Todo 领域增加"负责人"自由文本字段，并在 API、Web、CLI 三层闭环。
- assignee 的 update 语义与 trim/NULL 归一化策略与 priority/description 可空字段派保持一致，降低学习成本。
- Flyway V3 migration 只加可空列，Hibernate ddl-auto 仍为 validate，训练用 in-memory H2 重启即清无需存量数据迁移。
- Web UI 保持现有视觉风格（Semi + tertiary 文本），不引入颜色/头像/下拉等 UI 体系。
- CLI 仅新增最小化 create + search 的字段支持，不引入新子命令。

**Non-Goals:**
- 不引入 users 表、UserEntity、鉴权/登录。
- 不做按 assignee 过滤（前端内存筛选或后端查询参数均不做）。
- 不做 URL 路径隔离（`/api/web/...` vs `/api/cli/...`）。
- 不新增 assignee 排序规则，仍严格按 createdAt DESC。
- 不引入枚举 assignee。
- 不在前端/CLI 层执行 assignee 的 trim 归一化，统一交给后端（避免双端逻辑不一致）；但 Web 层 Modal 仍需在提交时对"纯空白 → null/undefined"做前端语义归一，以便让省略字段等价于 null。

## Decisions

### 1. 字段选型：纯 VARCHAR(255) NULL 自由文本（选项 A）

- **Decision**: `TodoEntity.assignee` 类型为 `@Column(length = 255) String assignee`，DB 中是 `VARCHAR(255) NULL`，Flyway 迁移附加 `CHECK (length(assignee) <= 255)` 作为双保险。
- **Rationale**:
  - 训练仓库零用户体系，引入枚举/外键无意义且 scope 爆炸；
  - 255 字符足够容纳"姓名/邮箱/昵称/群组"的常见写法；
  - 与 description 字段的"自由文本 + NULL 可空"基线一致，开发者学习曲线平坦。
- **Alternatives considered**：
  - 枚举 AssigneeRole：适合任务类型标签而非"负责人归属"，排除；
  - 外键 users.id：在零 auth/用户上下文下过度设计，排除。

### 2. Update 语义：采用 priority 派（不传 → 清空 NULL）而非 status 派（不传 → 保留原值）

- **Decision**: `PUT /api/todos/{id}` 中，请求体不含 `assignee` / 含 `"assignee": null` / 含 trim 后空字符串时，后端一律将 Todo.assignee 置 NULL（清空）。仅当提供非空字符串时写入。
- **Rationale**:
  - assignee 与 priority/description 同属"可空属性域"，语义一致；
  - 唯一的"不传保留"派（status）是 workflow 状态的向后兼容特例，不适用于属性域。
- **Mitigation for UX pitfall**: Web 编辑 Modal 有预填（[spec §Web edit modal with prepopulated values](file:///Users/bytedance/workspace/bytedance/todos-training/openspec/specs/todos/spec.md#L144) 已经要求预填），所以用户正常操作不会误清空；只有用户主动删除输入内容才会清空。对直连 API 的调用方，此行为将在 spec scenario 中显式写出。

### 3. Trim 归一化执行位置：只在后端 service 层做，Web/CLI 层仅做"空白等价 undefined"的提交归一

- **Decision**:
  - Service 层在 `create(CreateTodoRequest)` / `update(Long, UpdateTodoRequest)` 内对 `request.assignee()` 做 `s = StringUtils.trimToNull(s)`（Spring 自带或等价），得到 null/非空两个分支直接写 entity；
  - Web 层 Modal 提交前只做 `value?.trim() === '' ? undefined : value`（即纯空白省略键），不做实际 trim 写入，避免与后端重复；
  - CLI 层 `--assignee <name>` 收到什么值就透传什么，不额外 trim。
- **Rationale**: 单端归一化（Service 是权威）最容易测试与避免双端不一致。如果三层都 trim，边界变复杂。

### 4. 各层测试形态（为 spec-driven-tdd 的 tasks 做准备，不是实现细节）

- **API（TDD 三阶段）**：TodoControllerTest.java 已存在，用 @SpringBootTest + MockMvc + TestEntityManager 的全栈集成测试。重点覆盖 7+ scenario：创建带/不带 assignee、trim→NULL、非法 JSON 类型（对象/数组）、更新写值、更新不传清空、更新空白清空、排序不受影响。
- **Web**：项目目前 focused check 是 `pnpm build`（无自动化测试框架，见 apps/web AGENTS.md §验证矩阵），用 TypeScript 类型 + 构建 + lint 做门禁。
- **CLI**：`node:test` 基于 dist 的进程内测试（apps/cli/testing.md），在现有 create.test.ts、search.test.ts 分别加 assignee 相关用例；`build + test` 两个 focused check。

### 5. 数据交换形态：TodoEntity 直接序列化为 JSON（保持当前 Controller 直接 `return TodoEntity` 的模式）

- **Decision**: 不新增 TodoResponse DTO，继续让 TodoEntity 的字段直接映射 JSON，新增 assignee 后序列化自然带出。此行为与 description/priority 引入时的模式一致。
- **Rationale**: demo 规模小，DTO 映射层无收益。若将来增加用户体系再拆分。

## Risks / Trade-offs

- **[风险] 直接 API 调用方对 update 语义的预期差异**（"不传字段"是否=清空？）→ Mitigation：spec 里用三个 scenario（Scenario: 更新时不传 assignee 导致清空 / 传空白导致清空 / 传新值正常写入）显式锁定，TodoControllerTest 用 400/200 的回归覆盖。
- **[风险] Hibernate 校验失败**（TodoEntity 新增字段但 Flyway 漏加迁移）→ Mitigation：tasks.md TDD 的 RED Phase 第一条就是"写失败测试：Spring boot 启动在 migration 前失败，或 TodoControllerTest 的 CRUD 用例因 assignee 列不存在而 SQL 失败"，以 RED 态先锁"迁移必要"的证据，再写 V3。
- **[Trade-off] 前端不引入负责人下拉**，意味着负责人拼写不一致会产生碎片化数据 → Mitigation：训练 demo 接受此 trade-off；真实生产环境可在后续 change 中引入 `Select with creatable` 或 `AutoComplete`，本次不做。
- **[Trade-off] CLI 层不做 assignee 搜索/过滤** → Mitigation：搜索功能留作下一独立 change（add-cli-assignee-filter）或与 Web 过滤一并实现，避免本 change 叠 scope。

## Migration Plan

- **Steps to deploy**（训练用本地环境，等价于 `./scripts/dev.sh` 启动流程）：
  1. 后端启动时 Flyway 自动按版本号执行 `V1 → V2 → V3`，在 in-memory H2 上新增 `assignee` 列；
  2. 重启训练过程中 DB 为 in-memory，"存量数据"每次都会重建为 NULL，不产生脏状态；
  3. `Vite dev` 与 `pnpm build` 的 Web 需要重新 build（因为 `types/todo.ts` 改了）；CLI 需要 `pnpm build` 重编译，因 `Todo` 接口改了。
- **Rollback strategy**：
  - Flyway 对 in-memory H2 无回滚语义，rollback 等价于"代码回退后重启进程"。
  - 如果需要真实生产 rollback：新增列永远是向后兼容的（老代码不读 assignee 列无影响），只需要在 Controller/DTO/Entity 上回退前端写入即可，不需要 drop column。

## Open Questions

本次已由用户确认全部 6 个决策点（1=A, 2=P+Trim, 3=L1, 4=M1, 5=保持现状, 6=选项1），无未决开放问题。若后续出现 assignee 过滤、按消费方 URL 隔离、枚举化等需求，将在下一个独立 change 中再做 decision。
