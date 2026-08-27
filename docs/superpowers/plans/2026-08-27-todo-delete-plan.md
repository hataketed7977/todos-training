# Todo Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Todo 应用添加端到端删除功能——后端 API、前端 UI、确认弹窗、错误处理。

**Architecture:** 后端在 `TodoController` 新增 `DELETE /api/todos/{id}` 端点，`TodoService` 做存在性检查并返回 404。前端将 `onDelete` 回调通过 props 从 `useTodos` → `TodosBoardPage` → `TodoBoard` → `BoardColumn` 穿透到 `TodoCard`，卡片 hover 显示删除图标，Popconfirm 确认后执行删除。

**Tech Stack:** Java 21 / Spring Boot 3 / Gradle → React 18 / TypeScript / Semi UI / pnpm

**Spec:** `docs/superpowers/specs/2026-08-27-todo-delete-design.md`

## Global Constraints

- 后端返回 `204 No Content`，无响应体。
- 删除不存在的 ID 返回 `404 Not Found`。
- 删除图标使用 `@douyinfe/semi-icons` 的 `IconDeleteStroked`。
- 删除图标默认隐藏，hover 卡片时显示（CSS opacity 过渡）。
- 删除操作需要 Popconfirm 确认，文案为"确定要删除「{title}」吗？此操作不可撤销。"
- 删除过程中图标显示 loading 状态并禁用点击。
- 删除成功后从列表立即移除，Toast 提示"已删除"。
- 删除失败时 Toast 提示"删除失败"。
- UI copy 必须在 `apps/web/src/i18n/zhCN.ts` 中定义。
- 不改动 CLI。
- 不引入批量删除。
- 不乐观更新（先请求后更新 state）。

---

### Task 1: 后端 Service 层 — TodoService.delete

**Files:**
- Modify: `services/api/src/main/java/com/bytedance/todos/service/TodoService.java`
- Test: `services/api/src/test/java/com/bytedance/todos/controller/TodoControllerTest.java`

**Interfaces:**
- Consumes: `TodoRepository.findById(Long)`, `TodoRepository.delete(Todo)`
- Produces: `TodoService.delete(Long id)` — 返回 `void`，ID 不存在时抛 `ResponseStatusException(HttpStatus.NOT_FOUND)`

- [ ] **Step 1: 在 TodoService 中新增 delete 方法**

```java
// services/api/src/main/java/com/bytedance/todos/service/TodoService.java

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Transactional
public void delete(Long id) {
    Todo todo = todoRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found: " + id));
    todoRepository.delete(todo);
}
```

在 `create` 方法之后、类结束之前插入。

- [ ] **Step 2: 编译确认**

Run: `cd services/api && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: 暂存后端变更**

```bash
git add services/api/src/main/java/com/bytedance/todos/service/TodoService.java
git commit -m "feat(api): add TodoService.delete method"
```

---

### Task 2: 后端 Controller 层 — DELETE 端点

**Files:**
- Modify: `services/api/src/main/java/com/bytedance/todos/controller/TodoController.java`
- Modify: `services/api/src/test/java/com/bytedance/todos/controller/TodoControllerTest.java`

**Interfaces:**
- Consumes: `TodoService.delete(Long id)`
- Produces: `DELETE /api/todos/{id}` — 返回 `204 No Content`

- [ ] **Step 1: 在 TodoController 中新增 delete 端点**

```java
// services/api/src/main/java/com/bytedance/todos/controller/TodoController.java

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;

