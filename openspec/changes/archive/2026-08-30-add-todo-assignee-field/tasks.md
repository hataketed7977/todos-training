## 1. services/api — Test-First: RED Phase

- [x] 1.1 在具体测试文件 `/Users/bytedance/workspace/bytedance/todos-training/services/api/src/test/java/com/bytedance/todos/controller/TodoControllerTest.java` 中新增 8 条集成测试用例：(a) createWithAssigneeTrims（POST 带 `"  张三  "` 断言响应 assignee=`"张三"`，DB 亦同）；(b) createWithoutAssigneeIsNull（POST 只带 title 断言响应 assignee=null）；(c) createAssigneeBlankToNull（POST 带 assignee=`"   "` 断言 DB 为 null）；(d) createAssigneeInvalidJsonTypeReturns400（POST 带 assignee 为对象 `{}` 断言返回 4xx，且 Todo 未创建）；(e) updateWritesAssignee（PUT 传新字符串，断言写入）；(f) updateOmittedAssigneeClears（PUT 不传 assignee 字段，原 todo 有 assignee 值，断言更新后为 null，非保留）；(g) updateBlankAssigneeClears（PUT 传 assignee=`"  "`，断言为 null）；(h) assigneeDoesNotAffectOrder（先插早创建+assignee="A"、后插晚创建+assignee="B"，GET 列表断言 B 在前，验证按 createdAt DESC）
- [x] 1.2 运行 focused test 命令 `cd /Users/bytedance/workspace/bytedance/todos-training/services/api && ./gradlew test --tests "TodoControllerTest.*Assignee*" --tests "TodoControllerTest.*assignee*" --rerun-tasks`，确认上述 8 条用例全部 RED（预期因 TodoEntity 无 assignee 字段 / Flyway 缺列导致 SQL 异常，或 Service/Controller 未返回 assignee JSON 键导致断言失败）；在 1.1 代码注释中记录 2-3 条实际失败断言作为"真红证据"（如 `Field "ASSIGNEE" not found`、`JSON path assignee is null but expected not null`）

<!-- 跳测原因：services/api 模块有完整集成测试基础，不符合「零逻辑分支」情形，因此不跳测。本条注释仅占位说明。 -->

## 2. services/api — Minimal Implementation: GREEN Phase

- [x] 2.1 在实现文件列表中依次修改：
  - 新建 `/Users/bytedance/workspace/bytedance/todos-training/services/api/src/main/resources/db/migration/V3__add_assignee.sql`：`ALTER TABLE todos ADD COLUMN assignee VARCHAR(255); ALTER TABLE todos ADD CONSTRAINT assignee_length_check CHECK (LENGTH(assignee) <= 255);`（H2 兼容语法，可空，无默认值）
  - 修改 `/Users/bytedance/workspace/bytedance/todos-training/services/api/src/main/java/com/bytedance/todos/model/TodoEntity.java`：新增 `@Column(length = 255) private String assignee;` 私有字段；新增 `public TodoEntity(String title, String description, TodoPriority priority, String assignee)` 四参构造函数（保留旧三参构造以防现有调用）；新增 getter/setter；更新二参/三参构造函数对 assignee 赋值为 null（显式）
  - 修改 `/Users/bytedance/workspace/bytedance/todos-training/services/api/src/main/java/com/bytedance/todos/dto/CreateTodoRequest.java`：record 组件新增 `String assignee`
  - 修改 `/Users/bytedance/workspace/bytedance/todos-training/services/api/src/main/java/com/bytedance/todos/dto/UpdateTodoRequest.java`：record 组件新增 `String assignee`
  - 修改 `/Users/bytedance/workspace/bytedance/todos-training/services/api/src/main/java/com/bytedance/todos/service/TodoService.java`：`create(...)` 方法中对 assignee 执行 trim→null（使用 `org.springframework.util.StringUtils.hasText(s) ? s.trim() : null` 或等价）后写入新建的 TodoEntity；`update(...)` 方法中统一执行 `entity.setAssignee(StringUtils.hasText(request.assignee()) ? request.assignee().trim() : null)`（即"不传/空白/null 一律清空"语义，与 priority 派对齐）
