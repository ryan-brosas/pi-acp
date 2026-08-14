/**
 * Last-resort crash path for the ACP entrypoint: log the failure, dispose
 * owned children best-effort, then exit nonzero so the client can surface the
 * failure (a dead-but-zero adapter would look like an idle session). The exit
 * function and timeout are injectable for tests.
 */
export function exitOnCrash(
  kind: string,
  detail: unknown,
  dispose: (() => Promise<void> | void) | null,
  exit: (code: number) => void = code => process.exit(code),
  timeoutMs = 2_000
): void {
  try {
    const stack = (detail as { stack?: string } | null)?.stack
    process.stderr.write(`pi-acp-jetbrain: ${kind}: ${stack ?? String(detail)}
`)
  } catch {
    // ignore; exiting anyway
  }
  const timer = setTimeout(() => exit(1), timeoutMs)
  timer.unref?.()
  if (!dispose) {
    clearTimeout(timer)
    return exit(1)
  }
  void Promise.resolve(dispose())
    .catch(() => undefined)
    .finally(() => exit(1))
}
