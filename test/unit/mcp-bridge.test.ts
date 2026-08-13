import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AcpMcpBridge } from "../../src/acp/mcp-bridge.js";
import { McpIpcServer } from "../../src/acp/mcp-ipc.js";
import { BRIDGE_IPC_VERSION } from "../../src/acp/mcp-types.js";
import { createConnection } from "node:net";

/** Records extMethod traffic and answers with canned MCP responses. */
class FakeConn {
  calls: Array<{ method: string; params: any }> = [];
  failConnect = false;
  tools = [{ name: "open_file_in_editor", description: "Open a file", inputSchema: { type: "object", properties: { path: { type: "string" } } } }];

  async extMethod(method: string, params: any): Promise<any> {
    this.calls.push({ method, params });
    if (method === "mcp/connect") {
      if (this.failConnect) throw new Error("mcp/connect failed");
      return { connectionId: `conn-${params.acpId}` };
    }
    if (method === "mcp/message") {
      if (params.method === "tools/list") return { tools: this.tools };
      if (params.method === "tools/call") return { content: [{ type: "text", text: "opened" }] };
      if (params.method === "initialize") return { protocolVersion: "2025-03-26" };
      return {};
    }
    if (method === "mcp/disconnect") return {};
    throw new Error(`unexpected extMethod: ${method}`);
  }
}

function acpServer(id: string, name: string): any {
  return { type: "acp", id, name };
}

describe("AcpMcpBridge", () => {
  it("connects ACP servers, initializes MCP, discovers tools, and returns spawn settings", async () => {
    const conn = new FakeConn();
    const bridge = new AcpMcpBridge(conn as any, [acpServer("srv-1", "IntelliJ")], "session-1");
    const settings = await bridge.start();

    assert.equal(bridge.hasServers, true);
    const methods = conn.calls.map(c => c.method);
    assert.ok(methods.includes("mcp/connect"));
    assert.equal(conn.calls.find(c => c.method === "mcp/message")?.params.method, "initialize");
    assert.ok(conn.calls.some(c => c.method === "mcp/message" && c.params.method === "tools/list"));
    assert.equal(settings.extensionPaths.length, 1);
    assert.ok(settings.env.PI_ACP_MCP_IPC_ENDPOINT);
    assert.ok(settings.env.PI_ACP_MCP_IPC_TOKEN);
    assert.equal(settings.env.PI_ACP_MCP_SESSION_ID, "session-1");

    const tools = bridge.tools;
    assert.equal(tools.length, 1);
    assert.equal(tools[0].exposedName, "ide_intellij_open_file_in_editor");
    assert.equal(tools[0].remoteName, "open_file_in_editor");
    await bridge.dispose();
  });

  it("omits failed servers but keeps successful ones", async () => {
    const conn = new FakeConn();
    conn.failConnect = true;
    const bridge = new AcpMcpBridge(conn as any, [acpServer("bad", "Broken"), acpServer("good", "IntelliJ")], "s");
    // First server fails; second succeeds. failConnect is global, so make it selective:
    const original = conn.extMethod.bind(conn);
    conn.failConnect = false;
    let first = true;
    conn.extMethod = async (method: string, params: any) => {
      if (method === "mcp/connect" && first) {
        first = false;
        throw new Error("mcp/connect failed");
      }
      return original(method, params);
    };
    const settings = await bridge.start();
    assert.equal(bridge.tools.length, 1);
    assert.equal(bridge.diagnostics.length, 1);
    assert.ok(bridge.diagnostics[0].includes("Broken"));
    assert.equal(settings.extensionPaths.length, 1);
    await bridge.dispose();
  });

  it("disposes idempotently and disconnects each server exactly once", async () => {
    const conn = new FakeConn();
    const bridge = new AcpMcpBridge(conn as any, [acpServer("a", "A"), acpServer("b", "B")], "s");
    await bridge.start();
    await bridge.dispose();
    await bridge.dispose();
    const disconnects = conn.calls.filter(c => c.method === "mcp/disconnect");
    assert.equal(disconnects.length, 2);
  });

  it("does not hang on a silent client: discovery times out and reports diagnostics", async () => {
    const conn = new FakeConn();
    conn.extMethod = async () => new Promise(() => {}); // never resolves
    const bridge = new AcpMcpBridge(conn as any, [acpServer("quiet", "Quiet")], "s", 200);
    const t0 = Date.now();
    const settings = await bridge.start();
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 5000, `start() took ${elapsed}ms — should have timed out`);
    assert.equal(bridge.tools.length, 0);
    assert.ok(bridge.diagnostics.length > 0);
    assert.ok(bridge.diagnostics[0].includes("Quiet"));
    await bridge.dispose();
  });

  it("returns empty spawn settings when no ACP servers are provided", async () => {
    const conn = new FakeConn();
    const bridge = new AcpMcpBridge(conn as any, [], "s");
    const settings = await bridge.start();
    assert.deepEqual(settings.extensionPaths, []);
    assert.equal(bridge.hasServers, false);
  });
});