- [x] 2.2 重跑 1.2 中同一 focused 命令（参数完全一致，不换 broader 范围），确认 8 条用例全部转 GREEN
- [x] 2.3 运行模块级 regression 命令 `cd /Users/bytedance/workspace/bytedance/todos-training/services/api && ./gradlew test --rerun-tasks`，确认 description/priority/status/title-search 等所有既有用例（共 21+）均全绿，无回归

## 3. services/api — Refactor Phase (Optional but Recommended)

- [x] 3.1 提取 `TodoService` 中 "String trimToNull(String)" 私有静态 helper（若已有等价工具则复用），使 description、assignee 两处归一化走同一函数；重跑 1.2 focused 命令全绿
- [ ] 3.2 对 TodoControllerTest 中 8 条 assignee 用例抽取 shared `postCreate(String title, String assignee)` / `putUpdate(Long id, String title, String assignee)` helper，减少重复 JSON 字符串构造；重跑 1.2 focused 命令全绿（跳过：越界，未改 helper，8 条用例已全绿）
- [x] 3.3 重跑 2.3 `./gradlew test --rerun-tasks` 模块级回归命令，确认仍全绿

## 4. apps/web — Test-First: RED Phase

<!--
  跳过原因：apps/web 模块当前无自动化测试框架（AGENTS.md §docs/testing.md 明确验证门禁为 `pnpm build` + `pnpm lint`，未集成 vitest/jest）；
  新增字段主要是 TypeScript 类型扩展 + Semi 组件 props 传递，逻辑分支少。
  替代验收方式：
    (a) RED 证据：先改 TypeScript 类型（todo.ts 新增 assignee）但不改 Service/组件 → pnpm build 应因 CreateTodoModal/TodoCard 读取未定义字段或 useTodos 传参缺失而出现 TS 编译错误；
    (b) GREEN 证据：补完全部类型/组件/Service 链路后，`pnpm build` + `pnpm lint` 退出码 0；
    (c) （可选）手动启动 dev.sh 在浏览器验证创建/编辑弹窗输入负责人并保存、卡片展示、编辑时预填、清空时正确保存。
-->

- [x] 4.1 在具体类型文件 `/Users/bytedance/workspace/bytedance/todos-training/apps/web/src/types/todo.ts` 中为 `Todo` 接口新增 `assignee: string | null` 字段；**此时故意不改** todosService.ts / useTodos.ts / CreateTodoModal.tsx / TodoCard.tsx，用于制造 RED 证据
- [x] 4.2 运行 focused build 命令 `cd /Users/bytedance/workspace/bytedance/todos-training/apps/web && pnpm build`，确认出现明确的 TypeScript 类型错误（例如 TodoCard 的新 assignee 渲染分支引用 `todo.assignee` 但未定义、或 CreateTodoModal 发送 body 包含 assignee 但 createTodo 的 input type 不含），并将失败的 TS 错误消息记录为 RED 证据

## 5. apps/web — Minimal Implementation: GREEN Phase

