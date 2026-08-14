/**
 * Bundled pi extension for the ACP MCP bridge (pi-acp-jetbrain).
 *
 * The extension receives an immutable, session-scoped catalog over authenticated
 * IPC, registers each remote tool independently, acknowledges registration, and
 * forwards calls/results without hiding MCP errors as successful text.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type, type TSchema } from 'typebox'
import { createConnection, type Socket } from 'node:net'
import { existsSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep, dirname } from 'node:path'
import {
  BRIDGE_IPC_VERSION,
  type BridgeIpcMessage,
  type BridgeMcpResult,
  type BridgeTool,
  type BridgeCatalog,
  type CatalogRegistration
} from '../acp/mcp-types.js'

const ENDPOINT = process.env.PI_ACP_MCP_IPC_ENDPOINT
const TOKEN = process.env.PI_ACP_MCP_IPC_TOKEN
const SESSION_ID = process.env.PI_ACP_MCP_SESSION_ID
type IpcMessage = BridgeIpcMessage

type JsonSchema = Record<string, unknown>
type ConversionState = {
  depth: number
  nodes: number
  warnings: string[]
  references: Map<string, JsonSchema>
  resolving: Set<string>
}

function collectReferences(schema: JsonSchema, state: ConversionState): void {
  for (const key of ['$defs', 'definitions']) {
    const definitions = schema[key]
    if (!definitions || typeof definitions !== 'object' || Array.isArray(definitions)) continue
    for (const [name, definition] of Object.entries(definitions as JsonSchema)) {
      if (!definition || typeof definition !== 'object' || Array.isArray(definition)) continue
      state.references.set(`#/${key}/${name}`, definition as JsonSchema)
      state.references.set(name, definition as JsonSchema)
    }
  }
}

function createConversionState(): ConversionState {
  return { depth: 0, nodes: 0, warnings: [], references: new Map(), resolving: new Set() }
}

const MAX_SCHEMA_DEPTH = 32
const MAX_SCHEMA_NODES = 2000
const MAX_RESULT_DEPTH = 8
const MAX_RESULT_ITEMS = 100
const MAX_RESULT_STRING = 40_000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const REDACTED = '[redacted]'

function schemaOptions(schema: JsonSchema): Record<string, unknown> {
  const options: Record<string, unknown> = {}
  for (const key of [
    'description',
    'title',
    '$id',
    'default',
    'format',
    'pattern',
    'minLength',
    'maxLength',
    'minimum',
    'maximum',
    'exclusiveMinimum',
    'exclusiveMaximum',
    'multipleOf',
    'minItems',
    'maxItems',
    'uniqueItems',
    'minProperties',
    'maxProperties',
    'examples'
  ]) {
    if (schema[key] !== undefined) options[key] = schema[key]
  }
  return options
}

function union(schemas: TSchema[], options?: Record<string, unknown>): TSchema {
  if (schemas.length === 0) return Type.Any()
  if (schemas.length === 1) return schemas[0]
  return Type.Union(schemas as [TSchema, TSchema, ...TSchema[]], options as never)
}

function intersection(schemas: TSchema[], options?: Record<string, unknown>): TSchema {
  if (schemas.length === 0) return Type.Any()
  if (schemas.length === 1) return schemas[0]
  return Type.Intersect(schemas as [TSchema, TSchema, ...TSchema[]], options as never)
}

function literal(value: unknown): TSchema | undefined {
  if (value === null) return Type.Null()
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return Type.Literal(value as string | number | boolean)
  }
  return undefined
}

export function schemaToTypeBox(schema: JsonSchema, state: ConversionState = createConversionState()): TSchema {
  collectReferences(schema, state)
  state.nodes++
  if (state.depth > MAX_SCHEMA_DEPTH || state.nodes > MAX_SCHEMA_NODES) {
    state.warnings.push('schema widened after depth or node limit')
    return Type.Any()
  }

  const reference = schema.$ref
  if (typeof reference === 'string') {
    const target = state.references.get(reference)
    if (!target) {
      state.warnings.push(`unresolved JSON Schema reference widened: ${reference}`)
      return Type.Any(schemaOptions(schema) as never)
    }
    if (state.resolving.has(reference)) {
      state.warnings.push(`cyclic JSON Schema reference widened: ${reference}`)
      return Type.Any(schemaOptions(schema) as never)
    }
    state.resolving.add(reference)
    try {
      return schemaToTypeBox(target, state)
    } finally {
      state.resolving.delete(reference)
    }
  }
  const options = schemaOptions(schema)
  const constSchema = schema.const !== undefined ? literal(schema.const) : undefined
  if (schema.const !== undefined) return constSchema ?? Type.Any(options as never)

  if (Array.isArray(schema.enum)) {
    const members = schema.enum.map(value => literal(value)).filter((value): value is TSchema => value !== undefined)
    if (members.length === schema.enum.length) return union(members, options)
    state.warnings.push('enum with unsupported literal widened to any')
    return Type.Any(options as never)
  }

  const nested = (child: JsonSchema): TSchema => {
    state.depth++
    try {
      return schemaToTypeBox(child, state)
    } finally {
      state.depth--
    }
  }
  const combinator = (key: 'anyOf' | 'oneOf' | 'allOf'): TSchema | undefined => {
    if (!Array.isArray(schema[key])) return undefined
    const members = schema[key]
      .filter((item): item is JsonSchema => Boolean(item && typeof item === 'object'))
      .map(nested)
    return key === 'allOf' ? intersection(members, options) : union(members, options)
  }
  const combined = combinator('allOf') ?? combinator('anyOf') ?? combinator('oneOf')
  if (combined) return schema.nullable === true ? union([combined, Type.Null()], options) : combined

  const types = Array.isArray(schema.type) ? schema.type : [schema.type]
  const named = types.filter((type): type is string => typeof type === 'string')
  const converted = named.map(type => {
    switch (type) {
      case 'string':
        return Type.String(options as never)
      case 'number':
        return Type.Number(options as never)
      case 'integer':
        return Type.Integer(options as never)
      case 'boolean':
        return Type.Boolean(options as never)
      case 'null':
        return Type.Null()
      case 'array': {
        const tupleItems = Array.isArray(schema.prefixItems)
          ? schema.prefixItems
          : Array.isArray(schema.items)
            ? schema.items
            : undefined
        if (tupleItems) {
          const items = tupleItems
            .filter((item): item is JsonSchema => Boolean(item && typeof item === 'object'))
            .map(nested)
          return Type.Tuple(items as never, options as never)
        }
        const items = schema.items && typeof schema.items === 'object' ? nested(schema.items as JsonSchema) : Type.Any()
        return Type.Array(items, options as never)
      }
      case 'object':
        return objectSchema(schema, state)
      case 'any':
        return Type.Any()
      default:
        state.warnings.push(`unsupported JSON Schema type widened: ${type}`)
        return Type.Any()
    }
  })

  let result = converted.length > 0 ? union(converted, options) : objectSchema(schema, state)
  if (schema.nullable === true && !named.includes('null')) result = union([result, Type.Null()], options)
  return result
}

function objectSchema(schema: JsonSchema, state: ConversionState): TSchema {
  const properties = schema.properties && typeof schema.properties === 'object' ? (schema.properties as JsonSchema) : {}
  const required = new Set(
    Array.isArray(schema.required) ? schema.required.filter(value => typeof value === 'string') : []
  )
  const fields: Record<string, TSchema> = {}
  for (const [name, child] of Object.entries(properties)) {
    let converted: TSchema = Type.Any()
    if (child && typeof child === 'object') {
      state.depth++
      try {
        converted = schemaToTypeBox(child as JsonSchema, state)
      } finally {
        state.depth--
      }
    }
    fields[name] = required.has(name) ? converted : Type.Optional(converted)
  }

  const options = schemaOptions(schema)
  if (schema.additionalProperties === false) options.additionalProperties = false
  else if (schema.additionalProperties === true || schema.additionalProperties === undefined)
    options.additionalProperties = true
  else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    state.depth++
    try {
      options.additionalProperties = schemaToTypeBox(schema.additionalProperties as JsonSchema, state)
    } finally {
      state.depth--
    }
  }
  return Type.Object(fields, options as never)
}

function isSensitiveKey(key: string): boolean {
  return /token|secret|password|authorization|cookie|api[-_]?key|private[-_]?key/i.test(key)
}

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > MAX_RESULT_DEPTH) return '[depth limit]'
  if (typeof value === 'string')
    return value.length > MAX_RESULT_STRING ? `${value.slice(0, MAX_RESULT_STRING)}…` : value
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value
  if (Array.isArray(value)) return value.slice(0, MAX_RESULT_ITEMS).map(item => sanitize(item, depth + 1))
  if (typeof value === 'object') {
    const output: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, MAX_RESULT_ITEMS)) {
      output[key] = isSensitiveKey(key) ? REDACTED : sanitize(child, depth + 1)
    }
    return output
  }
  return String(value)
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    return String(value)
  }
}

function hasSchemaProperty(schema: JsonSchema, name: string): boolean {
  const properties = schema.properties
  return Boolean(
    properties &&
    typeof properties === 'object' &&
    !Array.isArray(properties) &&
    Object.prototype.hasOwnProperty.call(properties, name)
  )
}

/** Add stable JetBrains IDE project context without mutating the model-provided arguments. */
export function prepareToolArguments(
  tool: Pick<BridgeTool, 'inputSchema'>,
  args: Record<string, unknown>,
  projectPath?: string
): Record<string, unknown> {
  const prepared = { ...args }
  if (projectPath && prepared.projectPath === undefined && hasSchemaProperty(tool.inputSchema, 'projectPath')) {
    prepared.projectPath = projectPath
  }
  return prepared
}

