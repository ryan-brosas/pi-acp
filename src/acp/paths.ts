import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

/**
 * Storage owned by the ACP adapter.
 *
 * We intentionally keep this separate from pi's own ~/.pi/agent/* directory.
 */
export function getPiAcpDir(): string {
  return join(homedir(), '.pi', 'pi-acp')
}

export function getPiAcpSessionMapPath(): string {
  // The smoke matrix (and any host) may redirect the adapter-owned session map
  // away from the user store via PI_ACP_SESSION_MAP (F-027).
  const override = process.env.PI_ACP_SESSION_MAP
  return override ? resolve(override) : join(getPiAcpDir(), 'session-map.json')
}
