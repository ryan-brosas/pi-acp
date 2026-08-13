import { spawn } from 'node:child_process'

const agent = spawn('node', ['dist/index.js'], { stdio: ['pipe', 'pipe', 'inherit'] })

let buf = ''
let ok = false

agent.stdout.on('data', d => {
  buf += d.toString('utf8')
  let idx
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx)
    buf = buf.slice(idx + 1)
    if (!line.trim()) continue
    try {
      const msg = JSON.parse(line)
      if (msg.id === 2 && msg.result?._meta?.piAcp?.startupInfo) {
        const s = String(msg.result._meta.piAcp.startupInfo)
        if (s.includes('## Context') && s.includes('## Skills') && s.includes('## Extensions')) {
          ok = true
          console.log('OK: startup info present in session/new _meta.piAcp.startupInfo')
          agent.kill('SIGTERM')
          process.exit(0)
        }
      }
      if (msg.method === 'session/update') {
        const up = msg.params?.update
        if (up?.sessionUpdate === 'agent_message_chunk' && up?.content?.type === 'text') {
          const t = String(up.content.text)
          if (t.includes('## Context') && t.includes('## Skills') && t.includes('## Extensions')) {
            ok = true
            console.log('OK: startup info present in agent_message_chunk')
            agent.kill('SIGTERM')
            process.exit(0)
          }
        }
      }
    } catch {
      // ignore
    }
  }
})

function send(obj) {
  agent.stdin.write(JSON.stringify(obj) + '\n')
}

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: 1 } })
send({ jsonrpc: '2.0', id: 2, method: 'session/new', params: { cwd: process.cwd(), mcpServers: [] } })

setTimeout(() => {
  if (!ok) {
    console.error('FAIL: did not observe startup info')
    agent.kill('SIGTERM')
    process.exit(1)
  }
}, 6000)
