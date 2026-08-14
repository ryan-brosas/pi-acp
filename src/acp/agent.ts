import {
  RequestError,
  type Agent as ACPAgent,
  type AgentSideConnection,
  type AuthenticateRequest,
  type CancelNotification,
  type InitializeRequest,
  type InitializeResponse,
  type ListSessionsRequest,
  type ListSessionsResponse,
  type LoadSessionRequest,
  type LoadSessionResponse,
  type NewSessionRequest,
  type PromptRequest,
  type PromptResponse,
  type SessionConfigOption,
  type SessionInfo,
  type SetSessionConfigOptionRequest,
  type SetSessionConfigOptionResponse,
  type SetSessionModeRequest,
  type SetSessionModeResponse,
  type DeleteSessionRequest,
  type DeleteSessionResponse
} from '@agentclientprotocol/sdk'
import { getAuthMethods } from './auth.js'
import { SessionManager, type PiAcpSession } from './session.js'
import { AcpMcpBridge } from './mcp-bridge.js'
import type { BridgeSpawnSettings, BridgeTool } from './mcp-types.js'
import { SessionStore } from './session-store.js'
import { buildInfo } from '../build-info.js'
import { PiRpcProcess } from '../pi-rpc/process.js'
import { getPiCommand } from '../pi-rpc/command.js'
import { listPiSessions, findPiSession } from './pi-sessions.js'
import { normalizePiAssistantText, normalizePiMessageText } from './translate/pi-messages.js'
import { toolResultToText } from './translate/pi-tools.js'
import {
  bashCommand,
  bashExitCode,
  bashResultText,
  bashTerminalContent,
  bashTerminalExitMeta,
  bashTerminalInfoMeta,
  bashTerminalOutputMeta,
  isBashTool
} from './translate/bash.js'
import { promptToPiMessage } from './translate/prompt.js'
import { loadSlashCommands, parseCommandArgs, toAvailableCommands } from './slash-commands.js'
import { getAgentDir, getEnableSkillCommands, getQuietStartup } from './pi-settings.js'
import { toAvailableCommandsFromPiGetCommands } from './pi-commands.js'
import { maybeAuthRequiredError } from './auth-required.js'
import { runEnforcedInspection, inspectionSummary, type IdeInspectionOutcome } from './ide-inspection.js'
import { isAbsolute } from 'node:path'
import { existsSync, readFileSync, realpathSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import type { AvailableCommand } from '@agentclientprotocol/sdk'
import { join, dirname, basename, relative, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
type AdvertisedModel = {
  modelId: string
  name: string
  description?: string | null
}

const MODEL_CONFIG_ID = 'model'
const THOUGHT_LEVEL_CONFIG_ID = 'thought_level'

// Startup inventory bounds (P2-12 audit): per-section caps plus a hard markdown cap
// keep session/new bounded even with pathological skill trees or symlink cycles.
const SKILL_ITEMS_CAP = 300
const PROMPT_ITEMS_CAP = 100
const EXTENSION_ITEMS_CAP = 100
const MAX_STARTUP_MD = 64_000

function builtinAvailableCommands(): AvailableCommand[] {
  return [
    {
      name: 'compact',
      description: 'Manually compact the session context',
      input: { hint: 'optional custom instructions' }
    },
    {
      name: 'autocompact',
      description: 'Toggle automatic context compaction',
      input: { hint: 'on|off|toggle' }
    },
    {
      name: 'export',
      description: 'Export session to an HTML file in the session cwd'
    },
    {
      name: 'session',
      description: 'Show session stats (messages, tokens, cost, session file)'
    },
    {
      name: 'name',
      description: 'Set session display name',
      input: { hint: '<name>' }
    },
    {
      name: 'steering',
      description: 'Get/set pi steering message delivery mode (how queued steering messages are delivered)',
      input: { hint: '(no args to show) all | one-at-a-time' }
    },
    {
      name: 'follow-up',
      description: 'Get/set pi follow-up message delivery mode (how queued follow-up messages are delivered)',
      input: { hint: '(no args to show) all | one-at-a-time' }
    },
    {
      name: 'changelog',
      description: 'Show pi changelog'
    }
  ]
}

function mergeCommands(a: AvailableCommand[], b: AvailableCommand[]): AvailableCommand[] {
  // Preserve order, de-dupe by name (first wins).
  const out: AvailableCommand[] = []
  const seen = new Set<string>()

  for (const c of [...a, ...b]) {
    if (seen.has(c.name)) continue
    seen.add(c.name)
    out.push(c)
  }

  return out
}
import { fileURLToPath } from 'node:url'

const pkg = readNearestPackageJson(import.meta.url)

export class PiAcpAgent implements ACPAgent {
  private readonly conn: AgentSideConnection
  private readonly sessions = new SessionManager()
  private readonly store = new SessionStore()
  private readonly restoringSessions = new Map<string, Promise<PiAcpSession>>()

  async dispose(): Promise<void> {
    await this.sessions.disposeAll()
  }

  // Remember recent session cwd and use it as the default filter.
  private lastSessionCwd: string | null = null

  constructor(conn: AgentSideConnection, _config?: unknown) {
    this.conn = conn
    void _config
  }

  private async startBridge(
    mcpServers: NewSessionRequest['mcpServers'],
    correlationId: string,
    cwd: string
  ): Promise<{ bridge: AcpMcpBridge; settings: BridgeSpawnSettings }> {
    if (process.env.PI_ACP_DEBUG_BRIDGE === '1') logBridgeDescriptors(mcpServers, cwd)
    const bridge = new AcpMcpBridge(this.conn, mcpServers, correlationId, { cwd })
    try {
      return { bridge, settings: await bridge.start() }
    } catch (error) {
      bridge.addDiagnostic(`IDE bridge startup failed: ${String((error as any)?.message ?? error)}`)
      await bridge.dispose()
      return { bridge, settings: { extensionPaths: [], env: {} } }
    }
  }

  private async closeManagedSession(sessionId: string): Promise<void> {
    const manager = this.sessions as any
    if (typeof manager.closeSession === 'function') {
      await manager.closeSession(sessionId)
      return
    }
    manager.close?.(sessionId)
  }

  private async closeManagedSessionsExcept(sessionId: string): Promise<void> {
    const manager = this.sessions as any
    if (typeof manager.closeAllExceptAsync === 'function') {
      await manager.closeAllExceptAsync(sessionId)
      return
    }
    manager.closeAllExcept?.(sessionId)
  }

  private async waitForBridgeReady(bridge: AcpMcpBridge, settings: BridgeSpawnSettings): Promise<void> {
    if (settings.extensionPaths.length === 0) return
    const handshaken = await bridge
      .waitForHandshake()
      .then(() => true)
      .catch(error => {
        bridge.addDiagnostic(`IDE bridge handshake unavailable: ${String((error as any)?.message ?? error)}`)
        return false
      })
    if (!handshaken) return
    await bridge.waitForRegistration().catch(error => {
      bridge.addDiagnostic(`IDE bridge registration unavailable: ${String((error as any)?.message ?? error)}`)
    })
  }

  private async cleanupFailedNewSession(sessionId: string, state?: any | null): Promise<void> {
    await this.closeManagedSession(sessionId)

    const sessionFile =
      typeof state?.sessionFile === 'string' && state.sessionFile.trim()
        ? state.sessionFile
        : this.store.get(sessionId)?.sessionFile

    if (typeof sessionFile === 'string' && sessionFile.trim()) {
      try {
        if (existsSync(sessionFile)) unlinkSync(sessionFile)
      } catch {
        // ignore cleanup failures; the auth/internal error is the primary result
      }
    }

    this.store.delete(sessionId)
  }

  private findStoredSession(sessionId: string): { cwd: string; sessionFile: string } | null {
    const stored = this.store.get(sessionId)
    if (stored?.cwd && stored?.sessionFile) {
      return { cwd: stored.cwd, sessionFile: stored.sessionFile }
    }

    const piSession = findPiSession(sessionId)
    if (!piSession) return null

    this.store.upsert({
      sessionId,
      cwd: piSession.cwd,
      sessionFile: piSession.sessionFile
    })

    return {
      cwd: piSession.cwd,
      sessionFile: piSession.sessionFile
    }
  }

  private async restoreSession(
    sessionId: string,
    opts?: { cwd?: string; mcpServers?: LoadSessionRequest['mcpServers'] }
  ): Promise<PiAcpSession> {
    const existing = this.sessions.maybeGet(sessionId)
    if (existing) return existing

    const inFlight = this.restoringSessions.get(sessionId)
    if (inFlight) return inFlight

    const restorePromise = (async () => {
      const stored = this.findStoredSession(sessionId)
      if (!stored) {
        throw RequestError.invalidParams(`Unknown sessionId: ${sessionId}`)
      }

      const cwd = opts?.cwd ?? stored.cwd

      // MCP bridge: connect client-provided ACP or stdio MCP servers and
      // prepare the pi subprocess to expose their tools (best effort; failures
      // degrade to ordinary pi-acp-jetbrain sessions without IDE tools).
      const { bridge, settings: bridgeSettings } = await this.startBridge(opts?.mcpServers ?? [], sessionId, cwd)

      let proc: PiRpcProcess
      try {
        proc = await PiRpcProcess.spawn({
          cwd,
          sessionPath: stored.sessionFile,
          piCommand: process.env.PI_ACP_PI_COMMAND,
          extensionPaths: bridgeSettings.extensionPaths,
          env: bridgeSettings.env
        })
      } catch (e: any) {
        await bridge.dispose()
        if (e?.name === 'PiRpcSpawnError') {
          throw RequestError.internalError({ code: e?.code }, String(e?.message ?? e))
        }
        throw e
      }

      const fileCommands = loadSlashCommands(cwd)
      const session = this.sessions.getOrCreate(sessionId, {
        cwd,
        mcpServers: opts?.mcpServers ?? [],
        conn: this.conn,
        proc,
        fileCommands,
        bridge
      })

      // Wait for the pi extension to authenticate (bounded); never fail the
      // session on a slow/absent handshake.
      if (bridgeSettings.extensionPaths.length > 0) {
        await this.waitForBridgeReady(bridge, bridgeSettings)
      }

      this.lastSessionCwd = cwd
      this.store.upsert({ sessionId, cwd, sessionFile: stored.sessionFile })

      return session
    })()

    this.restoringSessions.set(sessionId, restorePromise)

    try {
      return await restorePromise
    } finally {
      this.restoringSessions.delete(sessionId)
    }
  }

  async extMethod(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    if (method !== 'mcp/message') throw new Error(`Unsupported client extension method: ${method}`)
    return this.sessions.handleIncomingMcpMessage(params, false)
  }

  async extNotification(method: string, params: Record<string, unknown>): Promise<void> {
    if (method !== 'mcp/message') return
    await this.sessions.handleIncomingMcpMessage(params, true)
  }

  async initialize(params: InitializeRequest): Promise<InitializeResponse> {
    // We currently only support ACP protocol version 1.
    const supportedVersion = 1
    const requested = params.protocolVersion

    return {
      protocolVersion: requested === supportedVersion ? requested : supportedVersion,
      agentInfo: {
        name: pkg.name ?? 'pi-acp-jetbrain',
        title: 'pi ACP adapter',
        version: pkg.version ?? '0.0.0',
        _meta: {
          piAcp: {
            build: {
              revision: buildInfo.revision,
              buildTime: buildInfo.buildTime,
              packageVersion: buildInfo.packageVersion,
              isRelease: buildInfo.isRelease
            }
          }
        }
      },
      // Zed currently uses ClientCapabilities._meta["terminal-auth"] to decide whether to show
      // the "Authenticate" banner/button. If not supported, we still return the method for the registry.
      authMethods: getAuthMethods({
        supportsTerminalAuthMeta: (params as any)?.clientCapabilities?._meta?.['terminal-auth'] === true
      }),
      agentCapabilities: {
        loadSession: true,
        mcpCapabilities: { http: false, sse: false, acp: true },
        promptCapabilities: {
          image: true,
          audio: false,
          embeddedContext: process.env.PI_ACP_ENABLE_EMBEDDED_CONTEXT === 'true'
        },
        sessionCapabilities: {
          // **UNSTABLE** ACP capability used by Zed's codex-acp adapter.
          // Enables a native session picker in clients that support it.
          list: {},
          delete: {}
        }
      }
    }
  }

  async newSession(params: NewSessionRequest) {
    if (!isAbsolute(params.cwd)) {
      throw RequestError.invalidParams(`cwd must be an absolute path: ${params.cwd}`)
    }

    this.lastSessionCwd = params.cwd

    const fileCommands = loadSlashCommands(params.cwd)
    const enableSkillCommands = getEnableSkillCommands(params.cwd)

    // MCP bridge: connect client-provided ACP or stdio MCP servers and
    // prepare the pi subprocess to expose their tools (best effort).
    // The IPC session id is a bridge-internal correlation value (pipe naming,
    // hello validation). The ACP session id only exists after pi spawns, so we
    // generate one here and keep it stable for the pi subprocess env.
    const { bridge, settings: bridgeSettings } = await this.startBridge(
      params.mcpServers,
      crypto.randomUUID(),
      params.cwd
    )
    const session = await this.sessions
      .create({
        cwd: params.cwd,
        mcpServers: params.mcpServers,
        conn: this.conn,
        fileCommands,
        piCommand: process.env.PI_ACP_PI_COMMAND,
        bridge,
        extensionPaths: bridgeSettings.extensionPaths,
        env: bridgeSettings.env
      })
      .catch(async error => {
        await bridge.dispose()
        throw error
      })
    // Handshake is bounded and best-effort; failures degrade gracefully.
    await this.waitForBridgeReady(bridge, bridgeSettings)

    // Fetch state + models once (parallel) to reduce startup latency.
    let state: any = null
    let availableModels: any = null
    let stateErr: unknown = null
    let availableModelsErr: unknown = null

    await Promise.all([
      session.proc
        .getState()
        .then(s => {
          state = s as any
        })
        .catch(err => {
          stateErr = err
          state = null
        }),
      session.proc
        .getAvailableModels()
        .then(m => {
          availableModels = m as any
        })
        .catch(err => {
          availableModelsErr = err
          availableModels = null
        })
    ])

    const availableModelsAuthErr = maybeAuthRequiredError(availableModelsErr)

    if (availableModelsAuthErr) {
      await this.cleanupFailedNewSession(session.sessionId, state)
      throw availableModelsAuthErr
    }

    if (availableModelsErr) {
      await this.cleanupFailedNewSession(session.sessionId, state)
      throw RequestError.internalError({}, String((availableModelsErr as Error)?.message ?? availableModelsErr))
    }

    // If pi has no models available after spawning, it's effectively unauthenticated.
    const rawModelsCount = Array.isArray(availableModels?.models) ? availableModels.models.length : 0

    if (rawModelsCount === 0) {
      await this.cleanupFailedNewSession(session.sessionId, state)
      throw RequestError.authRequired(
        { authMethods: getAuthMethods() },
        'Configure an API key or log in with an OAuth provider.'
      )
    }

    if (stateErr && maybeAuthRequiredError(stateErr)) {
      await this.cleanupFailedNewSession(session.sessionId, state)
      throw RequestError.authRequired(
        { authMethods: getAuthMethods() },
        'Configure an API key or log in with an OAuth provider.'
      )
    }

    const { configOptions, models, modes } = await getSessionConfiguration(session.proc, {
      state,
      availableModels
    })

    const quietStartup = getQuietStartup(params.cwd)
    const updateNotice = buildUpdateNotice()

    // If quietStartup is enabled, suppress the full "startup info" prelude, but still surface
    // the "New version available" notice (if any) since it's high-signal and actionable.
    const preludeText = quietStartup
      ? updateNotice
        ? updateNotice + '\n'
        : ''
      : buildStartupInfo({
          cwd: params.cwd,
          fileCommands,
          updateNotice,
          bridgeStatus: bridge.hasServers ? bridge.status : undefined,
          bridgeTools: registeredBridgeTools(bridge),
          bridgeProjectPath: bridge.projectPath,
          bridgeCatalogComplete: bridge.catalogComplete
        })

    if (preludeText) session.setStartupInfo(preludeText)

    // Policy: within a single ACP connection (one client window), keep only one live pi subprocess.
    // This avoids leaking subprocesses when clients start new sessions but don't explicitly close old ones.
    // It does NOT affect other client windows because they run in separate agent processes.
    //
    // (Tests sometimes stub out `this.sessions`, so guard the call.)
    await this.closeManagedSessionsExcept(session.sessionId)
    const response = {
      sessionId: session.sessionId,
      configOptions,
      models,
      modes,
      _meta: {
        piAcp: {
          startupInfo: preludeText || null
        }
      }
    }

    // Try to send it immediately after session/new returns; if the client ignores it,
    // it will still be emitted as the first chunk of the first prompt.
    if (preludeText) setTimeout(() => session.sendStartupInfoIfPending(), 0)

    // Advertise slash commands (ACP: available_commands_update)
    // Important: some clients (e.g. Zed) will ignore notifications for an unknown sessionId.
    // So we must send this *after* the session/new response has been delivered.
    setTimeout(() => {
      void (async () => {
        try {
          const pi = (await session.proc.getCommands()) as any
          const { commands } = toAvailableCommandsFromPiGetCommands(pi, {
            enableSkillCommands,
            includeExtensionCommands: false
          })

          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'available_commands_update',
              availableCommands: mergeCommands(commands, builtinAvailableCommands())
            }
          })
          return
        } catch {
          // Fall back to file-based prompt templates (legacy behavior).
        }

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'available_commands_update',
            availableCommands: mergeCommands(toAvailableCommands(fileCommands), builtinAvailableCommands())
          }
        })
      })()
    }, 0)

    return response
  }

  async authenticate(_params: AuthenticateRequest) {
    // Terminal Auth is handled out-of-band by re-launching the binary with `--terminal-login`.
    // If the client calls `authenticate` anyway, we can no-op successfully.
    return
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    const session = await this.restoreSession(params.sessionId)

    const { message, images } = promptToPiMessage(params.prompt)

    // Built-in ACP slash command handling (headless-friendly subset).
    // Note: file-based slash commands are expanded inside session.prompt().
    if (images.length === 0 && message.trimStart().startsWith('/')) {
      const trimmed = message.trim()
      const space = trimmed.indexOf(' ')
      const cmd = space === -1 ? trimmed.slice(1) : trimmed.slice(1, space)
      const argsString = space === -1 ? '' : trimmed.slice(space + 1)
      const args = parseCommandArgs(argsString)

      if (cmd === 'compact') {
        const customInstructions = args.join(' ').trim() || undefined
        const res = await session.proc.compact(customInstructions)

        const r: any = res && typeof res === 'object' ? (res as any) : null
        const tokensBefore = typeof r?.tokensBefore === 'number' ? r.tokensBefore : null
        const summary = typeof r?.summary === 'string' ? r.summary : null

        const headerLines = [
          `Compaction completed.${customInstructions ? ' (custom instructions applied)' : ''}`,
          tokensBefore !== null ? `Tokens before: ${tokensBefore}` : null
        ].filter(Boolean)

        const text = headerLines.join('\n') + (summary ? `\n\n${summary}` : '')

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text }
          }
        })

        return { stopReason: 'end_turn' }
      }

      if (cmd === 'session') {
        const stats = (await session.proc.getSessionStats()) as any

        const lines: string[] = []
        if (stats?.sessionId) lines.push(`Session: ${stats.sessionId}`)
        if (stats?.sessionFile) lines.push(`Session file: ${stats.sessionFile}`)
        if (typeof stats?.totalMessages === 'number') lines.push(`Messages: ${stats.totalMessages}`)

        if (typeof stats?.cost === 'number') lines.push(`Cost: ${stats.cost}`)

        const t = stats?.tokens
        if (t && typeof t === 'object') {
          const parts: string[] = []
          if (typeof t.input === 'number') parts.push(`in ${t.input}`)
          if (typeof t.output === 'number') parts.push(`out ${t.output}`)
          if (typeof t.cacheRead === 'number') parts.push(`cache read ${t.cacheRead}`)
          if (typeof t.cacheWrite === 'number') parts.push(`cache write ${t.cacheWrite}`)
          if (typeof t.total === 'number') parts.push(`total ${t.total}`)
          if (parts.length) lines.push(`Tokens: ${parts.join(', ')}`)
        }

        // Fallback if stats shape changes.
        const text = lines.length ? lines.join('\n') : `Session stats:\n${JSON.stringify(stats, null, 2)}`

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text }
          }
        })

        return { stopReason: 'end_turn' }
      }

      if (cmd === 'name') {
        const name = args.join(' ').trim()
        if (!name) {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: 'Usage: /name <name>' }
            }
          })
          return { stopReason: 'end_turn' }
        }

        try {
          await session.proc.setSessionName(name)
        } catch (e: any) {
          const msg = String(e?.message ?? e)
          const hint = /set_session_name/i.test(msg)
            ? ' This requires a newer pi version that supports `set_session_name` in RPC mode.'
            : ''

          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: `Failed to set session name: ${msg}${hint}` }
            }
          })
          return { stopReason: 'end_turn' }
        }

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'session_info_update',
            title: name,
            updatedAt: new Date().toISOString()
          }
        })

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: `Session name set: ${name}` }
          }
        })

        return { stopReason: 'end_turn' }
      }

      if (cmd === 'steering') {
        const modeRaw = String(args[0] ?? '').toLowerCase()
        const state = (await session.proc.getState()) as any
        const current = String(state?.steeringMode ?? '')

        // If no arg, just report current.
        if (!modeRaw) {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: `Steering mode: ${current || 'unknown'}`
              }
            }
          })
          return { stopReason: 'end_turn' }
        }

        if (modeRaw !== 'all' && modeRaw !== 'one-at-a-time') {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: 'Usage: /steering all | /steering one-at-a-time'
              }
            }
          })
          return { stopReason: 'end_turn' }
        }

        await session.proc.setSteeringMode(modeRaw as 'all' | 'one-at-a-time')

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: `Steering mode set to: ${modeRaw}` }
          }
        })

        return { stopReason: 'end_turn' }
      }

      if (cmd === 'follow-up') {
        const modeRaw = String(args[0] ?? '').toLowerCase()
        const state = (await session.proc.getState()) as any
        const current = String(state?.followUpMode ?? '')

        // If no arg, just report current.
        if (!modeRaw) {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: `Follow-up mode: ${current || 'unknown'}`
              }
            }
          })
          return { stopReason: 'end_turn' }
        }

        if (modeRaw !== 'all' && modeRaw !== 'one-at-a-time') {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: 'Usage: /follow-up all | /follow-up one-at-a-time'
              }
            }
          })
          return { stopReason: 'end_turn' }
        }

        await session.proc.setFollowUpMode(modeRaw as 'all' | 'one-at-a-time')

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text: `Follow-up mode set to: ${modeRaw}` }
          }
        })

        return { stopReason: 'end_turn' }
      }

      if (cmd === 'changelog') {
        // Read pi's installed CHANGELOG.md. Adapter-side, no model call.
        const findChangelog = (): string | null => {
          // 1) Locate the installed pi package by resolving the `pi` executable.
          // On Node installs, `pi` typically resolves to .../@earendil-works/pi-coding-agent/dist/cli.js
          try {
            // Use the configured pi command (PI_ACP_PI_COMMAND) so the changelog
            // lookup matches the executable the adapter actually spawns (F-024).
            const piCommand = getPiCommand(process.env.PI_ACP_PI_COMMAND)
            const whichCmd = process.platform === 'win32' ? 'where' : 'which'
            const which = spawnSync(whichCmd, [piCommand], { encoding: 'utf-8' })
            const piPath = String(which.stdout ?? '')
              .split(/\r?\n/)[0]
              ?.trim()

            if (piPath) {
              const resolved = realpathSync(piPath)
              const pkgRoot = dirname(dirname(resolved))
              const p = join(pkgRoot, 'CHANGELOG.md')
              if (existsSync(p)) return p
            }
          } catch {
            // ignore
          }

          // 2) Fallback: ask npm where global modules live.
          try {
            const npmRoot = spawnSync('npm', ['root', '-g'], { encoding: 'utf-8' })
            const root = String(npmRoot.stdout ?? '').trim()
            if (root) {
              const p = join(root, '@earendil-works', 'pi-coding-agent', 'CHANGELOG.md')
              if (existsSync(p)) return p
            }
          } catch {
            // ignore
          }

          return null
        }

        const changelogPath = findChangelog()
        if (!changelogPath) {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: "Changelog not found (couldn't locate pi installation)." }
            }
          })
          return { stopReason: 'end_turn' }
        }

        let text = ''
        try {
          text = readFileSync(changelogPath, 'utf-8')
        } catch (e: any) {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text: `Failed to read changelog: ${String(e?.message ?? e)}` }
            }
          })
          return { stopReason: 'end_turn' }
        }

        // Keep it reasonably sized in chat.
        const maxChars = 20_000
        if (text.length > maxChars) text = text.slice(0, maxChars) + '\n\n...(truncated)...'

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text }
          }
        })

        return { stopReason: 'end_turn' }
      }

      if (cmd === 'export') {
        // For now we always export into the session cwd and do not accept a user-provided path.
        // IMPORTANT: pi's export_html reads the session JSONL file. If it doesn't exist yet
        // (no messages) or is empty, pi throws and RPC mode emits an uncorrelated parse error
        // (no id), which would otherwise hang our request. So we guard here.
        const state = (await session.proc.getState()) as any
        const sessionFile = typeof state?.sessionFile === 'string' ? state.sessionFile : null
        const messageCount = typeof state?.messageCount === 'number' ? state.messageCount : 0

        if (!sessionFile || messageCount === 0 || !existsSync(sessionFile)) {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: 'Nothing to export yet (no session messages). Send a prompt first.'
              }
            }
          })
          return { stopReason: 'end_turn' }
        }

        try {
          const raw = readFileSync(sessionFile, 'utf-8')
          if (raw.trim().length === 0) {
            await this.conn.sessionUpdate({
              sessionId: session.sessionId,
              update: {
                sessionUpdate: 'agent_message_chunk',
                content: {
                  type: 'text',
                  text: 'Nothing to export yet (empty session file). Send a prompt first.'
                }
              }
            })
            return { stopReason: 'end_turn' }
          }
        } catch {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: "Couldn't read session file for export. Try sending a prompt first."
              }
            }
          })
          return { stopReason: 'end_turn' }
        }

        const safeSessionId = session.sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
        const outputPath = join(session.cwd, `pi-session-${safeSessionId}.html`)

        let resultPath = ''
        try {
          const result = await session.proc.exportHtml(outputPath)
          resultPath = result.path
        } catch (e: any) {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: `Export failed: ${String(e?.message ?? e)}`
              }
            }
          })
          return { stopReason: 'end_turn' }
        }

        if (!resultPath) {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: {
                type: 'text',
                text: 'Export failed: no output path returned by pi.'
              }
            }
          })
          return { stopReason: 'end_turn' }
        }

        const uri = pathToFileURL(resultPath).href

        // Emit a short prefix + a resource link. Many clients concatenate chunks into a single
        // assistant message, so this avoids the "link + duplicate plain text" look.
        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: 'Session exported: '
            }
          }
        })

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'resource_link',
              name: `pi-session-${safeSessionId}.html`,
              uri,
              mimeType: 'text/html',
              title: 'Session exported'
            }
          }
        })

        return { stopReason: 'end_turn' }
      }

      if (cmd === 'autocompact') {
        const mode = (args[0] ?? 'toggle').toLowerCase()
        let enabled: boolean | null = null
        if (mode === 'on' || mode === 'true' || mode === 'enable' || mode === 'enabled') enabled = true
        else if (mode === 'off' || mode === 'false' || mode === 'disable' || mode === 'disabled') enabled = false

        if (enabled === null) {
          // toggle: read current state and invert.
          const state = (await session.proc.getState()) as any
          const current = Boolean(state?.autoCompactionEnabled)
          enabled = !current
        }

        await session.proc.setAutoCompaction(enabled)

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: {
              type: 'text',
              text: `Auto-compaction ${enabled ? 'enabled' : 'disabled'}.`
            }
          }
        })

        return { stopReason: 'end_turn' }
      }
    }

    const result = await session.prompt(message, images)

    // ACP StopReason does not include "error"; if pi fails we map to end_turn for now,
    // unless we know this was a cancellation.
    if (result === 'error') {
      if (session.wasCancelRequested()) return { stopReason: 'cancelled' }
      return {
        stopReason: 'end_turn',
        _meta: { piAcp: { error: session.lastError ?? 'pi prompt failed (no diagnostic retained)' } }
      }
    }

    if (result === 'end_turn') {
      const inspection = await this.enforceIdeInspection(session)
      if (inspection) {
        return { stopReason: 'end_turn', _meta: { piAcp: { inspection } } }
      }
    }

    return { stopReason: result }
  }

  /**
   * Deterministic post-turn IDE inspection gate (F-021/F-030). Runs the IDE's
   * own lint_files/get_file_problems tools over this turn's changed files via
   * the bridge connection, persists a report, and surfaces a summary. Never
   * throws: an unavailable bridge/tool or any failure degrades to a diagnostic
   * instead of breaking the turn. Opt out with PI_ACP_ENFORCE_IDE_INSPECT=0.
   */
  private async enforceIdeInspection(session: PiAcpSession): Promise<IdeInspectionOutcome | null> {
    if (process.env.PI_ACP_ENFORCE_IDE_INSPECT === '0') return null
    try {
      const outcome = await runEnforcedInspection({
        bridge: session.mcpBridge ?? undefined,
        cwd: session.cwd,
        sessionId: session.sessionId
      })
      const summary = inspectionSummary(outcome)
      if (summary) {
        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: summary } }
        })
      }
      return outcome
    } catch (error) {
      process.stderr.write(
        `[pi-acp-jetbrain] IDE inspection failed: ${String((error as Error)?.message ?? error)}
`
      )
      return null
    }
  }

  async cancel(params: CancelNotification): Promise<void> {
    const session = this.sessions.maybeGet(params.sessionId)
    if (!session) return
    // ACP cancel is a notification; never block message dispatch on pi's abort RPC
    // (which can be slow when pi is mid-turn). Queue clearing is synchronous inside
    // session.cancel(); the rest runs in the background (F-018).
    void session.cancel().catch(e => {
      process.stderr.write(`[pi-acp-jetbrain] session/cancel abort failed: ${String((e as Error)?.message ?? e)}\n`)
    })
  }

  async listSessions(params: ListSessionsRequest): Promise<ListSessionsResponse> {
    // ACP: filter by cwd if provided.
    // Zed currently sends `{}` (no cwd), so we default to the last session cwd to
    // emulate pi's `/resume` picker (project-scoped).
    const all = listPiSessions()

    const effectiveCwd = (params as any).cwd ?? this.lastSessionCwd
    const filtered = effectiveCwd ? all.filter(s => s.cwd === effectiveCwd) : all

    // Cursor-based pagination (opaque cursor). For MVP, we use a simple numeric offset.
    // If cursor is invalid, treat as 0.
    const offset = params.cursor ? Number.parseInt(params.cursor, 10) : 0
    const start = Number.isFinite(offset) && offset > 0 ? offset : 0

    const PAGE_SIZE = 50
    const page = filtered.slice(start, start + PAGE_SIZE)

    const sessions: SessionInfo[] = page.map(s => ({
      sessionId: s.sessionId,
      cwd: s.cwd,
      title: s.title,
      updatedAt: s.updatedAt
    }))

    const nextCursor = start + PAGE_SIZE < filtered.length ? String(start + PAGE_SIZE) : null

    return { sessions, nextCursor, _meta: {} }
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    if (!isAbsolute(params.cwd)) {
      throw RequestError.invalidParams(`cwd must be an absolute path: ${params.cwd}`)
    }

    // If the client is re-loading a session that is already active, tear down the existing
    // pi subprocess so we can start fresh and re-advertise commands reliably.
    // (Some clients may call session/load when restoring from history.)
    await this.closeManagedSession(params.sessionId)
    this.lastSessionCwd = params.cwd

    const stored = this.findStoredSession(params.sessionId)
    if (!stored) {
      throw RequestError.invalidParams(`Unknown sessionId: ${params.sessionId}`)
    }

    const enableSkillCommands = getEnableSkillCommands(params.cwd)
    const session = await this.restoreSession(params.sessionId, {
      cwd: params.cwd,
      mcpServers: params.mcpServers
    })
    const proc = session.proc
    const fileCommands = loadSlashCommands(params.cwd)

    // Policy: within a single ACP connection (one Zed window), keep only one live pi subprocess.
    // (Tests sometimes stub out `this.sessions`, so guard the call.)
    await this.closeManagedSessionsExcept(session.sessionId)
    // (Optional) ensure mapping stays fresh.
    this.store.upsert({
      sessionId: params.sessionId,
      cwd: params.cwd,
      sessionFile: stored.sessionFile
    })

    // Replay full conversation history.
    const data = (await proc.getMessages()) as any
    const messages = Array.isArray(data?.messages) ? data.messages : []

    for (const m of messages) {
      const role = String(m?.role ?? '')

      if (role === 'user') {
        const text = normalizePiMessageText(m?.content)
        if (text) {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'user_message_chunk',
              content: { type: 'text', text }
            }
          })
        }
      }

      if (role === 'assistant') {
        const text = normalizePiAssistantText(m?.content)
        if (text) {
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'agent_message_chunk',
              content: { type: 'text', text }
            }
          })
        }
      }

      if (role === 'toolResult') {
        const toolName = String((m as any)?.toolName ?? 'tool')
        const toolCallId = String((m as any)?.toolCallId ?? crypto.randomUUID())
        const isError = Boolean((m as any)?.isError)
        const isBash = isBashTool(toolName)

        if (isBash) {
          const text = bashResultText(m)
          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'tool_call',
              toolCallId,
              title: bashCommand(m) ?? toolName,
              kind: 'execute',
              status: 'completed',
              content: bashTerminalContent(toolCallId),
              _meta: bashTerminalInfoMeta(toolCallId, params.cwd)
            }
          })

          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'tool_call_update',
              toolCallId,
              status: isError ? 'failed' : 'completed',
              _meta: {
                ...(text ? bashTerminalOutputMeta(toolCallId, text) : {}),
                ...bashTerminalExitMeta(toolCallId, bashExitCode(m, isError))
              }
            }
          })
          continue
        }

        // Create a synthetic ACP tool call to render historic tool usage.
        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'tool_call',
            toolCallId,
            title: toolName,
            kind: toolName === 'read' ? 'read' : toolName === 'write' || toolName === 'edit' ? 'edit' : 'other',
            status: 'completed',
            rawInput: null,
            rawOutput: m
          }
        })

        const text = toolResultToText(m)
        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'tool_call_update',
            toolCallId,
            status: isError ? 'failed' : 'completed',
            content: text ? [{ type: 'content', content: { type: 'text', text } }] : null,
            rawOutput: m
          }
        })
      }
    }

    const { configOptions, models, modes } = await getSessionConfiguration(proc)
    const bridgeStatus = session.bridgeStatus
    const restoredBridgeInfo =
      session.hasMcpBridge && bridgeStatus
        ? buildBridgeStartupInfo({ cwd: params.cwd, status: bridgeStatus, bridgeTools: session.bridgeRegisteredTools })
        : null
    const restoredStartupInfo =
      restoredBridgeInfo &&
      (!getQuietStartup(params.cwd) ||
        Boolean(bridgeStatus?.diagnostics.length) ||
        Boolean(bridgeStatus?.failed) ||
        !bridgeStatus?.catalogComplete ||
        bridgeStatus?.lifecycle !== 'ready')
        ? restoredBridgeInfo
        : null

    if (restoredStartupInfo) session.setStartupInfo(restoredStartupInfo)

    const response = {
      configOptions,
      models,
      modes,
      _meta: {
        piAcp: {
          startupInfo: restoredStartupInfo
        }
      }
    }

    // Advertise bridge status and slash commands only after the response so the client knows the session exists.
    if (restoredStartupInfo) setTimeout(() => session.sendStartupInfoIfPending(), 0)
    setTimeout(() => {
      void (async () => {
        try {
          const pi = (await proc.getCommands()) as any
          const { commands } = toAvailableCommandsFromPiGetCommands(pi, {
            enableSkillCommands,
            includeExtensionCommands: false
          })

          await this.conn.sessionUpdate({
            sessionId: session.sessionId,
            update: {
              sessionUpdate: 'available_commands_update',
              availableCommands: mergeCommands(commands, builtinAvailableCommands())
            }
          })
          return
        } catch {
          // fall back
        }

        await this.conn.sessionUpdate({
          sessionId: session.sessionId,
          update: {
            sessionUpdate: 'available_commands_update',
            availableCommands: mergeCommands(toAvailableCommands(fileCommands), builtinAvailableCommands())
          }
        })
      })()
    }, 0)

    return response
  }

  async deleteSession(params: DeleteSessionRequest): Promise<DeleteSessionResponse> {
    const stored = this.store.get(params.sessionId)
    const piSession = findPiSession(params.sessionId)

    // Per ACP session/delete semantics, deleting a session that does not
    // exist (or is already gone) should succeed idempotently.
    // https://agentclientprotocol.com/protocol/v2/session-delete#semantics
    if (!stored && !piSession) {
      return {}
    }

    await this.closeManagedSession(params.sessionId)
    const sessionFile = stored?.sessionFile ?? piSession?.sessionFile

    if (sessionFile) {
      try {
        if (existsSync(sessionFile)) unlinkSync(sessionFile)
      } catch (e) {
        // Report cleanup failures through the reserved _meta extension (P2-8 audit):
        // keep the mapping so a retry can delete the session again.
        return {
          _meta: {
            piAcp: {
              deleteError: `failed to remove session file ${sessionFile}: ${e instanceof Error ? e.message : String(e)}`
            }
          }
        }
      }
    }

    this.store.delete(params.sessionId)

    return {}
  }

  async unstable_setSessionModel(params: { sessionId: string; modelId: string }): Promise<void> {
    const session = await this.restoreSession(params.sessionId)
    await setSessionModel(session.proc, params.modelId)
    await emitConfigOptionsUpdate(this.conn, session.sessionId, session.proc)
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
    const session = await this.restoreSession(params.sessionId)

    const mode = String(params.modeId)
    if (!isThinkingLevel(mode)) {
      throw RequestError.invalidParams(`Unknown modeId: ${mode}`)
    }

    await session.proc.setThinkingLevel(mode)

    // Let the client know the current mode changed (keeps the dropdown in sync).
    void this.conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'current_mode_update',
        currentModeId: mode
      }
    })

    await emitConfigOptionsUpdate(this.conn, session.sessionId, session.proc)

    return {}
  }

  async setSessionConfigOption(params: SetSessionConfigOptionRequest): Promise<SetSessionConfigOptionResponse> {
    const session = await this.restoreSession(params.sessionId)
    const configId = String(params.configId)

    if (typeof params.value !== 'string') {
      throw RequestError.invalidParams(`Expected string value for config option: ${configId}`)
    }

    if (configId === MODEL_CONFIG_ID) {
      await setSessionModel(session.proc, params.value)
    } else if (configId === THOUGHT_LEVEL_CONFIG_ID) {
      if (!isThinkingLevel(params.value)) {
        throw RequestError.invalidParams(`Unknown thinking level: ${params.value}`)
      }

      await session.proc.setThinkingLevel(params.value)

      void this.conn.sessionUpdate({
        sessionId: session.sessionId,
        update: {
          sessionUpdate: 'current_mode_update',
          currentModeId: params.value
        }
      })
    } else {
      throw RequestError.invalidParams(`Unknown config option: ${configId}`)
    }

    const configOptions = await emitConfigOptionsUpdate(this.conn, session.sessionId, session.proc)
    return { configOptions }
  }
}