- [x] 5.1 修改实现文件列表：
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/web/src/services/todosService.ts`：`createTodo` input 类型新增 `assignee?: string`；body 组装逻辑在 `assignee !== undefined` 时加入 `body.assignee = (assignee.trim() === '' ? null : assignee)`（前端仅把纯空白转 null，trim 值本身不发送避免与后端双端重复，但非空白按 Web Modal 规则不修改；等价）；`updateTodo` 的 input 类型与 body 组装同样新增 assignee
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/web/src/hooks/useTodos.ts`：`createTodo({ ... })` 函数体内从 form values 解构 assignee 并传给 service；`updateTodo(id, {...})` 同等处理；`updating` Set 逻辑保持不变
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/web/src/i18n/zhCN.ts`：新增 `todoAssignee: '负责人'`、`assigneePlaceholder: '请输入负责人（可选）'` 两条中文常量
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/web/src/components/CreateTodoModal.tsx`：在"描述/优先级"两个表单项下方新增 `Form.Input`（或等价 Semi Field），label={i18n.todoAssignee}，placeholder={i18n.assigneePlaceholder}，非必填；edit 模式 useForm prefill 时加入 assignee；提交时 trim 为空字符串转为 undefined
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/web/src/components/TodoCard.tsx`：在 `priority` 行下方增加条件渲染分支：`todo.assignee ? <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>{i18n.todoAssignee}：{todo.assignee}</Text> : null`（保持 tertiary + size=small 视觉风格，不引入颜色）
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/web/src/components/TodoBoard.tsx`、`/Users/bytedance/workspace/bytedance/todos-training/apps/web/src/components/BoardColumn.tsx`：若 TodoCard props 接口新增字段未自动转发需补充透传（若未改 TodoCard 类型则不需要，保持 TodoCardProps 仅 `todo` 对象携带 assignee 即可）
- [x] 5.2 重跑 4.2 中同一 focused 命令 `cd apps/web && pnpm build`，确认 TypeScript 编译退出码 0（无 error，main chunk 警告忽略）
- [x] 5.3 运行模块级回归命令 `cd /Users/bytedance/workspace/bytedance/todos-training/apps/web && pnpm build && pnpm lint`，确认 lint 退出码 0 且未新增告警（允许既有 setState-in-effect warning 保留）

## 6. apps/web — Refactor Phase (Optional)

- [ ] 6.1 将 CreateTodoModal 中 `(value.trim() === '' ? null : value)` 或等价的纯空白归一化逻辑抽成 `src/utils/form.ts`（若已有 util 目录则使用）导出 `normalizeBlankToNull` 函数；在 description 与 assignee 两处复用；重跑 `pnpm build` 成功（跳过：越界，未引入 util 目录，build 已绿）
- [ ] 6.2 TodoCard 中 priority 与 assignee 的 tertiary 文本渲染可合并为数组 map 简化，但须保证 DOM 结构（marginTop 等）与旧视觉一致；重跑 `pnpm build` 成功（跳过：越界，未改视觉）
- [x] 6.3 重跑 5.3 的 `pnpm build && pnpm lint` 回归命令，确认仍全绿

## 7. apps/cli — Test-First: RED Phase

- [x] 7.1 在具体测试文件中新增用例：
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/cli/src/test/create.test.ts` 新增 4 条：(a) `create with --assignee flag includes assignee key in POST body`：构造 program，注册自定义 fetchImpl，执行 `todos-cli create 任务X -a "张三"`，断言 fetchImpl 收到的 JSON body 中 `assignee === "张三"`；(b) `create without --assignee omits assignee key in body`：不传 `-a`，断言 body 中无 `assignee` 键；(c) `createTodo apiClient function Todo return type has assignee`：mock fetch 返回含 `"assignee": "李四"` 的 JSON，断言 `createTodo(...)` 返回对象 `.assignee === "李四"`；(d) `fetchTodosByTitle 列表每条 Todo 都带 assignee 字段`：mock 返回 2 条 JSON（一条 assignee 字符串、一条 null），断言返回数组元素 0.assignee 为字符串、元素 1.assignee === null
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/cli/src/test/search.test.ts` 新增 2 条：(e) `search output includes ASSIGNEE column with value when present`：mock 返回 todo 1 { id: 1, assignee: "张三", ...priority: null }，断言 writeOut 捕获的表格输出中 ID=1 的对应行包含 ASSIGNEE 列值 `张三` 且 PRIORITY 为 `-`；(f) `search output ASSIGNEE column displays hyphen when null`：mock 返回 todo 1 { assignee: null, priority: "HIGH", ... }，断言表格 ASSIGNEE 列显示 `-` 且 PRIORITY 列显示 HIGH
- [x] 7.2 运行 focused test 命令 `cd /Users/bytedance/workspace/bytedance/todos-training/apps/cli && pnpm build && node --test --test-name-pattern="assignee|ASSIGNEE" dist/test/create.test.js dist/test/search.test.js`，确认上述 6 条用例 RED（预期失败原因：`Todo` 接口无 assignee 字段 → TS 编译错或类型断言失败；create 命令无 `-a` 选项 → args 解析错误；search 表格无 ASSIGNEE 列 → 输出断言失败）；在 7.1 用例旁记录 2-3 条失败证据

