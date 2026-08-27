# Todo Delete 设计文档

## Context

当前 Todo 应用已支持创建和列表展示，但缺少删除功能。用户无法从看板中移除已完成或不需要的任务。

`services/api` 提供 REST API（Spring Boot 3 + Spring Data JPA），`apps/web` 提供 React 前端（Semi UI）。Todo 实体有 `id / title / status / description / priority / createdAt / updatedAt` 字段。

本次需求端到端地打通删除功能：后端 API、前端 UI、确认流程、错误处理，并保持与现有架构风格一致。

## Goals / Non-Goals

**Goals:**
- 后端 `DELETE /api/todos/{id}` 端点，删除指定 ID 的 Todo。
- 前端 `TodoCard` 上 hover 显示删除图标，点击 Popconfirm 确认后执行删除。
- 删除成功后从列表立即移除并 Toast 提示。
- 删除不存在的 ID 返回 404。
- 覆盖后端测试。

**Non-Goals:**
- 不改动 CLI（`apps/cli` 无 Go 代码，且不在本次范围）。
- 不引入批量删除。
- 不改动状态工作流或排序。
- 不做 optimistic update（先请求后更新 state，简单可靠）。
- 不引入全局状态管理，props 穿透保持一致性。

## Decisions

### D1. 后端 API 设计

`TodoController` 新增端点：

```java
@DeleteMapping("/{id}")
@ResponseStatus(HttpStatus.NO_CONTENT)
public void delete(@PathVariable Long id) {
    todoService.delete(id);
}
```

- 成功返回 `204 No Content`，无响应体。
- ID 不存在时返回 `404 Not Found`。

### D2. Service 层存在性检查

`TodoService` 新增方法：

```java
@Transactional
public void delete(Long id) {
    Todo todo = todoRepository.findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Todo not found: " + id));
    todoRepository.delete(todo);
}
```

- 使用 `findById` 先检查存在性，不存在则抛 `ResponseStatusException` 返回 404，避免 `deleteById` 静默成功或抛出 `EmptyResultDataAccessException`。
- 使用 `delete(todo)` 而非 `deleteById(id)`，因为已有 entity 引用，语义更清晰。
- 继承项目中已有的 `ResponseStatusException` 模式（参见 `TodoControllerTest` 中 `doesNotExposeSingleTodoOrPatchEndpoints` 测试用例）。

### D3. 前端 todosService

`todosService.ts` 新增：

```typescript
export function deleteTodo(id: number): Promise<void> {
  return request<void>(`/api/todos/${id}`, {
    method: 'DELETE',
  })
}
```

- `request` 函数已有 `204` 处理路径，返回 `undefined as T`，无需额外改动。

### D4. 前端 useTodos hook

`useTodos` 新增 `removeTodo` 方法：

```typescript
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

- 新增 `deleting: Set<number>` state 跟踪正在删除的 ID 列表，用于禁用按钮防重复点击。
- 从 `todos` 源头数组 filter 移除，`todosByStatus` 是派生数据，自动更新。
- 成功/失败均有 Toast 提示。

### D5. 前端 TodoCard 组件

`TodoCard` 新增 `onDelete` prop 和删除按钮：

```tsx
interface TodoCardProps {
  todo: Todo
  onDelete: (id: number) => void
  deleting?: boolean
}
```

交互细节：
- 删除图标使用 `@douyinfe/semi-icons` 的 `IconDeleteStroked`（垃圾桶图标）。
- 图标默认隐藏，hover 卡片时显示（CSS `opacity` 过渡）。
- 点击图标触发 `Popconfirm`，文案为"确定要删除「任务标题」吗？此操作不可撤销。"
- Popconfirm 确认后调用 `onDelete(todo.id)`。
- 删除过程中图标显示 loading 旋转状态并禁用点击。

### D6. 数据流

```
useTodos.removeTodo
  → TodosBoardPage（传递回调）
    → TodoBoard（透传）
      → BoardColumn（透传）
        → TodoCard.onDelete(id)
```

- 与现有 props 穿透模式一致，不引入新架构。

### D7. 后端测试

`TodoControllerTest` 新增两个测试：

1. **删除存在的 Todo 返回 204**
   - 先保存一个 Todo，然后 `DELETE /api/todos/{id}` → 204，再 `GET /api/todos` → 列表为空。

2. **删除不存在的 ID 返回 404**
   - `DELETE /api/todos/{nonExistentId}` → 404。

### D8. 前端 i18n

`zhCN.ts` 新增文案：

| key | 值 |
|---|---|
| `delete` | 删除 |
| `deleteConfirmTitle` | 确定要删除「{title}」吗？此操作不可撤销。 |
| `deleted` | 已删除 |
| `deleteFailed` | 删除失败 |

## Risks / Trade-offs

- **[Popconfirm 在触摸设备上 hover 不可用]** → 删除图标 hover 显示，但 Popconfirm 的 trigger 点击仍然可触发，触摸设备上用户需要先点击卡片再看到图标。当前以桌面为主，可接受。
- **[删除后不刷新列表，仅本地移除]** → 如果多个用户同时操作，删除会不同步。当前为单用户 demo，可接受。
- **[deleting state 使用 Set 存储]** → React state 中 Set 的不可变更新稍显繁琐，但语义清晰，可以防重复点击。备选方案：使用 `deletingId: number | null` 限制同时只能删除一个，但 Set 更通用。