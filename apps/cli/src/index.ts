#!/usr/bin/env node
import { createProgram } from './cli/create-program.js'
import { runCli } from './cli/run.js'

await runCli(createProgram())
