export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const
export type Priority = typeof PRIORITIES[number]
export const VALID_PRIORITIES = new Set<string>(PRIORITIES)

export const ERROR_CODES = {
  SEARCH_HTTP_ERROR: 'SEARCH_HTTP_ERROR',
  CREATE_HTTP_ERROR: 'CREATE_HTTP_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
} as const
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES]

export interface CodedError extends Error {
  code: ErrorCode
}

function makeCodedError(code: ErrorCode, message: string): CodedError {
  const err = new Error(message) as CodedError
  err.code = code
  return err
}

export type TodoStatus = 'TODO' | 'DOING' | 'DONE'

export interface Todo {
  id: number
  title: string
  status: TodoStatus
  priority: Priority | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export type FetchLike = (input: string, init?: {
  method?: string
  headers?: Record<string, string>
  body?: string
}) => Promise<{
  ok: boolean
  status: number
  json: () => Promise<unknown>
}>

export async function fetchTodosByTitle({
  apiUrl,
  title,
  fetchImpl = globalThis.fetch as FetchLike,
}: {
  apiUrl: string
  title: string
  fetchImpl?: FetchLike
}): Promise<Todo[]> {
  const url = `${apiUrl.replace(/\/$/, '')}/api/todos?title=${encodeURIComponent(title)}`
  const res = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    let message = `Search failed with status ${res.status}`
    try {
      const body = (await res.json()) as { message?: string }
      if (body?.message) {
        message = `${message}: ${body.message}`
      }
    } catch {
      // ignore parse failure
    }
    throw makeCodedError(ERROR_CODES.SEARCH_HTTP_ERROR, message)
  }
  try {
    const data = await res.json()
    if (!Array.isArray(data)) {
      throw makeCodedError(ERROR_CODES.PARSE_ERROR, 'Failed to parse API response')
    }
    return data as Todo[]
  } catch (err) {
    if (err instanceof Error && (err as CodedError).code) {
      throw err
    }
    throw makeCodedError(ERROR_CODES.PARSE_ERROR, 'Failed to parse API response')
  }
}

export async function createTodo({
  apiUrl,
  title,
  description,
  priority,
  fetchImpl = globalThis.fetch as FetchLike,
}: {
  apiUrl: string
  title: string
  description?: string
  priority?: Priority
  fetchImpl?: FetchLike
}): Promise<Todo> {
  const url = `${apiUrl.replace(/\/$/, '')}/api/todos`
  const body: Record<string, unknown> = { title }
  if (description !== undefined) {
    body.description = description
  }
  if (priority !== undefined) {
    body.priority = priority
  }
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `Create failed with status ${res.status}`
    try {
      const resBody = (await res.json()) as { message?: string }
      if (resBody?.message) {
        message = `${message}: ${resBody.message}`
      }
    } catch {
      // ignore parse failure
    }
    throw makeCodedError(ERROR_CODES.CREATE_HTTP_ERROR, message)
  }
  try {
    const data = await res.json()
    if (typeof data !== 'object' || data === null || typeof (data as Todo).id !== 'number') {
      throw makeCodedError(ERROR_CODES.PARSE_ERROR, 'Failed to parse API response')
    }
    return data as Todo
  } catch (err) {
    if (err instanceof Error && (err as CodedError).code) {
      throw err
    }
    throw makeCodedError(ERROR_CODES.PARSE_ERROR, 'Failed to parse API response')
  }
}
