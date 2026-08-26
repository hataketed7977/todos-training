#!/usr/bin/env node
import { TodoUseCases } from './application/todo-use-cases.js'
import { createProgram } from './cli/create-program.js'
import { runCli } from './cli/run.js'
import { loadConfig } from './infrastructure/config.js'
import { createHttpClient } from './infrastructure/http-client.js'
import { createTodoApiClient } from './infrastructure/todo-api-client.js'

const config = loadConfig()
const httpClient = createHttpClient(config.apiBaseUrl)
const todoApi = createTodoApiClient(httpClient)
const app = new TodoUseCases(todoApi)

await runCli(createProgram(app))