describe("McpIpcServer handshake", () => {
  it("authenticates with correct token and delivers the catalog", async () => {
    const server = await McpIpcServer.start("ipc-test");
    const ep = server.endpoint();
    server.setCatalog({ tools: [{ exposedName: "ide_x_y", connectionId: "c", remoteName: "y", inputSchema: {} }] });
    const handshake = server.waitForHandshake();

    const sock = createConnection(ep.endpoint);
    const received: any[] = [];
    sock.setEncoding("utf8");
    let buf = "";
    sock.on("data", (d: Buffer) => {
      buf += d.toString();
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        received.push(JSON.parse(buf.slice(0, i)));
        buf = buf.slice(i + 1);
      }
    });
    await new Promise<void>(resolve => sock.on("connect", () => resolve()));
    sock.write(JSON.stringify({ type: "hello", version: BRIDGE_IPC_VERSION, token: ep.token, sessionId: ep.sessionId }) + "\n");
    const catalog = await handshake;
    await new Promise<void>(resolve => setTimeout(resolve, 100));
    assert.equal(catalog.tools.length, 1);
    assert.ok(received.some((m: any) => m.type === "hello_ack"));
    sock.destroy();
    server.close();
  });

  it("rejects wrong tokens", async () => {
    const server = await McpIpcServer.start("ipc-test2");
    const ep = server.endpoint();
    const sock = createConnection(ep.endpoint);
    const received: any[] = [];
    sock.setEncoding("utf8");
    let buf = "";
    sock.on("data", (d: Buffer) => {
      buf += d.toString();
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        received.push(JSON.parse(buf.slice(0, i)));
        buf = buf.slice(i + 1);
      }
    });
    await new Promise<void>(resolve => sock.on("connect", () => resolve()));
    sock.write(JSON.stringify({ type: "hello", version: BRIDGE_IPC_VERSION, token: "wrong", sessionId: ep.sessionId }) + "\n");
    await new Promise<void>(resolve => setTimeout(resolve, 100));
    assert.ok(received.some((m: any) => m.type === "error" && m.code === "unauthorized"));
    sock.destroy();
    server.close();
  });

  it("rejects messages before authentication", async () => {
    const server = await McpIpcServer.start("ipc-test3");
    const ep = server.endpoint();
    const sock = createConnection(ep.endpoint);
    const received: any[] = [];
    sock.setEncoding("utf8");
    let buf = "";
    sock.on("data", (d: Buffer) => {
      buf += d.toString();
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        received.push(JSON.parse(buf.slice(0, i)));
        buf = buf.slice(i + 1);
      }
    });
    await new Promise<void>(resolve => sock.on("connect", () => resolve()));
    sock.write(JSON.stringify({ type: "call", id: "1", tool: "ide_x", args: {} }) + "\n");
    await new Promise<void>(resolve => setTimeout(resolve, 100));
    assert.ok(received.some((m: any) => m.type === "error" && m.code === "unauthorized"));
    sock.destroy();
    server.close();
  });
});
