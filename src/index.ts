import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk'
import { PiAcpAgent } from './acp/agent.js'
import { exitOnCrash } from './exit-on-crash.js'
import { getPiCommand, shouldUseShellForPiCommand } from './pi-rpc/command.js'
// Terminal Auth entrypoint. The ACP client launches the agent with `--terminal-login`.
if (process.argv.includes('--terminal-login')) {
  const { spawnSync } = await import('node:child_process')
  const cmd = getPiCommand(process.env.PI_ACP_PI_COMMAND)
  const res = spawnSync(cmd, [], {
    stdio: 'inherit',
    env: process.env,
    shell: shouldUseShellForPiCommand(cmd)
  })

  if ((res as any).error && (res as any).error.code === 'ENOENT') {
    process.stderr.write(
      `pi-acp-jetbrain: could not start pi (command not found: ${cmd}). Install it via \`npm install -g @earendil-works/pi-coding-agent\` or ensure \`pi\` is on your PATH.\n`
    )
    process.exit(1)
  }

  process.exit(typeof res.status === 'number' ? res.status : 1)
}

const input = new WritableStream<Uint8Array>({
  write(chunk) {
    return new Promise<void>(resolve => {
      if ((process.stdout as any).destroyed || !process.stdout.writable) return resolve()

      try {
        process.stdout.write(chunk, err => {
          void err
          resolve()
        })
      } catch {
        // Common: ERR_STREAM_DESTROYED ("Cannot call write after a stream was destroyed").
        resolve()
      }
    })
  }
})

const output = new ReadableStream<Uint8Array>({
  start(controller) {
    process.stdin.on('data', (chunk: Buffer) => controller.enqueue(new Uint8Array(chunk)))
    process.stdin.on('end', () => controller.close())
    process.stdin.on('error', err => controller.error(err))
  }
})

const stream = ndJsonStream(input, output)

// Retain the agent so shutdown can dispose owned pi subprocesses. The SDK's
// AgentSideConnection does not expose the handler instance it created.
let activeAgent: PiAcpAgent | null = null
new AgentSideConnection(conn => {
  activeAgent = new PiAcpAgent(conn)
  return activeAgent
}, stream)

let shuttingDown = false
async function shutdown(): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  try {
    // Dispose session subprocesses (and the IDE bridge) before exiting so no
    // pi or MCP child is orphaned when the client disconnects.
    const a = activeAgent
    activeAgent = null
    if (a) await a.dispose()
  } catch {
    // ignore; the exit below is authoritative
  }
  try {
    process.exit(0)
  } catch {
    // ignore
  }
}

process.stdin.on('end', () => void shutdown())
process.stdin.on('close', () => void shutdown())

process.stdin.resume()
process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

// Avoid crashing if the client closes stdout early.
process.stdout.on('error', () => {
  try {
    process.exit(0)
  } catch {
    // ignore
  }
})

// Last-resort crash handlers: log, dispose owned children best-effort, then exit
// nonzero so the client can surface the failure (a dead-but-zero adapter would
// look like an idle session).
process.on('uncaughtException', error => {
  const a = activeAgent
  activeAgent = null
  exitOnCrash('uncaught exception', error, a ? () => a.dispose() : null)
})
process.on('unhandledRejection', reason => {
  const a = activeAgent
  activeAgent = null
  exitOnCrash('unhandled rejection', reason, a ? () => a.dispose() : null)
})