function toolDescription(tool: BridgeTool): string {
  const notes: string[] = []
  if (hasSchemaProperty(tool.inputSchema, 'projectPath')) {
    notes.push('projectPath is supplied from the ACP working directory when omitted.')
  }
  if (hasSchemaProperty(tool.inputSchema, 'filePath') || hasSchemaProperty(tool.inputSchema, 'files')) {
    notes.push('File paths are project-relative unless the tool says otherwise.')
  }
  switch (tool.remoteName) {
    case 'search_symbol':
      notes.push('Use this before call hierarchy analysis when you need a fully qualified symbol name.')
      break
    case 'analyze_calls':
      notes.push('Pass the exact fully qualified symbol or signature returned by search_symbol.')
      break
    case 'get_file_problems':
    case 'lint_files':
      notes.push('Prefer JetBrains IDE inspections for IDE-aware diagnostics instead of text-only checks.')
      break
    case 'rename_refactoring':
      notes.push('Use for semantic rename and verify the affected files afterward.')
      break
    case 'get_run_configurations':
      notes.push('Use this first to discover exact run configuration names and executable code locations.')
      break
    case 'execute_run_configuration':
      notes.push('Use an exact configuration name or a run point returned by get_run_configurations.')
      break
    case 'xdebug_set_breakpoint':
      notes.push('Prefer a logpoint with suspendPolicy NONE for low-disturbance runtime evidence.')
      break
    case 'xdebug_start_debugger_session':
      notes.push('Set at least one breakpoint before starting; then wait for a pause.')
      break
    case 'xdebug_control_session':
      notes.push('After RESUME or start, use WAIT_FOR_PAUSE before reading stack/frame state.')
      break
  }
  const base = tool.description ?? `IDE tool ${tool.remoteName} (via ${tool.connectionId})`
  return notes.length > 0 ? `${base}\n\nPi ACP IDE guidance: ${notes.join(' ')}` : base
}

export interface PiMcpToolResult {
  content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }>
  details: Record<string, unknown>
}

export class McpToolError extends Error {
  readonly details: Record<string, unknown>

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'McpToolError'
    this.details = details
  }
}

