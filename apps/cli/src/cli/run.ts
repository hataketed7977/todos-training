import type { Command } from 'commander'

export async function runCli(
  program: Command,
  argv = process.argv,
  writeError: (message: string) => void = console.error,
): Promise<void> {
  try {
    await program.parseAsync(argv)
  } catch (error: unknown) {
    writeError(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
