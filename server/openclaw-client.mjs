/**
 * OpenClaw Gateway client — find and list agents from OpenClaw (openclaw/openclaw).
 * Connects via WebSocket to Gateway (default ws://127.0.0.1:18789), handshakes as operator,
 * calls sessions.list to get live sessions/agents for HumanityBOTS fleet.
 * @see https://github.com/openclaw/openclaw
 * @see https://docs.openclaw.ai/gateway/protocol
 */

import WebSocket from 'ws'
import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

const DEFAULT_WS = 'ws://127.0.0.1:18789'
const PROTOCOL_VERSION = 3

/**
 * Load OpenClaw agent IDs from ~/.openclaw/agents directory (no Gateway required).
 */
export function discoverOpenClawAgentIds() {
  const agentsDir = join(homedir(), '.openclaw', 'agents')
  if (!existsSync(agentsDir)) return []
  try {
    return readdirSync(agentsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
  } catch {
    return []
  }
}

/**
 * Connect to Gateway, handshake, call sessions.list (or config), return agent/session list.
 * Auth: set OPENCLAW_GATEWAY_TOKEN to match gateway token for non-local.
 */
export class OpenClawGatewayClient {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || process.env.OPENCLAW_GATEWAY_WS || DEFAULT_WS
    this.token = options.token || process.env.OPENCLAW_GATEWAY_TOKEN
    this.onAgents = options.onAgents || (() => {})
    this.onStatus = options.onStatus || (() => {})
    this.ws = null
    this.connected = false
    this.reqId = 0
    this.pending = new Map()
    this.pollIntervalMs = options.pollIntervalMs || 20000
    this.pollTimer = null
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return
    this.onStatus({ connected: false, error: null })
    try {
      this.ws = new WebSocket(this.wsUrl)
    } catch (e) {
      this.onStatus({ connected: false, error: e.message })
      this.scheduleReconnect()
      return
    }

    this.ws.on('open', () => this.handleOpen())
    this.ws.on('message', (data) => this.handleMessage(data))
    this.ws.on('close', () => {
      this.connected = false
      this.onStatus({ connected: false, error: 'Connection closed' })
      this.scheduleReconnect()
    })
    this.ws.on('error', (err) => {
      this.onStatus({ connected: false, error: err.message })
    })
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, 10000)
  }

  handleOpen() {
    this.connected = true
    this.sendConnect()
  }

  sendConnect() {
    const id = `conn-${++this.reqId}`
    const params = {
      minProtocol: PROTOCOL_VERSION,
      maxProtocol: PROTOCOL_VERSION,
      client: { id: 'humanitybots', version: '0.1.0', platform: 'node', mode: 'operator' },
      role: 'operator',
      scopes: ['operator.read'],
      caps: [],
      commands: [],
      permissions: {},
      locale: 'en-US',
      userAgent: 'HumanityBOTS/0.1.0'
    }
    if (this.token) params.auth = { token: this.token }
    this.send('connect', params, (err, payload) => {
      if (err) {
        this.onStatus({ connected: false, error: err.message || err })
        return
      }
      this.onStatus({ connected: true, error: null })
      this.fetchSessions()
      this.startPoll()
    })
  }

  send(method, params, callback) {
    const id = `req-${++this.reqId}`
    this.pending.set(id, callback)
    try {
      this.ws.send(JSON.stringify({ type: 'req', id, method, params }))
    } catch (e) {
      this.pending.delete(id)
      callback(e, null)
    }
  }

  handleMessage(data) {
    let msg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }
    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      this.sendConnect()
      return
    }
    if (msg.type === 'res' && msg.id) {
      const cb = this.pending.get(msg.id)
      this.pending.delete(msg.id)
      if (cb) cb(msg.error || null, msg.payload)
    }
  }

  fetchSessions() {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const tryMethod = (method) => {
      this.send(method, { limit: 50 }, (err, payload) => {
        if (err && method === 'sessions.list') return tryMethod('sessions_list')
        if (err) return
        const rows = payload?.rows ?? payload?.sessions ?? (Array.isArray(payload) ? payload : [])
        const agents = this.normalizeAgents(rows)
        if (agents.length) this.onAgents(agents)
      })
    }
    tryMethod('sessions.list')
  }

  normalizeAgents(rows) {
    const byAgent = new Map()
    for (const r of rows) {
      const agentId = r.agentId ?? r.key?.split(':')[1] ?? 'main'
      if (!byAgent.has(agentId)) {
        byAgent.set(agentId, {
          id: agentId,
          name: r.displayName || agentId,
          emoji: '🦞',
          online: true,
          lastSeen: Date.now(),
          sessions: 0,
          model: r.model || null,
          source: 'openclaw'
        })
      }
      const a = byAgent.get(agentId)
      a.sessions = (a.sessions || 0) + 1
      if (r.model) a.model = r.model
      if (r.updatedAt && (!a.lastSeen || r.updatedAt > a.lastSeen)) a.lastSeen = r.updatedAt
    }
    return Array.from(byAgent.values())
  }

  startPoll() {
    this.stopPoll()
    this.pollTimer = setInterval(() => this.fetchSessions(), this.pollIntervalMs)
  }

  stopPoll() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  disconnect() {
    this.stopPoll()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }
}
