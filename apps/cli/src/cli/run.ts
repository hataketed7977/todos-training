import type { Command } from 'commander'

interface ExitCoded {
  exitCode?: number
}

export async function runCli(
  program: Command,
  argv = process.argv,
  writeError: (message: string) => void = console.error,
): Promise<void> {
  try {
    await program.parseAsync(argv)
  } catch (error: unknown) {
    const coded = error as ExitCoded
    const exitCode = coded.exitCode ?? 1
    if (exitCode !== 0) {
      writeError(error instanceof Error ? error.message : String(error))
    }
    process.exitCode = exitCode
  }
}
