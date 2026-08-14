import type { AgentSideConnection } from '@agentclientprotocol/sdk'
import type { PiRpcEvent } from '../../src/pi-rpc/process.js'

type SessionUpdateMsg = Parameters<AgentSideConnection['sessionUpdate']>[0]

export class FakeAgentSideConnection {
  readonly updates: SessionUpdateMsg[] = []
  readonly permissionRequests: unknown[] = []
  nextPermissionResponse: { outcome: { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' } } = {
    outcome: { outcome: 'selected', optionId: 'allow' }
  }

  readonly elicitationRequests: unknown[] = []
  nextElicitationResponse: unknown = { action: 'cancel' }
  elicitationError: unknown = null

  async sessionUpdate(msg: SessionUpdateMsg): Promise<void> {
    this.updates.push(msg)
  }

  async requestPermission(
    params: unknown
  ): Promise<{ outcome: { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' } }> {
    this.permissionRequests.push(params)
    return this.nextPermissionResponse
  }

  async unstable_createElicitation(params: unknown): Promise<unknown> {
    this.elicitationRequests.push(params)
    if (this.elicitationError !== null) throw this.elicitationError
    return this.nextElicitationResponse
  }
}

export class FakePiRpcProcess {
  private handlers: Array<(ev: PiRpcEvent) => void> = []

  // spies
  readonly prompts: Array<{ message: string; attachments: unknown[] }> = []
  readonly extensionUiResponses: unknown[] = []
  abortCount = 0

  onEvent(handler: (ev: PiRpcEvent) => void): () => void {
    this.handlers.push(handler)
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler)
    }
  }

  private exitHandlers: Array<(code: number | null, signal: string | null) => void> = []

  onExit(handler: (code: number | null, signal: string | null) => void): void {
    this.exitHandlers.push(handler)
  }

  exit(code: number | null = 0, signal: string | null = null): void {
    for (const h of this.exitHandlers) h(code, signal)
  }

  emit(ev: PiRpcEvent) {
    for (const h of this.handlers) h(ev)
  }

  async prompt(message: string, attachments: unknown[] = []): Promise<void> {
    this.prompts.push({ message, attachments })
  }

  async abort(): Promise<void> {
    this.abortCount += 1
  }

  stderrTailLines(_limit = 40): string[] {
    return []
  }

  async sendExtensionUiResponse(response: unknown): Promise<void> {
    this.extensionUiResponses.push(response)
  }

  async getState(): Promise<any> {
    return {}
  }

  async getAvailableModels(): Promise<any> {
    return { models: [{ provider: 'test', id: 'model', name: 'model' }] }
  }

  async getMessages(): Promise<any> {
    return { messages: [] }
  }

  nextSessionStats: unknown = null
  nextEntries: unknown = { entries: [], leafId: 'leaf-1' }
  readonly forkCalls: string[] = []
  readonly cloneCalls: number[] = []
  readonly switchSessionCalls: string[] = []

  async getSessionStats(): Promise<any> {
    return this.nextSessionStats
  }

  async fork(entryId: string): Promise<any> {
    this.forkCalls.push(entryId)
    return { text: 'Forked', cancelled: false }
  }

  async clone(): Promise<void> {
    this.cloneCalls.push(1)
  }

  async getEntries(): Promise<any> {
    return this.nextEntries
  }

  async getForkMessages(): Promise<any> {
    return { messages: [] }
  }

  async getTree(): Promise<any> {
    return { tree: [], leafId: null }
  }

  async switchSession(sessionPath: string): Promise<void> {
    this.switchSessionCalls.push(sessionPath)
  }
}

export function asAgentConn(conn: FakeAgentSideConnection): AgentSideConnection {
  // We only implement the method(s) used by PiAcpSession in tests.
  return conn as unknown as AgentSideConnection
}