function isThinkingLevel(x: string): x is ThinkingLevel {
  return x === 'off' || x === 'minimal' || x === 'low' || x === 'medium' || x === 'high' || x === 'xhigh'
}

async function getThinkingState(
  proc: PiRpcProcess,
  pre?: { state?: any | null }
): Promise<{
  availableModes: Array<{
    id: string
    name: string
    description?: string | null
  }>
  currentModeId: string
}> {
  // Ask pi for current thinking level.
  let current: ThinkingLevel = 'medium'

  const state =
    pre?.state ??
    (await (async () => {
      try {
        return (await proc.getState()) as any
      } catch {
        return null
      }
    })())

  const tl = typeof state?.thinkingLevel === 'string' ? state.thinkingLevel : null
  if (tl && isThinkingLevel(tl)) current = tl

  const available: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

  return {
    currentModeId: current,
    availableModes: available.map(id => ({
      id,
      name: `Thinking: ${id}`,
      description: null
    }))
  }
}

async function getSessionConfiguration(
  proc: PiRpcProcess,
  pre?: { state?: any | null; availableModels?: any | null }
): Promise<{
  configOptions: SessionConfigOption[]
  models: {
    availableModels: AdvertisedModel[]
    currentModelId: string
  } | null
  modes: {
    availableModes: Array<{
      id: string
      name: string
      description?: string | null
    }>
    currentModeId: string
  }
}> {
  const [models, modes] = await Promise.all([getModelState(proc, pre), getThinkingState(proc, { state: pre?.state })])

  return {
    configOptions: buildConfigOptions({ models, modes }),
    models,
    modes
  }
}