/** Convert a JSON MCP result to Pi's text/image content plus structured details. */
export function mcpResultToPiResult(value: unknown): PiMcpToolResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new McpToolError('MCP tool returned a malformed result', { code: 'malformed_result' })
  }
  const result = value as BridgeMcpResult
  const safeResult = sanitize(result) as Record<string, unknown>
  const details: Record<string, unknown> = { mcp: {} }
  const content: PiMcpToolResult['content'] = []

  if (result.isError === true) {
    throw new McpToolError(`MCP tool reported an error\n${stringify(safeResult)}`, {
      code: 'mcp_is_error',
      result: safeResult
    })
  }

  if (result.structuredContent !== undefined) details.structuredContent = sanitize(result.structuredContent)
  if (result._meta !== undefined) details.meta = sanitize(result._meta)

  const unsupported: unknown[] = []
  for (const block of Array.isArray(result.content) ? result.content : []) {
    if (!block || typeof block !== 'object') {
      unsupported.push(sanitize(block))
      continue
    }
    if (block.type === 'text' && typeof block.text === 'string') {
      content.push({ type: 'text', text: block.text })
    } else if (
      block.type === 'image' &&
      typeof block.data === 'string' &&
      typeof block.mimeType === 'string' &&
      Buffer.byteLength(block.data, 'base64') <= MAX_IMAGE_BYTES
    ) {
      content.push({ type: 'image', data: block.data, mimeType: block.mimeType })
    } else if (block.type === 'resource' && block.resource && typeof block.resource === 'object') {
      const resource = block.resource as Record<string, unknown>
      const uri = typeof resource.uri === 'string' ? resource.uri : 'unknown-uri'
      if (typeof resource.text === 'string') content.push({ type: 'text', text: `[resource ${uri}]\n${resource.text}` })
      else content.push({ type: 'text', text: `[resource ${uri}]` })
      unsupported.push({ type: 'resource', resource: sanitize(resource) })
    } else if (block.type === 'resource_link' && typeof block.uri === 'string') {
      content.push({ type: 'text', text: `[resource link ${block.uri}]` })
      unsupported.push(sanitize(block))
    } else {
      unsupported.push(sanitize(block))
    }
  }

  if (unsupported.length > 0) details.unsupportedContent = unsupported.slice(0, MAX_RESULT_ITEMS)
  const extra = Object.fromEntries(
    Object.entries(result).filter(([key]) => !['content', 'structuredContent', 'isError', '_meta'].includes(key))
  )
  if (Object.keys(extra).length > 0) details.mcp = sanitize(extra) as Record<string, unknown>
  if (content.length === 0 && result.structuredContent !== undefined) {
    content.push({ type: 'text', text: stringify(sanitize(result.structuredContent)) })
  }
  if (content.length === 0) content.push({ type: 'text', text: 'MCP tool returned no textual content.' })
  return { content, details }
}

const BRIDGE_INSTANCE_KEY = Symbol.for('pi-acp-jetbrain.acp-mcp-bridge.instance')

export function claimBridgeInstance(scope: object, owner: symbol): boolean {
  const registry = scope as Record<PropertyKey, unknown>
  if (registry[BRIDGE_INSTANCE_KEY] !== undefined) return false
  registry[BRIDGE_INSTANCE_KEY] = owner
  return true
}

export function releaseBridgeInstance(scope: object, owner: symbol): void {
  const registry = scope as Record<PropertyKey, unknown>
  if (registry[BRIDGE_INSTANCE_KEY] === owner) delete registry[BRIDGE_INSTANCE_KEY]
}

export interface AcpMcpBridgeRuntime {
  endpoint?: string
  token?: string
  sessionId?: string
  instanceScope?: object
  connect?: (endpoint: string) => Socket
}

export function createAcpMcpBridgeExtension(runtime: AcpMcpBridgeRuntime = {}): (pi: ExtensionAPI) => void {
  return pi => activateAcpMcpBridgeExtension(pi, runtime)
}

export default function acpMcpBridgeExtension(pi: ExtensionAPI): void {
  activateAcpMcpBridgeExtension(pi)
}

