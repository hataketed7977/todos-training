## 1. 后端 DTO 与 Service 层

- [x] 1.1 新建 `UpdateTodoRequest.java` record：title(@NotBlank) / description / priority 三字段，包路径 `com.bytedance.todos.dto`
- [x] 1.2 在 `TodoService.java` 新增 `update(Long id, UpdateTodoRequest request)`：findById → 404，setTitle（trim），setDescription（trim + 空白→NULL），setPriority，save 并返回

## 2. 后端 Controller 与 CORS

- [x] 2.1 在 `TodoController.java` 新增 `PUT /api/todos/{id}`：`@ResponseStatus(HttpStatus.OK)` + `@Valid @RequestBody UpdateTodoRequest`，返回更新后的 Todo
- [x] 2.2 在 `WebConfig.java` 的 `allowedMethods` 中补加 `"PUT"`，确保浏览器预检通过

## 3. 后端测试

- [x] 3.1 在 `TodoControllerTest.java` 新增测试用例：`updatesExistingTodoWithAllFields`（修改三字段并验证 trim）
- [x] 3.2 新增测试用例：`updatesTodoClearsDescriptionAndPriority`（空白描述→NULL，priority=null）
- [x] 3.3 新增测试用例：`returns404WhenUpdatingNonExistentTodo`（PUT /api/todos/99999 → 404）
- [x] 3.4 新增测试用例：`rejectsBlankTitleOnUpdate`（title 为空白 → 400）
- [x] 3.5 运行 `./gradlew test --rerun-tasks`，确认全绿

## 4. 前端 Service 与 Hook 层

- [x] 4.1 在 `todosService.ts` 新增 `updateTodo(id: number, input: {...}): Promise<Todo>`，method `PUT`，URL `/api/todos/${id}`
- [x] 4.2 在 `useTodos.ts` 新增 `updating: Set<number>` state
- [x] 4.3 在 `useTodos.ts` 新增 `updateTodo(id, input)` 函数：trim title + description normalization → set updating → 调用 service → 成功：`setTodos(prev => prev.map(t => t.id === id ? updated : t))` + Toast.success → 失败：Toast.error + refreshTodos → finally: 更新 updating Set
- [x] 4.4 在 `useTodos` return 中导出 `updating` 与 `updateTodo`

## 5. 前端 i18n

- [x] 5.1 在 `zhCN.ts` 新增：`editTodo: '编辑待办'`、`save: '保存'`、`saved: '已更新待办'`、`editFailed: '更新待办失败。'`、`edit: '编辑'`

## 6. 前端 CreateTodoModal 改造（支持 edit mode）

- [x] 6.1 新增 props 类型：`mode?: 'create' | 'edit'`（默认 `'create'`），以及 `initialTodo?: Todo`（仅 edit 模式时提供）、`onUpdate?: (id: number, input: {...}) => Promise<void>`
- [x] 6.2 弹窗标题：mode === 'edit' ? `i18n.editTodo` : `i18n.addTodo`；okText：mode === 'edit' ? `i18n.save` : `i18n.add`
- [x] 6.3 新增 useEffect：当 `mode === 'edit' && visible && initialTodo` 时，`formApiRef.current?.setValues({ title, description, priority })` 预填表单
- [x] 6.4 `handleSubmit`：mode === 'edit' 时调用 `onUpdate?.(initialTodo!.id, {...})`（否则走 onCreate）；失败时保持弹窗打开，成功时 reset（或不 reset，由外部关闭 visible）
- [x] 6.5 `confirmLoading`：mode === 'edit' 时绑定外部传入的 `updating` prop（或等价 loading）

## 7. 前端 TodoCard 编辑入口

- [x] 7.1 `TodoCardProps` 新增：`onEdit?: (todo: Todo) => void`、`editing?: boolean`
- [x] 7.2 引入 `IconEditStroked`（Semi 图标库）
- [x] 7.3 在卡片右侧、删除按钮旁新增编辑图标 span：inline-flex 排列，使用中性 icon 颜色（非红），opacity 与删除按钮一致（0 → hover 0.6 → 自身 hover 1.0），`onClick` 执行 `e.stopPropagation(); if (!editing && !deleting) onEdit?.(todo)`，editing 时 cursor 为 not-allowed
- [x] 7.4 两个 action 图标外层容器用 flex gap 4-8px 排版

## 8. 前端组件 props 传递链路

- [x] 8.1 `BoardColumn.tsx` props 新增 `onEdit: (todo: Todo) => void`、`editing: Set<number>`，传递给 `TodoCard` 的 `onEdit` 与 `editing={editing.has(todo.id)}`
- [x] 8.2 `TodoBoard.tsx` props 新增 `onEdit: (todo: Todo) => void`、`editing: Set<number>`，传递给 `BoardColumn`
- [x] 8.3 `TodosBoardPage.tsx`：新增 `editingTodoId` 状态（number | null）或直接用 `useTodos` 导出的 `updating` 与 `updateTodo`；在页面中打开 `CreateTodoModal`（或改名为通用名后）的 edit 模式；保存后关闭弹窗

## 9. 前端验证

- [x] 9.1 运行 `pnpm build`（apps/web），确认 TypeScript 编译通过
- [x] 9.2 如项目有 lint 命令（pnpm lint），运行并确认无新增告警（0 errors，1 条既有 setState-in-effect warning 非本次引入）
- [x] 9.3 手动检查：无硬编码中文文案，全部走 zhCN i18n
