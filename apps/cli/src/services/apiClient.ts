export interface Todo {
  id: number
  title: string
  status: string
  priority: string | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<{
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
    throw new Error(message)
  }
  try {
    const data = await res.json()
    if (!Array.isArray(data)) {
      throw new Error('Failed to parse API response')
    }
    return data as Todo[]
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Search failed with status')) {
      throw err
    }
    throw new Error('Failed to parse API response')
  }
}