function activateAcpMcpBridgeExtension(pi: ExtensionAPI, runtime: AcpMcpBridgeRuntime = {}): void {
  let ideMode: IdeCodingMode = 'off'
  let ideState: IdeCodingState = 'disabled'
  let capabilities: IdeCapabilityMap = new Map()
  let projectRoot: string | undefined
  const policyDiagnostics: string[] = []
  const registeredIdeNames = new Set<string>()
  const toolByExposedName = new Map<string, BridgeTool>()
  let removedByPolicy: string[] = []

  const endpoint = runtime.endpoint ?? ENDPOINT
  const token = runtime.token ?? TOKEN
  const sessionId = runtime.sessionId ?? SESSION_ID

  const parsedMode = parseIdeCodingMode(process.env[IDE_MODE_ENV])
  ideMode = parsedMode.mode
  if (parsedMode.diagnostic !== undefined) policyDiagnostics.push(parsedMode.diagnostic)

  if (ideMode !== 'off') {
    pi.on('before_agent_start', ((event: { systemPrompt: string }) => {
      const guidance = renderIdeCodingGuidance(ideMode, ideState, capabilities, projectRoot)
      const diagnostics = policyDiagnostics.join('\n')
      const text = diagnostics === '' ? guidance : guidance === '' ? diagnostics : `${guidance}\n${diagnostics}`
      if (text === '') return undefined
      return { systemPrompt: `${event.systemPrompt}\n\n${text}` }
    }) as never)
    if (ideMode === 'required') setPolicyFiltering(true)
    if (!endpoint || !token || !sessionId) {
      if (ideMode === 'prefer') ideState = 'native_fallback'
      else ideState = 'required_unavailable'
      return
    }
    ideState = 'awaiting_catalog'
  } else if (!endpoint || !token || !sessionId) {
    return
  }

  const instanceScope = runtime.instanceScope ?? globalThis
  const owner = Symbol('acp-mcp-bridge-owner')
  if (!claimBridgeInstance(instanceScope, owner)) return

  let sock: Socket | undefined
  let buffer = ''
  let registered = false
  const pending = new Map<string, { resolve: (v: PiMcpToolResult) => void; reject: (e: Error) => void }>()

  function send(msg: IpcMessage): void {
    if (!sock || sock.destroyed) return
    try {
      sock.write(JSON.stringify(msg) + '\n')
    } catch {
      // Socket close handling surfaces pending failures.
    }
  }

  function registerTools(tools: BridgeTool[]): CatalogRegistration {
    const registration: CatalogRegistration = { catalogId: undefined, registered: [], failed: [] }
    const names = new Set<string>()
    for (const tool of tools) {
      try {
        if (names.has(tool.exposedName)) {
          registration.failed.push({
            exposedName: tool.exposedName,
            schemaHash: tool.schemaHash,
            message: 'duplicate exposed tool name'
          })
          continue
        }
        names.add(tool.exposedName)
        const conversionState = createConversionState()
        const schema = schemaToTypeBox(tool.inputSchema, conversionState)
        pi.registerTool({
          name: tool.exposedName,
          label: tool.exposedName.replaceAll('_', ' '),
          description: toolDescription(tool),
          parameters: schema as never,
          execute: (async (toolCallId: string, params: unknown, signal?: AbortSignal) =>
            runtimeExecute(tool, toolCallId, params, signal)) as never
        })
        registration.registered.push({ exposedName: tool.exposedName, schemaHash: tool.schemaHash })
        registeredIdeNames.add(tool.exposedName)
        toolByExposedName.set(tool.exposedName, tool)
        if (conversionState.warnings.length > 0) {
          registration.diagnostics = [
            ...(registration.diagnostics ?? []),
            `${tool.exposedName}: ${conversionState.warnings.join('; ')}`
          ]
        }
      } catch (error) {
        registration.failed.push({
          exposedName: tool.exposedName,
          schemaHash: tool.schemaHash,
          message: error instanceof Error ? error.message : String(error)
        })
      }
    }
    return registration
  }

  function handleMessage(msg: IpcMessage): void {
    if (msg.type === 'hello_ack' && !registered) {
      registered = true
      projectRoot = msg.catalog.projectPath || undefined
      const registration = registerTools(msg.catalog.tools)
      registration.catalogId = msg.catalog.catalogId
      applyIdePolicy(msg.catalog, registration)
      send({ type: 'catalog_registered', registration })
      send({
        type: 'health',
        health: {
          state: registration.failed.length === 0 ? 'registration_complete' : 'registration_partial',
          catalogId: msg.catalog.catalogId,
          diagnostics: [
            ...(registration.diagnostics ?? []),
            ...registration.failed.map(item => `${item.exposedName}: ${item.message}`)
          ]
        }
      })
      return
    }
    if (msg.type === 'result') {
      const call = pending.get(msg.id)
      if (call) {
        pending.delete(msg.id)
        call.resolve(msg.result as PiMcpToolResult)
      }
      return
    }
    if (msg.type === 'error') {
      const call = pending.get(msg.id)
      if (call) {
        pending.delete(msg.id)
        call.reject(new Error(msg.message))
      }
    }
  }

  function connect(): void {
    if (sock) return
    sock = (runtime.connect ?? createConnection)(endpoint!)
    sock.setEncoding('utf8')
    sock.on('connect', () => {
      send({ type: 'hello', version: BRIDGE_IPC_VERSION, token: token!, sessionId: sessionId! })
    })
    sock.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8')
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        if (!line) continue
        let msg: IpcMessage
        try {
          msg = JSON.parse(line) as IpcMessage
        } catch {
          continue
        }
        handleMessage(msg)
      }
    })
    sock.on('close', () => {
      sock = undefined
      registered = false
      const error = new Error('IDE bridge IPC disconnected; IDE tools unavailable')
      for (const [, call] of pending) call.reject(error)
      pending.clear()
      if (ideMode === 'prefer') transitionIdeState('native_fallback', 'IPC disconnected')
      else if (ideMode === 'required') transitionIdeState('required_unavailable', 'IPC disconnected')
    })
    sock.on('error', () => sock?.destroy())
  }

  function callRemoteTool(
    tool: BridgeTool,
    args: Record<string, unknown>,
    requestId: string,
    signal?: AbortSignal
  ): Promise<PiMcpToolResult> {
    if (!sock || sock.destroyed || !registered) {
      return Promise.reject(new Error('IDE bridge unavailable: IPC is disconnected'))
    }
    return new Promise<PiMcpToolResult>((resolve, reject) => {
      const onAbort = () => {
        if (!pending.delete(requestId)) return
        send({ type: 'cancel', id: requestId })
        failed(new Error('IDE tool call cancelled'))
      }
      const done = (value: unknown) => {
        try {
          let mapped = mcpResultToPiResult(value)
          if (ideMode !== 'off') {
            const rawStructured =
              value && typeof value === 'object' && !Array.isArray(value)
                ? (value as BridgeMcpResult).structuredContent
                : undefined
            mapped = filterIdeResult(tool, mapped, ideMode, projectRoot, rawStructured)
          }
          signal?.removeEventListener('abort', onAbort)
          resolve(mapped)
        } catch (error) {
          signal?.removeEventListener('abort', onAbort)
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      }
      const failed = (error: Error) => {
        signal?.removeEventListener('abort', onAbort)
        reject(error)
      }
      pending.set(requestId, { resolve: done, reject: failed })
      if (signal?.aborted) {
        pending.delete(requestId)
        failed(new Error('IDE tool call cancelled'))
        return
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      let ok = true
      try {
        if (!sock || sock.destroyed) ok = false
        else sock.write(JSON.stringify({ type: 'call', id: requestId, tool: tool.exposedName, args }) + '\n')
      } catch {
        ok = false
      }
      if (!ok) {
        pending.delete(requestId)
        signal?.removeEventListener('abort', onAbort)
        failed(new Error('IDE bridge unavailable: IPC is disconnected'))
      }
    })
  }

  function filterIdeResult(
    tool: BridgeTool,
    result: PiMcpToolResult,
    mode: IdeCodingMode,
    root: string | undefined,
    rawStructured?: unknown
  ): PiMcpToolResult {
    if (mode === 'off' || MUTATION_REMOTE_NAMES.has(tool.remoteName) || root === undefined) return result
    let hit = false
    const structured = rawStructured ?? result.details.structuredContent
    if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
      const candidates: string[] = []
      const budget = { nodes: 5000 }
      let truncated = false
      const collect = (value: unknown, depth: number): void => {
        if (depth > 16 || budget.nodes <= 0) {
          truncated = true
          return
        }
        budget.nodes--
        if (typeof value === 'string') {
          candidates.push(value)
          return
        }
        if (Array.isArray(value)) {
          for (const item of value) collect(item, depth + 1)
          return
        }
        if (value && typeof value === 'object') {
          for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
            if (RESULT_PATH_KEYS.has(key)) collect(child, depth + 1)
            else if (child && typeof child === 'object') collect(child, depth + 1)
          }
        }
      }
      collect(structured, 0)
      if (truncated) {
        if (mode === 'required') {
          throw new McpToolError('IDE tool result exceeded confinement depth; rejected as unscoped', {
            code: 'out_of_root_result'
          })
        }
        result.details.composite = {
          ...(result.details.composite as Record<string, unknown>),
          unconfinedResult: 'truncated'
        }
      }
      const rootResolved = resolve(root)
      const realRoot = tryRealpath(rootResolved)
      for (const entry of candidates) {
        if (entry === '') continue
        const candidate = isAbsolute(entry) ? resolve(entry) : resolve(rootResolved, entry)
        if (!isInside(rootResolved, candidate)) {
          hit = true
          break
        }
        if (realRoot !== undefined) {
          const existingAncestor = nearestExistingAncestor(candidate)
          if (existingAncestor !== undefined) {
            const real = tryRealpath(existingAncestor)
            if (real !== undefined && !isInside(realRoot, real)) {
              hit = true
              break
            }
          }
        }
      }
    }
    if (!hit) return result
    if (mode === 'required') {
      throw new McpToolError('IDE tool returned a path outside the project root', { code: 'out_of_root_result' })
    }
    result.details.composite = {
      ...(result.details.composite as Record<string, unknown>),
      outOfRootResult: 'path outside project root (annotated)'
    }
    return result
  }

  function setPolicyFiltering(enabled: boolean): void {
    if (ideMode === 'off') return
    const current = pi.getActiveTools()
    if (enabled) {
      const removed = current.filter(name => NATIVE_FILE_TOOLS.has(name))
      if (removed.length === 0) return
      removedByPolicy = [...new Set([...removedByPolicy, ...removed])]
      pi.setActiveTools(current.filter(name => !NATIVE_FILE_TOOLS.has(name)))
    } else {
      if (removedByPolicy.length === 0) return
      const known = new Set(pi.getAllTools().map(tool => tool.name))
      const restore = removedByPolicy.filter(name => known.has(name))
      if (restore.length === 0) return
      pi.setActiveTools([...current, ...restore])
      removedByPolicy = removedByPolicy.filter(name => !restore.includes(name))
    }
  }

  function activateIdeTools(enabled: boolean): void {
    if (ideMode === 'off' || registeredIdeNames.size === 0) return
    const current = pi.getActiveTools()
    if (enabled) {
      const missing = [...registeredIdeNames].filter(name => !current.includes(name))
      if (missing.length > 0) pi.setActiveTools([...current, ...missing])
    } else {
      const next = current.filter(name => !registeredIdeNames.has(name))
      if (next.length !== current.length) pi.setActiveTools(next)
    }
  }

  function transitionIdeState(next: IdeCodingState, reason: string): void {
    if (ideState === next) return
    const prev = ideState
    ideState = next
    policyDiagnostics.push(`IDE coding mode: ${prev} -> ${next} (${reason})`)
    switch (next) {
      case 'active':
        setPolicyFiltering(true)
        activateIdeTools(true)
        break
      case 'native_fallback':
        activateIdeTools(false)
        setPolicyFiltering(false)
        break
      case 'required_unavailable':
        activateIdeTools(false)
        break
      case 'shutdown':
        activateIdeTools(false)
        break
      default:
        break
    }
  }

  function applyIdePolicy(catalog: BridgeCatalog, registration: CatalogRegistration): void {
    if (ideMode === 'off') return
    if (catalog.projectPath === undefined || catalog.projectPath === '') {
      policyDiagnostics.push('missing project root; IntelliJ-first mode unavailable')
      const fallback = ideMode === 'prefer' ? 'native_fallback' : 'required_unavailable'
      transitionIdeState(fallback, 'missing project root')
      if (policyDiagnostics.length > 0) {
        registration.diagnostics = [...(registration.diagnostics ?? []), ...policyDiagnostics]
        policyDiagnostics.length = 0
      }
      return
    }
    const registeredNames = new Set(registration.registered.map(item => item.exposedName))
    const indexed = indexIdeCapabilities(catalog.tools, registeredNames)
    capabilities = indexed.capabilities
    for (const duplicate of indexed.duplicates)
      policyDiagnostics.push(`duplicate IDE capability mappings: ${duplicate}`)
    if (indexed.missing.length > 0) {
      policyDiagnostics.push(`missing required IDE capabilities: ${indexed.missing.join(', ')}`)
    }
    const availability = evaluateIdeAvailability(ideMode, indexed.capabilities)
    transitionIdeState(availability.state, 'capability evaluation')
    if (policyDiagnostics.length > 0) {
      registration.diagnostics = [...(registration.diagnostics ?? []), ...policyDiagnostics]
      policyDiagnostics.length = 0
    }
  }

  function openPathKey(tool: BridgeTool): string {
    const schema = tool.inputSchema as { properties?: Record<string, unknown> }
    const properties = schema.properties ?? {}
    for (const key of ['filePath', 'file_path', 'files', 'pathInProject', 'directoryPath']) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) return key
    }
    return 'filePath'
  }

  function executeMutationComposite(
    tool: BridgeTool,
    args: Record<string, unknown>,
    toolCallId: string,
    signal?: AbortSignal
  ): Promise<PiMcpToolResult> {
    if (projectRoot === undefined) {
      return Promise.reject(
        new McpToolError('IntelliJ-first mode requires a project root', { code: 'missing_project_root' })
      )
    }
    const openName = capabilities.get('open')
    const openTool = openName ? toolByExposedName.get(openName) : undefined
    if (!openTool) {
      return Promise.reject(
        new McpToolError('IntelliJ-first mode requires open_file_in_editor for mutations', {
          code: 'missing_open_capability'
        })
      )
    }
    const confined = confineToolArgs(tool, args)
    let plan: MutationPlan
    try {
      plan = buildMutationPlan(tool, confined, projectRoot)
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
    const openKey = openPathKey(openTool)
    return (async () => {
      for (let i = 0; i < plan.preOpen.length; i++) {
        await callRemoteTool(openTool, { [openKey]: plan.preOpen[i] }, `${toolCallId}:open:${i}`, signal)
      }
      const result = await callRemoteTool(tool, plan.mutationArgs, `${toolCallId}:mutate`, signal)
      for (let i = 0; i < plan.postOpen.length; i++) {
        try {
          await callRemoteTool(openTool, { [openKey]: plan.postOpen[i] }, `${toolCallId}:open-created:${i}`, signal)
        } catch (error) {
          result.details.composite = {
            ...(result.details.composite as Record<string, unknown>),
            mutationSucceeded: true,
            postOpenError: error instanceof Error ? error.message : String(error)
          }
        }
      }
      result.details.composite = {
        ...(result.details.composite as Record<string, unknown>),
        affectedPaths: [...plan.preOpen, ...plan.postOpen]
      }
      return result
    })()
  }

  function confineToolArgs(tool: BridgeTool, args: Record<string, unknown>): Record<string, unknown> {
    if (ideMode === 'off' || projectRoot === undefined) return args
    const root = projectRoot
    const schema = tool.inputSchema as { properties?: Record<string, unknown> }
    const properties = schema.properties ?? {}
    const next = { ...args }
    for (const key of Object.keys(properties)) {
      if (!PATH_KEYS.has(key)) continue
      const value = args[key]
      if (typeof value === 'string') {
        next[key] = normalizeProjectPath(root, value, true).path
      } else if (Array.isArray(value)) {
        next[key] = value.map(item => (typeof item === 'string' ? normalizeProjectPath(root, item, true).path : item))
      }
    }
    return next
  }

  function runtimeExecute(
    tool: BridgeTool,
    toolCallId: string,
    params: unknown,
    signal?: AbortSignal
  ): Promise<PiMcpToolResult> {
    const args = (params ?? {}) as Record<string, unknown>
    const prepared = prepareToolArguments(tool, args, projectRoot)
    if (ideMode === 'off') return callRemoteTool(tool, prepared, toolCallId, signal)
    if (MUTATION_REMOTE_NAMES.has(tool.remoteName)) return executeMutationComposite(tool, prepared, toolCallId, signal)
    return callRemoteTool(tool, confineToolArgs(tool, prepared), toolCallId, signal)
  }

  pi.on('session_shutdown', () => {
    transitionIdeState('shutdown', 'session shutdown')
    send({ type: 'shutdown', reason: 'session_shutdown' })
    sock?.destroy()
    sock = undefined
    releaseBridgeInstance(instanceScope, owner)
  })

  try {
    connect()
  } catch (error) {
    releaseBridgeInstance(instanceScope, owner)
    throw error
  }
}