## 8. apps/cli — Minimal Implementation: GREEN Phase

- [x] 8.1 修改实现文件列表：
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/cli/src/services/apiClient.ts`：`Todo` 接口新增 `assignee: string | null`；`createTodo` 参数新增 `assignee?: string`；body 组装逻辑：`if (assignee !== undefined) body.assignee = assignee`（CLI 不 trim，由后端执行；与 design.md Decision 3 一致）
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/cli/src/cli/commands/create.ts`：`create` 子命令注册 `.option('-a, --assignee <name>', '负责人名称')`（保持 `.exitOverride()` 不引入新的退出策略）；action 内将 `opts.assignee` 读取并传入 `createTodo({ ..., assignee: opts.assignee as string | undefined })`
  - `/Users/bytedance/workspace/bytedance/todos-training/apps/cli/src/cli/commands/search.ts`：表格列数组新增 `ASSIGNEE` 列（位于 PRIORITY 与 TITLE 之间或按现有逻辑合理位置），取 `todo.assignee ?? '-'`；打印函数保持列对齐、左对齐
- [x] 8.2 重跑 7.2 中同一 focused test 命令（完全相同参数与 name-pattern），确认 6 条用例全部 GREEN
- [x] 8.3 运行模块级回归命令 `cd /Users/bytedance/workspace/bytedance/todos-training/apps/cli && pnpm test`，确认 cli.test.ts / create.test.ts / search.test.ts 全部既有用例无回归

## 9. apps/cli — Refactor Phase (Optional)

- [ ] 9.1 `search.ts` 表格列渲染逻辑抽取 `renderCell(value: string | null, width: number)` 辅助函数，消除 PRIORITY 与 ASSIGNEE 两处 `?? '-'` 重复；重跑 7.2 focused 命令全绿（跳过：越界，已绿不做抽象）
- [ ] 9.2 `create.test.ts` 中 4 条用例共享 setup（reset exitCode、构造 program、注入 writeOut/writeErr/fetchImpl）抽成 `setup()` helper；重跑 7.2 focused 命令全绿（跳过：越界）
- [x] 9.3 重跑 8.3 `pnpm test` 回归命令，确认仍全绿

## 10. 文档更新（与代码任务并列，不合并）

- [x] 10.1 更新 `/Users/bytedance/workspace/bytedance/todos-training/AGENTS.md` §"领域模型 Todo fields"：新增 assignee 条目——类型、长度 255、可空、trim→NULL、创建/更新的语义；§"产品契约 当前 user-visible scope"：增加"按负责人自由文本字段分配、展示、CLI 表格显示"；§"API 契约 Create/Update request"：JSON 示例补充 `assignee` 键；§"Todo response"：示例补充 `"assignee": "张三"` 或 null
- [x] 10.2 更新 `/Users/bytedance/workspace/bytedance/todos-training/services/api/docs/api-design.md`：端点清单 `POST /api/todos` 与 `PUT /api/todos/{id}` 行补充 request body 新增 `assignee`（string，可空，最大 255 字符）；响应体中新增 assignee 字段说明；新建或更新 `db-migrations.md`（或在 architecture.md 中）记录 Flyway V3 的列与 CHECK 约束
- [x] 10.3 更新 `/Users/bytedance/workspace/bytedance/todos-training/apps/web/AGENTS.md` §"当前 Web 行为"：创建/编辑弹窗新增「负责人」单行输入项说明；TodoCard 新增 assignee 展示的视觉样式约定（tertiary 文本，无颜色）
- [x] 10.4 更新 `/Users/bytedance/workspace/bytedance/todos-training/apps/cli/AGENTS.md` §"模块说明"：`create` 示例补充 `-a "张三"`；`search` 帮助输出样例表格新增 ASSIGNEE 列
- [x] 10.5 运行 `cd /Users/bytedance/workspace/bytedance/todos-training && git diff --check`，确认文档修改无尾随空白/错误换行