function buildConfigOptions(state: {
  models: {
    availableModels: AdvertisedModel[]
    currentModelId: string
  } | null
  modes: {
    availableModes: Array<{
      id: string
      name: string
      description?: string | null
    }>
    currentModeId: string
  }
}): SessionConfigOption[] {
  const configOptions: SessionConfigOption[] = [
    {
      type: 'select',
      id: THOUGHT_LEVEL_CONFIG_ID,
      category: 'thought_level',
      name: 'Thinking',
      description: 'Set the reasoning effort for this session',
      currentValue: state.modes.currentModeId,
      options: state.modes.availableModes.map(mode => ({
        value: mode.id,
        name: mode.name,
        description: mode.description ?? null
      }))
    }
  ]

  if (state.models?.availableModels.length) {
    configOptions.unshift({
      type: 'select',
      id: MODEL_CONFIG_ID,
      category: 'model',
      name: 'Model',
      description: 'Select the model for this session',
      currentValue: state.models.currentModelId,
      options: state.models.availableModels.map(model => ({
        value: model.modelId,
        name: model.name,
        description: model.description ?? null
      }))
    })
  }

  return configOptions
}

async function getModelState(
  proc: PiRpcProcess,
  pre?: { state?: any | null; availableModels?: any | null }
): Promise<{
  availableModels: AdvertisedModel[]
  currentModelId: string
} | null> {
  // Ask pi for available models.
  let availableModels: AdvertisedModel[] = []

  const data =
    pre?.availableModels ??
    (await (async () => {
      try {
        return (await proc.getAvailableModels()) as any
      } catch {
        return null
      }
    })())

  const models: any[] = Array.isArray(data?.models) ? data.models : []
  availableModels = models
    .map(m => {
      const provider = String(m?.provider ?? '').trim()
      const id = String(m?.id ?? '').trim()
      if (!provider || !id) return null

      const name = String(m?.name ?? id)
      return {
        modelId: `${provider}/${id}`,
        name: `${provider}/${name}`,
        description: null
      } satisfies AdvertisedModel
    })
    .filter(Boolean) as AdvertisedModel[]

  // Ask pi what model is currently active.
  let currentModelId: string | null = null

  const state =
    pre?.state ??
    (await (async () => {
      try {
        return (await proc.getState()) as any
      } catch {
        return null
      }
    })())

  const model = state?.model
  if (model && typeof model === 'object') {
    const provider = String((model as any).provider ?? '').trim()
    const id = String((model as any).id ?? '').trim()
    if (provider && id) currentModelId = `${provider}/${id}`
  }

  if (!availableModels.length && !currentModelId) return null

  // Fallback if current model is unknown: use first in list.
  if (!currentModelId) currentModelId = availableModels[0]?.modelId ?? 'default'

  return {
    availableModels,
    currentModelId: currentModelId ?? availableModels[0]?.modelId ?? 'default'
  }
}