// ---------- IntelliJ-first coding mode ----------

const IDE_MODE_ENV = 'PI_ACP_IDE_MODE'
const NATIVE_FILE_TOOLS = new Set(['read', 'edit', 'write', 'grep', 'find', 'ls'])

const REQUIRED_CAPABILITIES: Array<{ key: IdeCapabilityKey; remoteNames: string[] }> = [
  { key: 'read', remoteNames: ['read_file'] },
  { key: 'open', remoteNames: ['open_file_in_editor'] },
  { key: 'patch', remoteNames: ['apply_patch'] },
  { key: 'create', remoteNames: ['create_new_file'] },
  { key: 'search', remoteNames: ['skill_search', 'search_text'] },
  { key: 'inspect', remoteNames: ['lint_files', 'get_file_problems'] }
]
const OPTIONAL_CAPABILITIES: Array<{ key: IdeCapabilityKey; remoteNames: string[] }> = [
  { key: 'rename', remoteNames: ['rename_refactoring'] },
  { key: 'reformat', remoteNames: ['reformat_file'] }
]
const MUTATION_REMOTE_NAMES = new Set(['apply_patch', 'rename_refactoring', 'reformat_file', 'create_new_file'])
const PATH_KEYS = new Set([
  'filePath',
  'file_path',
  'pathInProject',
  'files',
  'paths',
  'sourcePath',
  'targetPath',
  'oldPath',
  'newPath',
  'directoryPath',
  'contextPath',
  'path',
  'file'
])
const RESULT_PATH_KEYS = new Set([
  'filePath',
  'file_path',
  'files',
  'paths',
  'path',
  'pathInProject',
  'directoryPath',
  'sourcePath',
  'targetPath',
  'oldPath',
  'newPath',
  'file'
])