@DeleteMapping("/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT)
public void delete(@PathVariable Long id) {
    todoService.delete(id);
}
```

在 `create` 方法之后、类结束之前插入。

- [ ] **Step 2: 在 TodoControllerTest 中新增删除测试用例**

在 `doesNotExposeSingleTodoOrPatchEndpoints` 测试方法之后新增：

```java
// services/api/src/test/java/com/bytedance/todos/controller/TodoControllerTest.java

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;

@Test
void deletesExistingTodo() throws Exception {
    Todo todo = todoRepository.save(new Todo("Prepare training"));

    mockMvc.perform(delete("/api/todos/" + todo.getId()))
            .andExpect(status().isNoContent());

    mockMvc.perform(get("/api/todos"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));
}

@Test
void returns404WhenDeletingNonExistentTodo() throws Exception {
    mockMvc.perform(delete("/api/todos/99999"))
            .andExpect(status().isNotFound());
}
```

- [ ] **Step 3: 运行测试确认通过**

Run: `cd services/api && ./gradlew test --rerun-tasks`
Expected: 全部测试通过 (BUILD SUCCESSFUL)

- [ ] **Step 4: 提交**

```bash
git add services/api/src/main/java/com/bytedance/todos/controller/TodoController.java
git add services/api/src/test/java/com/bytedance/todos/controller/TodoControllerTest.java
git commit -m "feat(api): add DELETE /api/todos/{id} endpoint"
```

---

### Task 3: 前端 services — deleteTodo 函数

**Files:**
- Modify: `apps/web/src/services/todosService.ts`

**Interfaces:**
- Consumes: `request<T>(path, options)` 工具函数
- Produces: `deleteTodo(id: number): Promise<void>`

- [ ] **Step 1: 在 todosService.ts 中新增 deleteTodo 函数**

```typescript
// apps/web/src/services/todosService.ts

export function deleteTodo(id: number): Promise<void> {
  return request<void>(`/api/todos/${id}`, {
    method: 'DELETE',
  })
}
```

在 `createTodo` 函数之后、文件末尾之前插入。

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/services/todosService.ts
git commit -m "feat(web): add deleteTodo service function"
```

---

### Task 4: 前端 i18n — 删除相关文案

**Files:**
- Modify: `apps/web/src/i18n/zhCN.ts`

- [ ] **Step 1: 在 zhCN 中新增删除文案**

```typescript
// apps/web/src/i18n/zhCN.ts

// 在 'added: '已添加待办',' 之后新增：
delete: '删除',
deleteConfirmTitle: '确定要删除「{title}」吗？此操作不可撤销。',
deleted: '已删除',
deleteFailed: '删除失败',
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/i18n/zhCN.ts
git commit -m "feat(web): add delete-related i18n strings"
```

---

### Task 5: 前端 useTodos — removeTodo 方法

**Files:**
- Modify: `apps/web/src/hooks/useTodos.ts`

**Interfaces:**
- Consumes: `deleteTodo(id: number): Promise<void>` (from Task 3)
- Produces: `removeTodo(id: number): Promise<void>`, `deleting: Set<number>`

- [ ] **Step 1: 在 useTodos 中新增 deleteTodo 导入**

```typescript
// apps/web/src/hooks/useTodos.ts

// 修改 import 行
import {
  createTodo,
  deleteTodo,
  listTodos,
} from '../services/todosService'
```

- [ ] **Step 2: 新增 deleting state 和 removeTodo 方法**

```typescript
// apps/web/src/hooks/useTodos.ts

// 在 useState 声明区域新增
const [deleting, setDeleting] = useState<Set<number>>(new Set())

// 在 addTodo 方法之后、return 之前新增
async function removeTodo(id: number) {
  setDeleting(prev => new Set(prev).add(id))
  try {
    await deleteTodo(id)
    setTodos(prev => prev.filter(t => t.id !== id))
    setError(null)
    Toast.success(i18n.deleted)
  } catch {
    setError(i18n.deleteFailed)
    Toast.error(i18n.deleteFailed)
  } finally {
    setDeleting(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }
}
```

- [ ] **Step 3: 更新 useTodos 返回值**

```typescript
// apps/web/src/hooks/useTodos.ts

// 在 return 对象中新增
return {
  todos,
  todosByStatus,
  error,
  loading,
  creating,
  deleting,   // 新增
  addTodo,
  removeTodo, // 新增
}
```

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/hooks/useTodos.ts
git commit -m "feat(web): add removeTodo to useTodos hook"
```

---

### Task 6: 前端 TodoCard — 删除按钮 + Popconfirm

**Files:**
- Modify: `apps/web/src/components/TodoCard.tsx`

**Interfaces:**
- Consumes: `TodoCardProps.onDelete(id: number)` (required), `TodoCardProps.deleting` (optional boolean)
- Consumes: i18n 文案 `delete`, `deleteConfirmTitle`

- [ ] **Step 1: 重写 TodoCard 组件，新增删除交互**

```tsx
// apps/web/src/components/TodoCard.tsx

import Card from '@douyinfe/semi-ui/lib/es/card'
import Popconfirm from '@douyinfe/semi-ui/lib/es/popconfirm'
import Typography from '@douyinfe/semi-ui/lib/es/typography'
import IconDeleteStroked from '@douyinfe/semi-icons/lib/es/icons/IconDeleteStroked'
import type { Todo, TodoPriority } from '../types/todo'
import { zhCN as i18n } from '../i18n/zhCN'

const { Text, Paragraph } = Typography

const priorityLabels: Record<TodoPriority, string> = {
  LOW: i18n.priorityLow,
  MEDIUM: i18n.priorityMedium,
  HIGH: i18n.priorityHigh,
}

interface TodoCardProps {
  todo: Todo
  onDelete: (id: number) => void
  deleting?: boolean
}

export function TodoCard({ todo, onDelete, deleting }: TodoCardProps) {
  return (
    <Card
      shadows="hover"
      style={{ borderRadius: 8, width: '100%' }}
      bodyStyle={{ padding: 12 }}
    >
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text strong>{todo.title}</Text>
          {todo.priority ? (
            <Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
              {i18n.todoPriority}：{priorityLabels[todo.priority]}
            </Text>
          ) : null}
          {todo.description ? (
            <Paragraph
              type="tertiary"
              size="small"
              ellipsis={{ rows: 2, showTooltip: true }}
              style={{ marginBottom: 0, marginTop: 4 }}
            >
              {todo.description}
            </Paragraph>
          ) : null}
        </div>
        <Popconfirm
          title={i18n.deleteConfirmTitle.replace('{title}', todo.title)}
          onConfirm={() => onDelete(todo.id)}
        >
          <IconDeleteStroked
            style={{
              cursor: deleting ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              fontSize: 16,
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
            className="todo-card-delete-icon"
            onClick={deleting ? (e) => e.stopPropagation() : undefined}
          />
        </Popconfirm>
      </div>
      <style>{`
        .semi-card:hover .todo-card-delete-icon {
          opacity: 0.6 !important;
        }
        .semi-card .todo-card-delete-icon:hover {
          opacity: 1 !important;
        }
      `}</style>
    </Card>
  )
}
```

**关键设计说明：**
- 删除图标使用 `className` 选择器而非 inline style 控制 hover，因为 `semi-card` 的 hover 样式无法通过 inline `:hover` 表达。
- `Popconfirm` 包裹删除图标，点击图标触发 Popconfirm，确认后调用 `onDelete`。
- 删除中（`deleting=true`）时图标显示 `not-allowed` 光标并阻止点击事件冒泡。

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/components/TodoCard.tsx
git commit -m "feat(web): add delete button with Popconfirm to TodoCard"
```

---

### Task 7: 前端 props 穿透 — BoardColumn / TodoBoard / TodosBoardPage

**Files:**
- Modify: `apps/web/src/components/BoardColumn.tsx`
- Modify: `apps/web/src/components/TodoBoard.tsx`
- Modify: `apps/web/src/pages/TodosBoardPage.tsx`

**Interfaces:**
- Consumes: `useTodos().removeTodo`, `useTodos().deleting`
- Produces: 将 `onDelete` 和 `deleting` 通过 props 传递到 `TodoCard`

- [ ] **Step 1: 修改 BoardColumn 传递 onDelete 和 deleting**

```typescript
// apps/web/src/components/BoardColumn.tsx

interface BoardColumnProps {
  column: TodoBoardColumn
  todos: Todo[]
  onCreate: () => void
  onDelete: (id: number) => void    // 新增
  deleting: Set<number>              // 新增
}

export function BoardColumn({
  column,
  todos,
  onCreate,
  onDelete,   // 新增
  deleting,   // 新增
}: BoardColumnProps) {
  // ... 现有代码不变 ...

  // 修改 TodoCard 渲染处
  {todos.map((todo) => (
    <TodoCard
      key={todo.id}
      todo={todo}
      onDelete={onDelete}
      deleting={deleting.has(todo.id)}
    />
  ))}
}
```

- [ ] **Step 2: 修改 TodoBoard 传递 onDelete 和 deleting**

```typescript
// apps/web/src/components/TodoBoard.tsx

interface TodoBoardProps {
  loading: boolean
  todosByStatus: Record<TodoStatus, Todo[]>
  onCreate: () => void
  onDelete: (id: number) => void    // 新增
  deleting: Set<number>              // 新增
}

export function TodoBoard({
  loading,
  todosByStatus,
  onCreate,
  onDelete,   // 新增
  deleting,   // 新增
}: TodoBoardProps) {
  // ... 现有代码不变 ...

  // 修改 BoardColumn 渲染处
  <BoardColumn
    column={column}
    todos={todosByStatus[column.status] ?? []}
    onCreate={onCreate}
    onDelete={onDelete}
    deleting={deleting}
  />
}
```

- [ ] **Step 3: 修改 TodosBoardPage 传递 onDelete 和 deleting**

```typescript
// apps/web/src/pages/TodosBoardPage.tsx

export function TodosBoardPage() {
  const {
    todos,
    todosByStatus,
    error,
    loading,
    creating,
    deleting,    // 新增
    addTodo,
    removeTodo,  // 新增
  } = useTodos()

  // ... 现有代码不变 ...

  // 修改 TodoBoard 渲染处
  <TodoBoard
    loading={loading}
    todosByStatus={todosByStatus}
    onCreate={() => setIsCreateOpen(true)}
    onDelete={removeTodo}
    deleting={deleting}
  />
}
```

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/components/BoardColumn.tsx
git add apps/web/src/components/TodoBoard.tsx
git add apps/web/src/pages/TodosBoardPage.tsx
git commit -m "feat(web): wire delete props through component tree"
```

---

### Task 8: 前端构建验证

**Files:**
- No new files. Run build check.

- [ ] **Step 1: 运行 pnpm build 确认构建通过**

Run: `cd apps/web && pnpm build`
Expected: BUILD SUCCESSFUL, no TypeScript errors

- [ ] **Step 2: 运行 git diff --check**

```bash
git diff --check
```
Expected: 无 whitespace 错误

- [ ] **Step 3: 提交最终验证 commit**

```bash
git commit -m "chore: verify build passes"
```