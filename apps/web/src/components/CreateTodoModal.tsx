import { useEffect, useRef } from 'react'
import { Form } from '@douyinfe/semi-ui/lib/es/form'
import type { FormApi } from '@douyinfe/semi-ui/lib/es/form'
import Modal from '@douyinfe/semi-ui/lib/es/modal'
import { zhCN as i18n } from '@i18n/zhCN'
import type { Todo, TodoPriority } from '@typings/todo'

interface CreateTodoFormValues {
  title?: string
  description?: string
  priority?: TodoPriority
}

interface CreateTodoModalProps {
  visible: boolean
  creating?: boolean
  updating?: boolean
  mode?: 'create' | 'edit'
  initialTodo?: Todo
  onCancel: () => void
  onCreate?: (input: {
    title: string
    description?: string | null
    priority?: TodoPriority | null
  }) => Promise<void>
  onUpdate?: (id: number, input: {
    title: string
    description?: string | null
    priority?: TodoPriority | null
  }) => Promise<void>
}

const priorityOptions: { value: TodoPriority; label: string }[] = [
  { value: 'LOW', label: i18n.priorityLow },
  { value: 'MEDIUM', label: i18n.priorityMedium },
  { value: 'HIGH', label: i18n.priorityHigh },
]

export function CreateTodoModal({
  visible,
  creating,
  updating,
  mode = 'create',
  initialTodo,
  onCancel,
  onCreate,
  onUpdate,
}: CreateTodoModalProps) {
  const formApiRef = useRef<FormApi<CreateTodoFormValues> | null>(null)

  useEffect(() => {
    if (!visible) {
      formApiRef.current?.reset()
    }
  }, [visible])

  useEffect(() => {
    if (mode === 'edit' && visible && initialTodo) {
      formApiRef.current?.setValues({
        title: initialTodo.title,
        description: initialTodo.description ?? undefined,
        priority: initialTodo.priority ?? undefined,
      })
    }
  }, [mode, visible, initialTodo])

  async function handleSubmit(values: CreateTodoFormValues) {
    const trimmedTitle = values.title?.trim() ?? ''
    if (!trimmedTitle) {
      return
    }

    const trimmedDescription = values.description?.trim()
    const description = trimmedDescription ? trimmedDescription : null

    try {
      if (mode === 'edit' && initialTodo && onUpdate) {
        await onUpdate(initialTodo.id, {
          title: trimmedTitle,
          description,
          priority: values.priority ?? null,
        })
        formApiRef.current?.reset()
      } else if (mode === 'create' && onCreate) {
        await onCreate({
          title: trimmedTitle,
          description,
          priority: values.priority ?? null,
        })
        formApiRef.current?.reset()
      }
    } catch {
      // The hook already reports the failure with a Toast. Keep the modal open
      // so the user can retry or edit the title.
    }
  }

  const title = mode === 'edit' ? i18n.editTodo : i18n.addTodo
  const okText = mode === 'edit' ? i18n.save : i18n.add
  const confirmLoading = mode === 'edit' ? updating : creating

  return (
    <Modal
      title={title}
      visible={visible}
      width={480}
      style={{ margin: '48px auto 0' }}
      okText={okText}
      cancelText={i18n.cancel}
      confirmLoading={confirmLoading}
      onOk={() => {
        formApiRef.current?.submitForm()
      }}
      onCancel={onCancel}
    >
      <Form<CreateTodoFormValues>
        key={visible ? `${mode}-open` : `${mode}-closed`}
        layout="vertical"
        getFormApi={(formApi) => {
          formApiRef.current = formApi
        }}
        onSubmit={(values) => {
          void handleSubmit(values)
        }}
      >
        <Form.Input
          aria-label={i18n.todoTitle}
          autoFocus
          field="title"
          noLabel
          placeholder={i18n.todoTitlePlaceholder}
          showClear
          validator={(value) => (String(value ?? '').trim() ? '' : i18n.titleRequired)}
        />
        <Form.TextArea
          aria-label={i18n.todoDescription}
          field="description"
          noLabel
          placeholder={i18n.todoDescriptionPlaceholder}
          autosize
          maxCount={2000}
          style={{ marginTop: 12 }}
        />
        <Form.Select
          aria-label={i18n.todoPriority}
          field="priority"
          noLabel
          placeholder={i18n.todoPriorityPlaceholder}
          optionList={priorityOptions}
          showClear
          style={{ width: '100%', marginTop: 12 }}
        />
      </Form>
    </Modal>
  )
}