async function emitConfigOptionsUpdate(
  conn: AgentSideConnection,
  sessionId: string,
  proc: PiRpcProcess
): Promise<SessionConfigOption[]> {
  const { configOptions } = await getSessionConfiguration(proc)

  await conn.sessionUpdate({
    sessionId,
    update: {
      sessionUpdate: 'config_option_update',
      configOptions
    }
  })

  return configOptions
}

async function setSessionModel(proc: PiRpcProcess, requestedModelId: string): Promise<void> {
  // Accept either:
  //  - "provider/model" (preferred, matches how we advertise)
  //  - "model" (fallback, resolve via available models)
  let provider: string | null = null
  let modelId: string | null = null

  if (requestedModelId.includes('/')) {
    const [candidateProvider, ...rest] = requestedModelId.split('/')
    provider = candidateProvider
    modelId = rest.join('/')
  } else {
    modelId = requestedModelId
  }

  if (!provider) {
    const data = (await proc.getAvailableModels()) as any
    const models: any[] = Array.isArray(data?.models) ? data.models : []
    const found = models.find(m => String(m?.id) === modelId)
    if (found) {
      provider = String(found.provider)
      modelId = String(found.id)
    }
  }

  if (!provider || !modelId) {
    throw RequestError.invalidParams(`Unknown modelId: ${requestedModelId}`)
  }

  await proc.setModel(provider, modelId)
}

function isSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+].+)?$/.test(v)
}

function compareSemver(a: string, b: string): number {
  // Very small comparator for x.y.z (ignores pre-release/build beyond making them "not greater" unless base differs)
  const pa = a
    .split(/[.-]/)
    .slice(0, 3)
    .map(n => Number(n))
  const pb = b
    .split(/[.-]/)
    .slice(0, 3)
    .map(n => Number(n))
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da > db) return 1
    if (da < db) return -1
  }
  return 0
}

function buildUpdateNotice(): string | null {
  // Best-effort update check against npm registry.
  // Important: keep it fast to not slow down session/new.
  try {
    const piVersion = spawnSync(getPiCommand(process.env.PI_ACP_PI_COMMAND), ['--version'], { encoding: 'utf-8' })
    const installed = (String(piVersion.stdout ?? '').trim() || String(piVersion.stderr ?? '').trim()).replace(
      /^v/i,
      ''
    )

    if (!installed || !isSemver(installed)) return null

    const latestRes = spawnSync('npm', ['view', '@earendil-works/pi-coding-agent', 'version'], {
      encoding: 'utf-8',
      timeout: 800
    })
    const latest = String(latestRes.stdout ?? '')
      .trim()
      .replace(/^v/i, '')

    if (!latest || !isSemver(latest)) return null
    if (compareSemver(latest, installed) <= 0) return null

    return `New version available: v${latest} (installed v${installed}). Run: \`npm i -g @earendil-works/pi-coding-agent\``
  } catch {
    return null
  }
}