export type IdeCodingMode = 'off' | 'prefer' | 'required'
export type IdeCodingState =
  'disabled' | 'awaiting_catalog' | 'active' | 'native_fallback' | 'required_unavailable' | 'shutdown'
export type IdeCapabilityKey = 'read' | 'open' | 'patch' | 'create' | 'search' | 'inspect' | 'rename' | 'reformat'
export type IdeCapabilityMap = Map<IdeCapabilityKey, string>

export type PatchTargetKind = 'add' | 'update' | 'delete' | 'move'

export interface PatchTarget {
  kind: PatchTargetKind
  source?: string
  destination: string
}

export interface MutationPlan {
  preOpen: string[]
  mutationArgs: Record<string, unknown>
  postOpen: string[]
}

export function parseIdeCodingMode(value: string | undefined): { mode: IdeCodingMode; diagnostic?: string } {
  if (value === undefined || value === '' || value === 'off') return { mode: 'off' }
  if (value === 'prefer') return { mode: 'prefer' }
  if (value === 'required') return { mode: 'required' }
  return { mode: 'required', diagnostic: `invalid PI_ACP_IDE_MODE value '${value}'; failing closed as required` }
}

export function indexIdeCapabilities(
  tools: BridgeTool[],
  registeredNames: ReadonlySet<string>
): { capabilities: IdeCapabilityMap; missing: IdeCapabilityKey[]; duplicates: string[] } {
  const capabilities: IdeCapabilityMap = new Map()
  const missing: IdeCapabilityKey[] = []
  const duplicates: string[] = []
  const allGroups = [...REQUIRED_CAPABILITIES, ...OPTIONAL_CAPABILITIES]
  for (const group of allGroups) {
    let chosen: string | undefined
    for (const remote of group.remoteNames) {
      const match = tools.find(tool => tool.remoteName === remote && registeredNames.has(tool.exposedName))
      if (match) {
        chosen = match.exposedName
        break
      }
    }
    if (chosen === undefined) {
      if (REQUIRED_CAPABILITIES.some(item => item.key === group.key)) missing.push(group.key)
      continue
    }
    capabilities.set(group.key, chosen)
  }
  for (const group of allGroups) {
    for (const remote of group.remoteNames) {
      const matches = tools.filter(tool => tool.remoteName === remote && registeredNames.has(tool.exposedName))
      if (matches.length > 1) duplicates.push(`${remote}: ${matches.map(match => match.exposedName).join(', ')}`)
    }
  }
  return { capabilities, missing, duplicates }
}

