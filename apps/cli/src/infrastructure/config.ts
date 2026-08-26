export interface CliConfig {
  apiBaseUrl: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): CliConfig {
  return {
    apiBaseUrl: env.TODO_API_URL ?? 'http://localhost:18080',
  }
}
