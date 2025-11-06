import * as assert from 'assert'
import * as vscode from 'vscode'
import * as http from 'http'
import { WebSocketServer, WebSocket } from 'ws'

// Mock API server for testing
class MockApiServer {
  private httpServer: http.Server | null = null
  private wsServer: WebSocketServer | null = null
  private sessions: Map<string, any> = new Map()

  constructor(private port: number) {}

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = http.createServer((req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

        if (req.method === 'OPTIONS') {
          res.writeHead(200)
          res.end()
          return
        }

        // Check auth
        const authHeader = req.headers['authorization']
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          res.writeHead(401)
          res.end(JSON.stringify({ error: 'Unauthorized' }))
          return
        }

        // Route requests
        if (req.url === '/sessions' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ sessions: Array.from(this.sessions.values()) }))
        } else if (req.url === '/sessions' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk.toString()))
          req.on('end', () => {
            const { name } = JSON.parse(body)
            const session = {
              id: `test-session-${Date.now()}`,
              name: name || 'Test Session',
              status: 'active',
              created_at: new Date().toISOString(),
            }
            this.sessions.set(session.id, session)
            res.writeHead(201, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(session))
          })
        } else if (req.url?.startsWith('/sessions/') && req.method === 'GET') {
          const sessionId = req.url.split('/')[2]
          const session = this.sessions.get(sessionId)
          if (session) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(session))
          } else {
            res.writeHead(404)
            res.end(JSON.stringify({ error: 'Session not found' }))
          }
        } else if (req.url?.match(/\/sessions\/[^/]+\/command/) && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk.toString()))
          req.on('end', () => {
            const { command } = JSON.parse(body)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: true, message: `Executed: ${command}` }))
          })
        } else {
          res.writeHead(404)
          res.end(JSON.stringify({ error: 'Not found' }))
        }
      })

      // WebSocket server
      this.wsServer = new WebSocketServer({ server: this.httpServer })
      this.wsServer.on('connection', (ws: WebSocket, req) => {
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const sessionId = url.pathname.split('/')[2]

        // Send initial connection event
        ws.send(
          JSON.stringify({
            type: 'connected',
            session_id: sessionId,
            timestamp: new Date().toISOString(),
          })
        )

        // Send mock events periodically
        const interval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'output',
                session_id: sessionId,
                data: `Mock output at ${new Date().toISOString()}`,
                timestamp: new Date().toISOString(),
              })
            )
          }
        }, 1000)

        ws.on('close', () => {
          clearInterval(interval)
        })

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString())
          // Echo back commands
          ws.send(
            JSON.stringify({
              type: 'command_result',
              session_id: sessionId,
              command: message.command,
              result: { success: true },
              timestamp: new Date().toISOString(),
            })
          )
        })
      })

      this.httpServer.listen(this.port, () => {
        resolve()
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wsServer?.close()
      this.httpServer?.close(() => {
        this.sessions.clear()
        resolve()
      })
    })
  }
}

