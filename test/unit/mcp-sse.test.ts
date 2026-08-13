import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { SseMcpClient, SseMcpError } from '../../src/acp/mcp-sse.js'
import { createFakeSseServer } from './helpers/fake-sse-server.js'

describe('SseMcpClient', () => {
  it('connects, initializes, lists tools, and routes calls over the SSE stream', async () => {
    const fake = await createFakeSseServer()
    try {
      const client = await SseMcpClient.start(fake.port)
      try {
        const init = (await client.request('initialize', { protocolVersion: '2025-03-26' }, 5_000)) as any
        assert.equal(init.protocolVersion, '2025-03-26')

        const list = (await client.request('tools/list', {}, 5_000)) as any
        assert.equal(list.tools.length, 1)
        assert.equal(list.tools[0].name, 'open_file_in_editor')

        const call = (await client.request('tools/call', { name: 'open_file_in_editor', arguments: {} }, 5_000)) as any
        assert.equal(call.content[0].text, 'sse-ok')
      } finally {
        await client.close()
      }
    } finally {
      await fake.close()
    }
  })

  it('accepts responses delivered in the POST body', async () => {
    const fake = await createFakeSseServer({ respondInPostBody: true })
    try {
      const client = await SseMcpClient.start(fake.port)
      try {
        const init = (await client.request('initialize', {}, 5_000)) as any
        assert.equal(init.protocolVersion, '2025-03-26')
      } finally {
        await client.close()
      }
    } finally {
      await fake.close()
    }
  })

  it('delivers server notifications to the handler', async () => {
    const fake = await createFakeSseServer()
    const notifications: string[] = []
    try {
      const client = await SseMcpClient.start(fake.port, {
        onNotification: message => notifications.push(message.method)
      })
      try {
        await client.notify('notifications/initialized', {})
        assert.ok(fake.requests.some(request => (request.body as any)?.method === 'notifications/initialized'))
        assert.deepEqual(notifications, [])
      } finally {
        await client.close()
      }
    } finally {
      await fake.close()
    }
  })

  it('times out requests the server never answers', async () => {
    const fake = await createFakeSseServer({ neverRespondCalls: true })
    try {
      const client = await SseMcpClient.start(fake.port)
      try {
        await assert.rejects(() => client.request('tools/call', {}, 200), /timed out after 200ms/)
      } finally {
        await client.close()
      }
    } finally {
      await fake.close()
    }
  })

  it('closes idempotently and aborts the SSE stream', async () => {
    const fake = await createFakeSseServer()
    try {
      const client = await SseMcpClient.start(fake.port)
      await client.close()
      await client.close()
      await assert.rejects(() => client.request('tools/list', {}, 1_000), /closed/)
    } finally {
      await fake.close()
    }
  })

  it('parses CRLF-framed SSE streams (IntelliJ sends CRLF)', async () => {
    const fake = await createFakeSseServer({ crlf: true })
    try {
      const client = await SseMcpClient.start(fake.port)
      try {
        const list = (await client.request('tools/list', {}, 5_000)) as any
        assert.equal(list.tools[0].name, 'open_file_in_editor')
      } finally {
        await client.close()
      }
    } finally {
      await fake.close()
    }
  })

  it('rejects pending requests when the SSE stream ends unexpectedly', async () => {
    const fake = await createFakeSseServer({ neverRespondCalls: true })
    try {
      const client = await SseMcpClient.start(fake.port)
      const pending = client.request('tools/call', {}, 30_000)
      // Force the stream to end from the server side while a request is pending.
      for (const connection of fake.sseConnections) connection.end()
      await assert.rejects(pending, /stream ended unexpectedly/)
      await client.close()
    } finally {
      await fake.close()
    }
  })

  it('fails with a connect error when the endpoint is unreachable', async () => {
    await assert.rejects(
      () => SseMcpClient.start(1),
      (error: unknown) => error instanceof SseMcpError && error.phase === 'connect'
    )
  })

  it('sends the IDE auth token headers on the SSE connect and message POSTs', async () => {
    const fake = await createFakeSseServer({ authToken: 'chat-token' })
    try {
      const client = await SseMcpClient.start(fake.port, { authToken: 'chat-token' })
      try {
        const list = (await client.request('tools/list', {}, 5_000)) as any
        assert.equal(list.tools.length, 1)
        assert.ok(fake.requests.length >= 2)
        for (const request of fake.requests) {
          assert.equal(request.headers['ij_mcp_auth_token'], 'chat-token')
          assert.equal(request.headers.authorization, 'Bearer chat-token')
        }
      } finally {
        await client.close()
      }
    } finally {
      await fake.close()
    }
  })

  it('fails the connect phase with HTTP 401 when the IDE rejects the token', async () => {
    const fake = await createFakeSseServer({ authToken: 'expected-token' })
    try {
      await assert.rejects(
        () => SseMcpClient.start(fake.port, { authToken: 'wrong-token' }),
        (error: unknown) => error instanceof SseMcpError && error.phase === 'connect' && /HTTP 401/.test(error.message)
      )
    } finally {
      await fake.close()
    }
  })
})