/**
 * Debug-only stderr dump of the raw session/new mcpServers descriptor.
 * IntelliJ pipes the adapter's stderr into idea.log, so a fresh chat with
 * PI_ACP_DEBUG_BRIDGE=1 captures the exact descriptor the host sent.
 * Values are redacted except for known local-only keys.
 */
export function sanitizeBridgeDescriptors(mcpServers: NewSessionRequest['mcpServers']): unknown {
  const servers = Array.isArray(mcpServers) ? mcpServers : []
  return servers.map(server => {
    const candidate = server as Record<string, unknown>
    const args = Array.isArray(candidate.args) ? candidate.args : undefined
    return {
      name: candidate.name,
      type: candidate.type,
      command: typeof candidate.command === 'string' ? String(candidate.command).split('/').pop() : candidate.command,
      args: args ? `[${args.length} arg(s), redacted]` : undefined,
      env: Array.isArray(candidate.env)
        ? (candidate.env as Array<{ name?: string; value?: string }>).map(item => ({
            name: item.name,
            value:
              item.name === 'IJ_MCP_SERVER_PORT' || item.name === 'IJ_MCP_SESSION_ID'
                ? item.value
                : item.value
                  ? `[redacted ${String(item.value).length} chars]`
                  : undefined
          }))
        : candidate.env === undefined
          ? undefined
          : '[redacted non-array env]'
    }
  })
}