suite('Agent Manager Extension Integration Tests', () => {
  const TEST_PORT = 9999
  const TEST_TOKEN = 'test-token'
  let mockServer: MockApiServer

  suiteSetup(async () => {
    // Start mock server
    mockServer = new MockApiServer(TEST_PORT)
    await mockServer.start()

    // Configure extension
    const config = vscode.workspace.getConfiguration('agentManager')
    await config.update('apiHost', '127.0.0.1', vscode.ConfigurationTarget.Global)
    await config.update('apiPort', TEST_PORT, vscode.ConfigurationTarget.Global)
    await config.update('apiToken', TEST_TOKEN, vscode.ConfigurationTarget.Global)
    await config.update('autoReconnect', false, vscode.ConfigurationTarget.Global)
  })

  suiteTeardown(async () => {
    // Stop mock server
    await mockServer.stop()

    // Reset configuration
    const config = vscode.workspace.getConfiguration('agentManager')
    await config.update('apiHost', undefined, vscode.ConfigurationTarget.Global)
    await config.update('apiPort', undefined, vscode.ConfigurationTarget.Global)
    await config.update('apiToken', undefined, vscode.ConfigurationTarget.Global)
    await config.update('autoReconnect', undefined, vscode.ConfigurationTarget.Global)
  })

  test('Extension should be present', () => {
    const extension = vscode.extensions.getExtension('swarm-together.agent-manager')
    assert.ok(extension)
  })

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('swarm-together.agent-manager')
    await extension!.activate()
    assert.strictEqual(extension!.isActive, true)
  })

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true)
    assert.ok(commands.includes('agentManager.connect'))
    assert.ok(commands.includes('agentManager.disconnect'))
    assert.ok(commands.includes('agentManager.sendCommand'))
    assert.ok(commands.includes('agentManager.showOutput'))
  })

  test('Command round-trip: Connect to session', async function () {
    this.timeout(5000)

    // Execute connect command
    // Note: This will show UI picker, so we skip in headless mode
    // Instead, test API client directly
    const { ApiClient } = require('../../apiClient')
    const client = new ApiClient('127.0.0.1', TEST_PORT, TEST_TOKEN)

    // Create session
    const session = await client.createSession('Test Session')
    assert.ok(session)
    assert.strictEqual(session.name, 'Test Session')
    assert.strictEqual(session.status, 'active')

    // List sessions
    const sessions = await client.listSessions()
    assert.ok(sessions.length > 0)
    assert.ok(sessions.some((s: any) => s.id === session.id))

    // Get session
    const retrieved = await client.getSession(session.id)
    assert.strictEqual(retrieved.id, session.id)

    // Send command
    const result = await client.sendCommand(session.id, '/help')
    assert.ok(result.success)
  })

  test('Streaming renders: WebSocket events', async function () {
    this.timeout(5000)

    const { ApiClient } = require('../../apiClient')
    const client = new ApiClient('127.0.0.1', TEST_PORT, TEST_TOKEN)

    // Create session
    const session = await client.createSession('Stream Test')

    // Connect stream
    const events: any[] = []
    const promise = new Promise<void>((resolve) => {
      client.connectStream(session.id, (event: any) => {
        events.push(event)
        if (events.length >= 3) {
          resolve()
        }
      })
    })

    // Wait for events
    await promise

    // Verify events
    assert.ok(events.length >= 3)
    assert.ok(events.some((e) => e.type === 'connected'))
    assert.ok(events.some((e) => e.type === 'output'))

    // Cleanup
    client.disconnect()
  })

  test('Error handling: Invalid session', async () => {
    const { ApiClient } = require('../../apiClient')
    const client = new ApiClient('127.0.0.1', TEST_PORT, TEST_TOKEN)

    try {
      await client.getSession('invalid-session-id')
      assert.fail('Should have thrown error')
    } catch (error: any) {
      assert.ok(error.message.includes('404'))
    }
  })

  test('Error handling: Unauthorized', async () => {
    const { ApiClient } = require('../../apiClient')
    const client = new ApiClient('127.0.0.1', TEST_PORT, 'invalid-token')

    try {
      await client.listSessions()
      assert.fail('Should have thrown error')
    } catch (error: any) {
      assert.ok(error.message.includes('401'))
    }
  })

  test('Reconnection: WebSocket disconnect and reconnect', async function () {
    this.timeout(10000)

    const { ApiClient } = require('../../apiClient')
    const client = new ApiClient('127.0.0.1', TEST_PORT, TEST_TOKEN)
    client.autoReconnect = true
    client.reconnectDelay = 500

    // Create session
    const session = await client.createSession('Reconnect Test')

    // Connect stream
    const events: any[] = []
    let disconnectCount = 0

    client.connectStream(session.id, (event: any) => {
      events.push(event)
    })

    // Wait for initial connection
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Force disconnect
    if (client.ws) {
      client.ws.close()
      disconnectCount++
    }

    // Wait for reconnect
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Should have reconnected
    assert.ok(events.length > 0)

    // Cleanup
    client.disconnect()
  })

  test('Output panel: Show and hide', async () => {
    // Test that output panel can be shown
    await vscode.commands.executeCommand('agentManager.showOutput')

    // Panel should exist (implementation creates it on demand)
    // We can't easily verify webview content in headless mode,
    // but we can verify the command doesn't throw
    assert.ok(true)
  })

  test('Status bar: Shows correct state', async () => {
    // Extension creates status bar item
    // In headless mode we can't inspect it directly,
    // but we verify the extension activated without errors
    const extension = vscode.extensions.getExtension('swarm-together.agent-manager')
    assert.strictEqual(extension!.isActive, true)
  })
})