export function evaluateIdeAvailability(
  mode: IdeCodingMode,
  capabilities: IdeCapabilityMap
): { state: IdeCodingState; missing: IdeCapabilityKey[] } {
  const missing = REQUIRED_CAPABILITIES.filter(group => !capabilities.has(group.key)).map(group => group.key)
  if (missing.length === 0) return { state: 'active', missing }
  return mode === 'prefer' ? { state: 'native_fallback', missing } : { state: 'required_unavailable', missing }
}

function isInside(root: string, candidate: string): boolean {
  if (candidate === root) return true
  const rel = relative(root, candidate)
  if (rel === '' || isAbsolute(rel)) return false
  return rel !== '..' && !rel.startsWith('..' + sep)
}

function tryRealpath(path: string): string | undefined {
  try {
    return realpathSync(path)
  } catch {
    return undefined
  }
}

function nearestExistingAncestor(candidate: string): string | undefined {
  let current = candidate
  while (true) {
    if (existsSync(current)) return current
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
}

export function normalizeProjectPath(projectRoot: string, input: string, mutation: boolean): { path: string } {
  if (input === '') throw new Error('IDE path is empty')
  const root = resolve(projectRoot)
  let raw = input
  if (raw.startsWith('@')) raw = raw.slice(1)
  if (raw.includes('\0')) throw new Error(`IDE path contains NUL: ${input}`)
  const candidate = isAbsolute(raw) ? raw : resolve(root, raw)
  if (!isInside(root, candidate)) throw new Error(`IDE path escapes project root: ${input}`)
  if (mutation) {
    const realRoot = tryRealpath(root)
    if (realRoot !== undefined) {
      const existingAncestor = nearestExistingAncestor(candidate)
      if (existingAncestor !== undefined) {
        const real = tryRealpath(existingAncestor)
        if (real !== undefined && !isInside(realRoot, real)) {
          throw new Error(`IDE mutation path escapes project root through symlink: ${input}`)
        }
      }
    }
  }
  const rel = relative(root, candidate)
  return { path: rel.split(sep).join('/') }
}

export function parsePatchTargets(patch: string): PatchTarget[] {
  const targets: PatchTarget[] = []
  const seen = new Set<string>()
  const add = (kind: PatchTargetKind, destination: string, source?: string) => {
    if (destination === '' || destination === '/dev/null') return
    const key = `${kind}:${source ?? ''}:${destination}`
    if (seen.has(key)) return
    seen.add(key)
    targets.push({ kind, destination, source })
  }
  const stripPrefix = (value: string): string => {
    if (value.startsWith('a/')) return value.slice(2)
    if (value.startsWith('b/')) return value.slice(2)
    return value
  }
  const cleanHeaderPath = (value: string): string => {
    let p = value.trim()
    const tab = p.indexOf('\t')
    if (tab >= 0) p = p.slice(0, tab)
    if (p.startsWith('"') && p.endsWith('"')) {
      p = p.slice(1, -1)
      p = p.replace(/\\t/g, '\t').replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }
    return p.trim()
  }
  const lines = patch.split(/\r?\n/)
  if (lines[0]?.trim() === '*** Begin Patch') {
    let current: { kind: PatchTargetKind; destination: string; source?: string } | undefined
    for (const line of lines) {
      const trimmed = line.trim()
      if (!line.startsWith('*** ')) continue
      const update = /^\*\*\* Update File:\s*(.+)$/.exec(trimmed)
      const addFile = /^\*\*\* Add File:\s*(.+)$/.exec(trimmed)
      const del = /^\*\*\* Delete File:\s*(.+)$/.exec(trimmed)
      const move = /^\*\*\* Move to:\s*(.+)$/.exec(trimmed)
      if (update) {
        if (current) add(current.kind, current.destination, current.source)
        current = { kind: 'update', destination: update[1].trim() }
      } else if (addFile) {
        if (current) add(current.kind, current.destination, current.source)
        current = { kind: 'add', destination: addFile[1].trim() }
      } else if (del) {
        if (current) add(current.kind, current.destination, current.source)
        current = { kind: 'delete', destination: del[1].trim() }
      } else if (move) {
        if (!current) throw new Error('Codex patch Move to without a source section')
        current = { kind: 'move', destination: move[1].trim(), source: current.destination }
      }
    }
    if (current) add(current.kind, current.destination, current.source)
    return targets
  }
  let pendingOld: string | undefined
  let remainingOld = 0
  let remainingNew = 0
  for (const line of lines) {
    const trimmed = line.trim()
    const hunk = /^@@\s+-\d+(?:,(\d+))?\s+\+\d+(?:,(\d+))?/.exec(trimmed)
    if (hunk) {
      remainingOld = hunk[1] === undefined ? 1 : Number(hunk[1])
      remainingNew = hunk[2] === undefined ? 1 : Number(hunk[2])
      continue
    }
    if (remainingOld > 0 || remainingNew > 0) {
      if (line.startsWith(' ')) {
        if (remainingOld > 0) remainingOld--
        if (remainingNew > 0) remainingNew--
        continue
      }
      if (line.startsWith('-')) {
        if (remainingOld > 0) remainingOld--
        continue
      }
      if (line.startsWith('+')) {
        if (remainingNew > 0) remainingNew--
        continue
      }
      remainingOld = 0
      remainingNew = 0
      continue
    }
    const oldHeader = /^---\s+(.+)$/.exec(trimmed)
    const newHeader = /^\+\+\+\s+(.+)$/.exec(trimmed)
    if (oldHeader) {
      pendingOld = oldHeader[1].trim()
      continue
    }
    if (newHeader && pendingOld !== undefined) {
      const oldPath = stripPrefix(cleanHeaderPath(pendingOld))
      const newPath = stripPrefix(cleanHeaderPath(newHeader[1].trim()))
      if (oldPath === '/dev/null' && newPath !== '/dev/null') add('add', newPath)
      else if (newPath === '/dev/null' && oldPath !== '/dev/null') add('delete', oldPath)
      else if (oldPath !== '/dev/null' && newPath !== '/dev/null') {
        if (oldPath === newPath) add('update', newPath)
        else add('move', newPath, oldPath)
      }
      pendingOld = undefined
    }
  }
  return targets
}

function patchTextFromArgs(tool: BridgeTool, args: Record<string, unknown>): string | undefined {
  const schema = tool.inputSchema as { properties?: Record<string, unknown> }
  const properties = schema.properties ?? {}
  for (const key of Object.keys(properties)) {
    if (!/patch|diff|input|text/i.test(key)) continue
    const value = args[key]
    if (typeof value === 'string') return value
  }
  return undefined
}

function firstPathArg(tool: BridgeTool, args: Record<string, unknown>): string | undefined {
  const schema = tool.inputSchema as { properties?: Record<string, unknown> }
  const properties = schema.properties ?? {}
  for (const key of Object.keys(properties)) {
    if (!PATH_KEYS.has(key)) continue
    const value = args[key]
    if (typeof value === 'string') return value
    if (Array.isArray(value)) {
      const first = value.find(item => typeof item === 'string')
      if (first !== undefined) return first as string
    }
  }
  return undefined
}

function pathArgValues(tool: BridgeTool, args: Record<string, unknown>): string[] {
  const schema = tool.inputSchema as { properties?: Record<string, unknown> }
  const properties = schema.properties ?? {}
  const values: string[] = []
  for (const key of Object.keys(properties)) {
    if (!PATH_KEYS.has(key)) continue
    const value = args[key]
    if (typeof value === 'string') values.push(value)
    else if (Array.isArray(value)) for (const item of value) if (typeof item === 'string') values.push(item)
  }
  return values
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)]
}

