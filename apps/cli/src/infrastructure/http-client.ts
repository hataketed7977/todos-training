export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface HttpClient {
  request<T>(path: string, options?: RequestInit): Promise<T>
}

export function createHttpClient(baseUrl: string): HttpClient {
  return {
    async request<T>(path: string, options: RequestInit = {}) {
      const response = await fetch(baseUrl + path, {
        headers: {
          'content-type': 'application/json',
          ...options.headers,
        },
        ...options,
      })

      if (!response.ok) {
        const body = await response.text()
        throw new ApiError(body || 'API request failed: ' + response.status, response.status)
      }

      if (response.status === 204) {
        return undefined as T
      }

      return response.json() as Promise<T>
    },
  }
}
