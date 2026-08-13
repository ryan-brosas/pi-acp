/**
 * Bundled pi extension for the ACP MCP bridge (pi-acp).
 *
 * The extension receives an immutable, session-scoped catalog over authenticated
 * IPC, registers each remote tool independently, acknowledges registration, and
 * forwards calls/results without hiding MCP errors as successful text.
 */
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { Type, type TSchema } from 'typebox'
import { createConnection, type Socket } from 'node:net'
import {
  BRIDGE_IPC_VERSION,
  type BridgeIpcMessage,
  type BridgeMcpResult,
  type BridgeTool,
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

export function schemaToTypeBox(
  schema: JsonSchema,
  state: ConversionState = createConversionState()
): TSchema {
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

export default function acpMcpBridgeExtension(pi: ExtensionAPI): void {
  if (!ENDPOINT || !TOKEN || !SESSION_ID) return

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
        if (names.has(tool.exposedName)) throw new Error('duplicate exposed tool name')
        names.add(tool.exposedName)
        const conversionState = createConversionState()
        const schema = schemaToTypeBox(tool.inputSchema, conversionState)
        pi.registerTool({
          name: tool.exposedName,
          label: tool.exposedName.replaceAll('_', ' '),
          description: tool.description ?? `IDE tool ${tool.remoteName} (via ${tool.connectionId})`,
          parameters: schema as never,
          execute: (async (toolCallId: string, params: unknown, signal?: AbortSignal) => {
            const id = toolCallId
            return new Promise<PiMcpToolResult>((resolve, reject) => {
              const onAbort = () => {
                if (!pending.delete(id)) return
                send({ type: 'cancel', id })
                failed(new Error('IDE tool call cancelled'))
              }
              const done = (value: unknown) => {
                try {
                  const mapped = mcpResultToPiResult(value)
                  signal?.removeEventListener('abort', onAbort)
                  resolve(mapped)
                } catch (error) {
                  failed(error instanceof Error ? error : new Error(String(error)))
                }
              }
              const failed = (error: Error) => {
                signal?.removeEventListener('abort', onAbort)
                reject(error)
              }
              pending.set(id, { resolve: done, reject: failed })
              if (signal?.aborted) {
                pending.delete(id)
                failed(new Error('IDE tool call cancelled'))
                return
              }
              signal?.addEventListener('abort', onAbort, { once: true })
              send({ type: 'call', id, tool: tool.exposedName, args: (params ?? {}) as Record<string, unknown> })
            })
          }) as never
        })
        registration.registered.push({ exposedName: tool.exposedName, schemaHash: tool.schemaHash })
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
      const registration = registerTools(msg.catalog.tools)
      registration.catalogId = msg.catalog.catalogId
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
    sock = createConnection(ENDPOINT!)
    sock.setEncoding('utf8')
    sock.on('connect', () => {
      send({ type: 'hello', version: BRIDGE_IPC_VERSION, token: TOKEN!, sessionId: SESSION_ID! })
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
    })
    sock.on('error', () => sock?.destroy())
  }

  connect()

  pi.on('session_shutdown', () => {
    send({ type: 'shutdown', reason: 'session_shutdown' })
    sock?.destroy()
    sock = undefined
  })
}