function logBridgeDescriptors(mcpServers: NewSessionRequest['mcpServers'], cwd: string): void {
  try {
    process.stderr.write(
      `[pi-acp-jetbrain] session/new mcpServers (cwd=${cwd}): ${JSON.stringify(sanitizeBridgeDescriptors(mcpServers))}\n`
    )
  } catch {
    // Never let debug logging break the session.
  }
}

/** Tools whose registration the pi extension acknowledged; unacknowledged tools are not advertised. */
function registeredBridgeTools(bridge: AcpMcpBridge): BridgeTool[] {
  const registered = new Set((bridge.registration?.registered ?? []).map(item => item.exposedName))
  return bridge.tools.filter(tool => registered.has(tool.exposedName))
}

export function buildBridgeStartupInfo(opts: {
  cwd: string
  status: import('./mcp-types.js').BridgeStatus
  bridgeTools?: BridgeTool[]
}): string {
  const md: string[] = []
  const addSection = (title: string, items: string[]) => {
    const cleaned = items.map(item => item.trim()).filter(Boolean)
    if (!cleaned.length) return
    md.push(`## ${title}`)
    for (const item of cleaned) md.push(`- ${item}`)
    md.push('')
  }

  if (opts.status.diagnostics.length) addSection('IDE Bridge', opts.status.diagnostics)

  const tools = opts.bridgeTools ?? []
  const preferred = [
    'search_symbol',
    'get_symbol_info',
    'analyze_calls',
    'get_file_problems',
    'lint_files',
    'build_project',
    'get_run_configurations',
    'git_status'
  ].filter(name => tools.some(tool => tool.remoteName === name))
  const partial = opts.status.catalogComplete ? '' : ' (catalog is partial)'
  const failed = opts.status.failed > 0 ? `; ${opts.status.failed} registration failed` : ''
  const registeredNames = tools.map(tool => tool.remoteName).join(', ')
  addSection('IDE Tools', [
    `JetBrains IDE MCP bridge: ${opts.status.registered} tool${opts.status.registered === 1 ? '' : 's'} registered (${opts.status.discovered} discovered${failed})${partial}.`,
    `Project context: ${opts.cwd}; projectPath is injected for tools that declare it unless explicitly overridden.`,
    preferred.length ? `Prefer semantic JetBrains IDE workflows when applicable: ${preferred.join(', ')}.` : '',
    registeredNames ? `Registered remote tools: ${registeredNames}` : ''
  ])

  return md.join('\n').trim()
}