export function buildMutationPlan(tool: BridgeTool, args: Record<string, unknown>, projectRoot: string): MutationPlan {
  const preOpen: string[] = []
  const postOpen: string[] = []
  switch (tool.remoteName) {
    case 'apply_patch': {
      const patch = patchTextFromArgs(tool, args)
      if (patch === undefined) throw new Error('apply_patch requires patch text')
      const targets = parsePatchTargets(patch)
      if (targets.length === 0) throw new Error('apply_patch patch contains no affected files')
      for (const target of targets) {
        if (target.kind === 'move' && target.source) {
          preOpen.push(normalizeProjectPath(projectRoot, target.source, true).path)
          const dest = normalizeProjectPath(projectRoot, target.destination, true).path
          postOpen.push(dest)
          continue
        }
        if (target.kind === 'add') {
          postOpen.push(normalizeProjectPath(projectRoot, target.destination, true).path)
          continue
        }
        preOpen.push(normalizeProjectPath(projectRoot, target.destination, true).path)
      }
      break
    }
    case 'rename_refactoring': {
      const source = firstPathArg(tool, args)
      if (source === undefined) throw new Error('rename_refactoring requires a recognized path argument')
      preOpen.push(normalizeProjectPath(projectRoot, source, true).path)
      break
    }
    case 'reformat_file': {
      const values = pathArgValues(tool, args)
      if (values.length === 0) throw new Error('reformat_file requires recognized file arguments')
      for (const value of values) preOpen.push(normalizeProjectPath(projectRoot, value, true).path)
      break
    }
    case 'create_new_file': {
      const target = firstPathArg(tool, args)
      if (target === undefined) throw new Error('create_new_file requires a recognized path argument')
      postOpen.push(normalizeProjectPath(projectRoot, target, true).path)
      break
    }
    default:
      break
  }
  return { preOpen: dedupe(preOpen), mutationArgs: args, postOpen: dedupe(postOpen) }
}

export function renderIdeCodingGuidance(
  mode: IdeCodingMode,

[64 more lines in file. Use offset=1301 to continue.]  state: IdeCodingState,
  capabilities: IdeCapabilityMap,
  projectRoot: string | undefined
): string {
  if (mode === 'off' || state === 'disabled' || state === 'shutdown') return ''
  const name = (key: IdeCapabilityKey): string | undefined => capabilities.get(key)
  const parts: string[] = []
  const header = `[pi-acp IntelliJ-first mode: ${state}]`
  switch (state) {
    case 'active': {
      parts.push('IntelliJ-first mode is active.')
      parts.push('Pi generates the code; IntelliJ applies and validates it.')
      parts.push('Native file tools (read, edit, write, grep, find, ls) are unavailable.')
      const lines: string[] = []
      const read = name('read')
      const open = name('open')
      const search = name('search')
      const patch = name('patch')
      const create = name('create')
      const inspect = name('inspect')
      const rename = name('rename')
      const reformat = name('reformat')
      if (read) lines.push(`read files with ${read}`)
      if (open) lines.push(`open files in the IDE with ${open}`)
      if (search) lines.push(`search the project with ${search}`)
      if (patch) lines.push(`apply patches with ${patch}`)
      if (create) lines.push(`create files with ${create}`)
      if (inspect) lines.push(`run IDE diagnostics with ${inspect}`)
      if (rename) lines.push(`use semantic rename via ${rename} instead of textual edits`)
      if (reformat) lines.push(`reformat via ${reformat}`)
      if (lines.length > 0) parts.push(`Use the registered IDE tools: ${lines.join('; ')}.`)
      parts.push('Mutations automatically open affected files in the IDE.')
      if (projectRoot) parts.push(`Paths are relative to the project root: ${projectRoot}`)
      parts.push('Use bash for Git, tests, builds, and diagnostics. Do not use bash to modify source files.')
      break
    }
    case 'awaiting_catalog': {
      if (mode === 'required')
        parts.push('IntelliJ-first mode is required and waiting for the IDE catalog. Native file tools stay disabled.')
      else
        parts.push(
          'IntelliJ-first mode is preferred but the IDE catalog is not ready yet. Native file tools remain available temporarily.'
        )
      break
    }
    case 'native_fallback': {
      parts.push(
        'IDE IPC is unavailable or incomplete. IDE tools were removed from the active set; only native tools removed by this policy were restored.'
      )
      parts.push('Do not call stale IDE tool names.')
      break
    }
    case 'required_unavailable': {
      parts.push(
        'Required IntelliJ capabilities are unavailable. Native filesystem tools remain disabled. The task is blocked until a new healthy ACP/IDE session is started.'
      )
      break
    }
    default:
      return ''
  }
  return `${header}\n${parts.join('\n')}`
}