export function buildStartupInfo(opts: {
  cwd: string
  fileCommands: ReturnType<typeof loadSlashCommands>
  updateNotice: string | null
  bridgeDiagnostics?: string[]
  bridgeStatus?: import('./mcp-types.js').BridgeStatus
  bridgeTools?: BridgeTool[]
  bridgeProjectPath?: string
  bridgeCatalogComplete?: boolean
}): string {
  void opts.fileCommands

  const md: string[] = []

  const buildLine = `pi-acp-jetbrain ${buildInfo.packageVersion} (build ${buildInfo.revision}${buildInfo.dirty ? ', dirty source' : ''}${buildInfo.buildTime ? ', ' + buildInfo.buildTime : ''})`
  md.push(buildLine)
  md.push('---')
  md.push('')

  // pi version header
  try {
    const piVersion = spawnSync(getPiCommand(process.env.PI_ACP_PI_COMMAND), ['--version'], { encoding: 'utf-8' })
    const installed = (String(piVersion.stdout ?? '').trim() || String(piVersion.stderr ?? '').trim()).replace(
      /^v/i,
      ''
    )
    if (installed) {
      md.push(`pi v${installed}`)
      md.push('---')
      md.push('')
    }
  } catch {
    // ignore
  }

  const addSection = (title: string, items: string[]) => {
    const cleaned = items.map(s => s.trim()).filter(Boolean)
    if (!cleaned.length) return

    md.push(`## ${title}`)
    for (const item of cleaned) md.push(`- ${item}`)
    md.push('')
  }

  // Context
  // Prefer cwd-relative or ~ labels over machine-specific absolute paths so the
  // prelude stays portable (F-011).
  const displayPath = (p: string): string => {
    const fromCwd = relative(opts.cwd, p)
    if (!fromCwd.startsWith('..') && !fromCwd.startsWith('/') && !/^[A-Za-z]:/.test(fromCwd)) return fromCwd
    const home = process.env.HOME ?? ''
    if (home && p.startsWith(home + sep)) return `~${p.slice(home.length + sep.length)}`
    return basename(p)
  }
  const contextItems: string[] = []
  const contextPath = join(opts.cwd, 'AGENTS.md')
  if (existsSync(contextPath)) contextItems.push(displayPath(contextPath))
  addSection('Context', contextItems)

  // IDE bridge diagnostics (ACP MCP bridge status)
  const bridgeDiagnostics = opts.bridgeStatus?.diagnostics ?? opts.bridgeDiagnostics
  if (bridgeDiagnostics?.length) {
    addSection('IDE Bridge', bridgeDiagnostics)
  }

  // JetBrains IDE MCP guidance. Keep this short and operational: the model already receives
  // individual tool schemas, but it benefits from an explicit semantic-first workflow.
  if (opts.bridgeTools?.length) {
    const preferred = [
      'search_symbol',
      'get_symbol_info',
      'analyze_calls',
      'get_file_problems',
      'lint_files',
      'rename_refactoring',
      'build_project',
      'get_run_configurations',
      'execute_run_configuration',
      'git_status'
    ].filter(name => opts.bridgeTools!.some(tool => tool.remoteName === name))
    const registered = opts.bridgeTools.map(tool => tool.remoteName).join(', ')
    const discovered = opts.bridgeStatus?.discovered ?? opts.bridgeTools.length
    const registeredCount = opts.bridgeStatus?.registered ?? opts.bridgeTools.length
    const failedCount = opts.bridgeStatus?.failed ?? 0
    const status =
      (opts.bridgeStatus?.catalogComplete ?? opts.bridgeCatalogComplete) === false ? ' (catalog is partial)' : ''
    const registrationNote = failedCount > 0 ? `; ${failedCount} registration failed` : ''
    addSection('IDE Tools', [
      `JetBrains IDE MCP bridge: ${registeredCount} tool${registeredCount === 1 ? '' : 's'} registered (${discovered} discovered${registrationNote})${status}.`,
      `Project context: ${opts.bridgeProjectPath ?? opts.cwd}; projectPath is injected for tools that declare it unless explicitly overridden.`,
      preferred.length > 0
        ? `Prefer semantic JetBrains IDE workflows when applicable: ${preferred.join(', ')}.`
        : 'Prefer the registered JetBrains IDE tools for IDE-aware navigation, inspections, and refactoring.',
      `Registered remote tools: ${registered}`
    ])
  }

  // Skills
  const skillsItems: string[] = []

  const pushSkillFromRoot = (root: string) => {
    try {
      // Direct .md files in root
      for (const e of readdirSync(root)) {
        if (skillsItems.length >= SKILL_ITEMS_CAP) break
        const p = join(root, e)
        try {
          const st = statSync(p)
          if (st.isFile() && e.toLowerCase().endsWith('.md')) {
            skillsItems.push(displayPath(p))
          }
        } catch {
          // ignore
        }
      }

      // Recursive SKILL.md under subdirectories with symlink-cycle protection and a
      // hard item cap so pathological trees cannot hang session/new (P2-12 audit).
      const visited = new Set<string>()
      const stack: string[] = [root]
      while (stack.length && skillsItems.length < SKILL_ITEMS_CAP) {
        const dir = stack.pop()!
        let real
        try {
          real = realpathSync(dir)
        } catch {
          continue
        }
        if (visited.has(real)) continue
        visited.add(real)
        let entries: string[] = []
        try {
          entries = readdirSync(dir)
        } catch {
          continue
        }

        for (const name of entries) {
          // Skip obvious noise
          if (name === 'node_modules' || name === '.git') continue
          const p = join(dir, name)
          let st
          try {
            st = statSync(p)
          } catch {
            continue
          }
          if (st.isDirectory()) {
            stack.push(p)
          } else if (st.isFile() && name === 'SKILL.md') {
            if (skillsItems.length >= SKILL_ITEMS_CAP) break
            skillsItems.push(displayPath(p))
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Global skills
  // Use getAgentDir() so this respects PI_CODING_AGENT_DIR overrides.
  const globalSkillsDir = join(getAgentDir(), 'skills')
  pushSkillFromRoot(globalSkillsDir)

  // Also support ~/.agents/skills (pi skill discovery)
  const legacyAgentsSkillsDir = join(process.env.HOME ?? '', '.agents', 'skills')
  pushSkillFromRoot(legacyAgentsSkillsDir)

  // Project skills (.pi/skills)
  const projectSkillsDir = join(opts.cwd, '.pi', 'skills')
  pushSkillFromRoot(projectSkillsDir)

  addSection('Skills', skillsItems)

  // Prompts
  const promptsItems: string[] = []
  const promptsDir = join(getAgentDir(), 'prompts')
  try {
    const prompts = readdirSync(promptsDir)
      .filter(f => f.endsWith('.md'))
      .slice(0, PROMPT_ITEMS_CAP)
    for (const f of prompts) promptsItems.push(`/${basename(f, '.md')}`)
  } catch {
    // ignore
  }
  addSection('Prompts', promptsItems)

  // Extensions
  const extItems: string[] = []
  const extDir = join(getAgentDir(), 'extensions')
  try {
    const exts = readdirSync(extDir)
      .filter(f => f.endsWith('.ts') || f.endsWith('.js'))
      .slice(0, EXTENSION_ITEMS_CAP)
    for (const f of exts) extItems.push(displayPath(join(extDir, f)))
  } catch {
    // ignore
  }

  // Also show npm packages from pi settings (global + project)
  const settingsPaths = [join(getAgentDir(), 'settings.json'), join(opts.cwd, '.pi', 'settings.json')]
  for (const settingsPath of settingsPaths) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as any
      const pkgs: string[] = Array.isArray(settings?.packages) ? settings.packages : []
      for (const pkg of pkgs) {
        const s = String(pkg)
        if (s.startsWith('npm:')) {
          extItems.push(`${s}\n  - index.ts`)
        } else {
          extItems.push(s)
        }
      }
    } catch {
      // ignore
    }
  }

  addSection('Extensions', extItems)

  if (opts.updateNotice) {
    md.push('---')
    md.push(opts.updateNotice)
    md.push('')
  }

  // Do NOT include themes (per request).
  const text = md.join('\n').trim() + '\n'
  // Hard production cap so pathological trees cannot balloon session/new
  // regardless of the per-section caps above (P2-12 audit).
  return text.length > MAX_STARTUP_MD
    ? `${text.slice(0, MAX_STARTUP_MD)}\n… (startup info truncated by pi-acp-jetbrain)\n`
    : text
}

function readNearestPackageJson(metaUrl: string): {
  name?: string
  version?: string
} {
  try {
    let dir = dirname(fileURLToPath(metaUrl))

    // Walk upwards a few levels to find the nearest package.json
    for (let i = 0; i < 6; i++) {
      const p = join(dir, 'package.json')
      if (existsSync(p)) {
        const json = JSON.parse(readFileSync(p, 'utf-8')) as any
        return { name: json?.name, version: json?.version }
      }
      dir = dirname(dir)
    }
  } catch {
    // ignore
  }
  return { name: 'pi-acp-jetbrain', version: '0.0.0' }
}
