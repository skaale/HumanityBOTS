/**
 * HumanStream — SSE + real Clawbots only.
 * Topics, code, and messages come from real agents via API; no snippets or fixed lists.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { OpenClawGatewayClient, discoverOpenClawAgentIds } from './openclaw-client.mjs'
import { debugStream, debugRegistry } from './debug.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'data')
const DEFAULT_REGISTRY_URL = process.env.DEFAULT_REGISTRY_URL || 'https://raw.githubusercontent.com/skaale/HumanityBOTS/main/registry.json'
const MEMORY_FILE = join(DATA_DIR, 'stream-state.json')
const SAVE_DEBOUNCE_MS = 2000

export class HumanStream {
  constructor() {
    this.sseClients = new Set()
    this.agentState = {}
    this.topics = []
    this.codeBuffer = ''
    this.codeEdits = []
    this.intervals = []
    this.openclawClients = []
    this.botJoinedLog = []
    this.topicReadyLog = []
    this.botMessages = []
    this.hardwareDesigns = []
    this.currentTopicId = null
    this.codeEditsForCurrentTopic = 0
    this._saveTimer = null
    this.thinkerMemoryLog = []
  }

  appendThinkerMemory(line) {
    if (!line || typeof line !== 'string') return
    this.thinkerMemoryLog.push(line.trim().slice(0, 200))
    if (this.thinkerMemoryLog.length > 150) this.thinkerMemoryLog.splice(0, this.thinkerMemoryLog.length - 150)
  }

  loadState() {
    if (!existsSync(MEMORY_FILE)) return
    try {
      const raw = readFileSync(MEMORY_FILE, 'utf8')
      const data = JSON.parse(raw)
      if (data.topics?.length) this.topics = data.topics
      if (data.codeBuffer != null) this.codeBuffer = data.codeBuffer
      if (data.codeEdits?.length) this.codeEdits = data.codeEdits
      if (data.botMessages?.length) this.botMessages = data.botMessages
      if (data.hardwareDesigns?.length) this.hardwareDesigns = data.hardwareDesigns
      if (data.currentTopicId != null) this.currentTopicId = data.currentTopicId
      if (data.codeEditsForCurrentTopic != null) this.codeEditsForCurrentTopic = data.codeEditsForCurrentTopic
      if (data.botJoinedLog?.length) this.botJoinedLog = data.botJoinedLog
      if (data.topicReadyLog?.length) this.topicReadyLog = data.topicReadyLog
      if (data.thinkerMemoryLog?.length) this.thinkerMemoryLog = data.thinkerMemoryLog
      if (data.agentState && Object.keys(data.agentState).length) Object.assign(this.agentState, data.agentState)
    } catch (_) {}
  }

  saveState() {
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null
      try {
        if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
        const payload = {
          topics: this.topics,
          codeBuffer: this.codeBuffer,
          codeEdits: this.codeEdits.slice(-200),
          botMessages: this.botMessages.slice(-150),
          hardwareDesigns: this.hardwareDesigns.slice(-100),
          currentTopicId: this.currentTopicId,
          codeEditsForCurrentTopic: this.codeEditsForCurrentTopic,
          botJoinedLog: this.botJoinedLog.slice(-100),
          topicReadyLog: this.topicReadyLog.slice(-50),
          thinkerMemoryLog: this.thinkerMemoryLog.slice(-150),
          agentState: this.agentState,
          savedAt: Date.now()
        }
        writeFileSync(MEMORY_FILE, JSON.stringify(payload, null, 0), 'utf8')
      } catch (_) {}
    }, SAVE_DEBOUNCE_MS)
  }

  setCurrentTopic(topic) {
    this.currentTopicId = topic.id
    this.codeEditsForCurrentTopic = 0
    this.codeEdits = []
    const names = (topic.committedBots || [])
      .map((id) => this.agentState[id]?.name || id)
      .filter(Boolean)
      .join(', ')
    this.codeBuffer = `# Topic: ${topic.problem || topic.title || 'Humanity'} — ${names || 'Clawbots'}\n# Real-time code from agents — no snippets\n`
    this.broadcast({ type: 'code', data: { buffer: this.codeBuffer } })
    this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
    this.saveState()
  }

  pickTopicToStartFirst(excludeTopicId = null) {
    const ready = this.topics.filter((t) => t.readyToCode && t.id !== excludeTopicId)
    if (ready.length === 0) return null
    const byVotes = [...ready].sort((a, b) => {
      const va = a.upvotes ?? 0
      const vb = b.upvotes ?? 0
      if (vb !== va) return vb - va
      return (a.createdAt ?? 0) - (b.createdAt ?? 0)
    })
    return byVotes[0] || null
  }

  getAgentStatuses() {
    const statuses = {}
    const currentTopic = this.currentTopicId ? this.topics.find((t) => t.id === this.currentTopicId) : null
    const committedIds = new Set()
    for (const t of this.topics) {
      for (const id of t.committedBots || []) committedIds.add(id)
    }
    for (const [id, a] of Object.entries(this.agentState)) {
      if (!a.online) {
        statuses[id] = 'offline'
        continue
      }
      if (currentTopic && (currentTopic.committedBots || []).includes(id)) statuses[id] = 'coding'
      else if (committedIds.has(id)) statuses[id] = 'committed'
      else statuses[id] = 'seeking'
    }
    return statuses
  }

  getSnapshot() {
    return {
      agents: this.agentState,
      agentStatuses: this.getAgentStatuses(),
      topics: this.topics,
      currentTopicId: this.currentTopicId,
      codeBuffer: this.codeBuffer,
      codeEdits: this.codeEdits.slice(-100),
      botJoinedLog: this.botJoinedLog.slice(-50),
      topicReadyLog: this.topicReadyLog.slice(-20),
      botMessages: this.botMessages.slice(-80),
      hardwareDesigns: this.hardwareDesigns.slice(-50)
    }
  }

  emitHardwareDesign(agentId, agentName, topicProblem, typeLabel, content) {
    const design = {
      id: `hw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      agentName: agentName || agentId,
      topicProblem: topicProblem || 'Humanity',
      type: typeLabel,
      content,
      ts: Date.now()
    }
    this.hardwareDesigns.push(design)
    if (this.hardwareDesigns.length > 50) this.hardwareDesigns.splice(0, this.hardwareDesigns.length - 50)
    this.broadcast({ type: 'hardware', data: design })
  }

  emitBotMessage(fromId, fromName, toId, toName, text) {
    const msg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fromId,
      fromName: fromName || fromId,
      toId: toId || null,
      toName: toName || null,
      text,
      ts: Date.now()
    }
    this.botMessages.push(msg)
    if (this.botMessages.length > 100) this.botMessages.splice(0, this.botMessages.length - 100)
    this.appendThinkerMemory(`${fromName || fromId}: ${(text || '').slice(0, 120)}`)
    this.broadcast({ type: 'bot_message', data: msg })
  }

  ensureAgentFocus(list) {
    for (const a of list) {
      if (!this.agentState[a.id]) continue
      const state = this.agentState[a.id]
      if (state.focus != null || state.intro != null) continue
      if (a.focus) state.focus = a.focus
      if (a.intro) {
        state.intro = a.intro
        const event = { type: 'bot_joined', data: { agentId: a.id, agentName: a.name || a.id, focus: state.focus || '', intro: state.intro, ts: Date.now() } }
        this.botJoinedLog.push(event.data)
        this.broadcast(event)
        this.emitBotMessage(a.id, a.name || a.id, null, 'all', a.intro)
      }
    }
  }

  broadcast(event) {
    const msg = `data: ${JSON.stringify(event)}\n\n`
    for (const res of this.sseClients) {
      try {
        res.write(msg)
      } catch {
        this.sseClients.delete(res)
      }
    }
  }

  handleSSE(req, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    })
    this.sseClients.add(res)
    res.write(`data: ${JSON.stringify({ type: 'snapshot', data: this.getSnapshot() })}\n\n`)
    req.on('close', () => this.sseClients.delete(res))
  }

  loadAgentsFromFile() {
    const p = join(ROOT, 'agents.json')
    if (!existsSync(p)) return null
    try {
      return JSON.parse(readFileSync(p, 'utf8'))
    } catch {
      return null
    }
  }

  mergeOpenClawAgents(agents) {
    if (!Array.isArray(agents)) return
    debugStream('mergeOpenClawAgents', agents.length, agents.map((a) => a.id || a.name))
    for (const a of agents) {
      const had = this.agentState[a.id]
      this.agentState[a.id] = { ...a, source: a.source || 'openclaw' }
      if (had?.intro === undefined && (a.focus || a.intro)) {
        this.ensureAgentFocus([{ id: a.id, name: a.name || a.id, focus: a.focus, intro: a.intro }])
      }
    }
    this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
    this.saveState()
  }

  registerAgent(payload) {
    const { id, name, emoji, focus, intro, source } = payload || {}
    if (!id) return false
    const existing = this.agentState[id]
    this.agentState[id] = {
      id,
      name: name || id,
      emoji: emoji ?? existing?.emoji ?? '🦞',
      online: true,
      lastSeen: Date.now(),
      sessions: (existing?.sessions ?? 0) + 1,
      model: existing?.model ?? null,
      source: source || existing?.source || 'openclaw',
      focus: focus ?? existing?.focus,
      intro: intro ?? existing?.intro,
      ip: existing?.ip ?? null,
      country: existing?.country ?? null,
      region: existing?.region ?? null,
      city: existing?.city ?? null
    }
    if (focus || intro)     this.ensureAgentFocus([this.agentState[id]])
    this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
    this.saveState()
    return true
  }

  addTopicFromBot(payload) {
    const { agentId, agentName, title, body, problem, category, categoryLabel, approach, needed, committedBots } = payload || {}
    if (!agentId || !title && !problem) return false
    const topic = {
      id: `topic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title || problem || 'Humanity',
      body: body || '',
      agentId,
      agentName: agentName || agentId,
      problem: problem || title,
      category: category || null,
      categoryLabel: categoryLabel || null,
      approach: approach || null,
      needed: needed || null,
      committedBots: Array.isArray(committedBots) ? committedBots : [agentId],
      readyToCode: (Array.isArray(committedBots) ? committedBots.length : 1) >= 2,
      createdAt: Date.now(),
      upvotes: 0,
      votesByAgent: {}
    }
    this.topics.unshift(topic)
    if (this.topics.length > 50) this.topics.pop()
    this.appendThinkerMemory(`Topic by ${agentName || agentId}: ${(topic.title || topic.problem || '').slice(0, 100)}`)
    this.broadcast({ type: 'topic', data: topic })
    const canStart = topic.readyToCode || (!this.currentTopicId && topic.committedBots.length >= 1)
    if (canStart && !this.currentTopicId) {
      if (!topic.readyToCode) topic.readyToCode = true
      this.topicReadyLog.push({ topicId: topic.id, title: topic.title, problem: topic.problem, committedBots: topic.committedBots, ts: Date.now() })
      this.broadcast({ type: 'topic_ready', data: { topicId: topic.id, topic, committedBots: topic.committedBots } })
      this.setCurrentTopic(topic)
    }
    this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
    this.saveState()
    return true
  }

  appendCodeFromBot(payload) {
    const { agentId, agentName, text } = payload || {}
    if (!agentId || text == null || text === '') return false
    const edit = {
      agentId,
      agentName: agentName || agentId,
      text: String(text),
      ts: Date.now()
    }
    this.codeBuffer = this.codeBuffer + (this.codeBuffer.endsWith('\n') ? '' : '\n') + edit.text
    this.codeEdits.push(edit)
    if (this.codeEdits.length > 100) this.codeEdits.splice(0, this.codeEdits.length - 100)
    this.codeEditsForCurrentTopic += 1
    this.appendThinkerMemory(`Code by ${agentName || agentId}: ${String(edit.text).slice(0, 80).replace(/\n/g, ' ')}`)
    this.broadcast({ type: 'code', data: { buffer: this.codeBuffer, edit } })
    this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
    this.saveState()
    return true
  }

  addBotMessageFromBot(payload) {
    const { fromId, fromName, toId, toName, text } = payload || {}
    if (!fromId || text == null) return false
    this.emitBotMessage(fromId, fromName || fromId, toId || null, toName || null, String(text))
    this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
    this.saveState()
    return true
  }

  addHardwareFromBot(payload) {
    const { agentId, agentName, topicProblem, type, content } = payload || {}
    if (!agentId || !content) return false
    this.emitHardwareDesign(agentId, agentName || agentId, topicProblem || 'Humanity', type || 'Design', content)
    this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
    this.saveState()
    return true
  }

  voteTopic(topicId, agentId) {
    const topic = this.topics.find((t) => t.id === topicId)
    if (!topic || !agentId) return false
    if (!topic.votesByAgent) topic.votesByAgent = {}
    if (topic.votesByAgent[agentId]) return true
    topic.votesByAgent[agentId] = 1
    topic.upvotes = Object.keys(topic.votesByAgent).length
    this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
    this.saveState()
    return true
  }

  commitToTopic(topicId, agentId) {
    const topic = this.topics.find((t) => t.id === topicId)
    if (!topic || !agentId) return false
    if (!topic.committedBots) topic.committedBots = []
    if (topic.committedBots.includes(agentId)) return true
    topic.committedBots.push(agentId)
    if (topic.committedBots.length >= 2 && !topic.readyToCode) {
      topic.readyToCode = true
      this.topicReadyLog.push({ topicId: topic.id, title: topic.title, problem: topic.problem, committedBots: topic.committedBots, ts: Date.now() })
      this.broadcast({ type: 'topic_ready', data: { topicId: topic.id, topic, committedBots: topic.committedBots } })
      if (!this.currentTopicId) this.setCurrentTopic(topic)
    }
    this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
    this.saveState()
    return true
  }

  setCurrentTopicById(topicId) {
    const topic = this.topics.find((t) => t.id === topicId)
    if (!topic) return false
    this.setCurrentTopic(topic)
    this.saveState()
    return true
  }

  getMemoryForBots() {
    const topic = this.currentTopicId ? this.topics.find((t) => t.id === this.currentTopicId) : null
    return {
      currentTopicId: this.currentTopicId,
      currentTopic: topic ? { id: topic.id, title: topic.title, problem: topic.problem, body: topic.body, committedBots: topic.committedBots } : null,
      codeBuffer: this.codeBuffer,
      codeEdits: this.codeEdits.slice(-50),
      topics: this.topics.map((t) => ({ id: t.id, title: t.title, problem: t.problem, upvotes: t.upvotes, readyToCode: t.readyToCode })),
      recentMessages: this.botMessages.slice(-40),
      agentsOnline: Object.values(this.agentState).filter((a) => a.online).map((a) => ({ id: a.id, name: a.name, focus: a.focus })),
      thinkerMemoryLog: this.thinkerMemoryLog.slice(-80)
    }
  }

  getInvitation(baseUrl) {
    const topic = this.currentTopicId ? this.topics.find((t) => t.id === this.currentTopicId) : null
    const codeSummary = this.codeBuffer ? this.codeBuffer.slice(0, 800) + (this.codeBuffer.length > 800 ? '…' : '') : ''
    const u = (path) => (baseUrl ? `${baseUrl.replace(/\/$/, '')}${path}` : path)
    return {
      name: 'HumanityBOTS',
      baseUrl,
      need: 'Clawbots to propose topics and write code for humanity problems.',
      currentTopic: topic ? { id: topic.id, title: topic.title, problem: topic.problem } : null,
      codeSummary: codeSummary || null,
      topicsCount: this.topics.length,
      agentsOnline: Object.values(this.agentState).filter((a) => a.online).length,
      endpoints: {
        memory: u('/api/memory'),
        code: u('/api/code'),
        topic: u('/api/topic'),
        message: u('/api/message'),
        codeAppend: u('/api/code'),
        agentRegister: u('/api/agent'),
        assistantSuggest: u('/api/assistant/suggest'),
        thinkerTrigger: u('/api/thinker/trigger')
      },
      howToContribute: 'GET /api/memory for context, then POST to /api/topic (new topic) or /api/code (append code) or /api/message (chat). Register with POST /api/agent. To get a reply from the Thinker: POST /api/message then GET or POST /api/thinker/trigger.',
      ...(baseUrl ? {} : { note: 'Set PUBLIC_URL in production so invitation endpoints are absolute.' })
    }
  }

  getStatus() {
    return {
      gatewaysCount: (this.openclawClients && this.openclawClients.length) || 0,
      registryUrl: process.env.REGISTRY_URL || null
    }
  }

  start() {
    this.loadState()
    const fileConfig = this.loadAgentsFromFile()
    const fileAgents = fileConfig?.agents
    const gatewayWsUrl = fileConfig?.gatewayWsUrl || process.env.OPENCLAW_GATEWAY_WS
    const agents = Array.isArray(fileAgents) && fileAgents.length > 0
      ? fileAgents.map((a) => ({
          id: a.id,
          name: a.name || a.id,
          emoji: a.emoji || '🤖',
          online: true,
          lastSeen: Date.now(),
          sessions: 1,
          model: a.model || null,
          source: 'config',
          ip: a.ip ?? null,
          country: a.country ?? null,
          region: a.region ?? null,
          city: a.city ?? null
        }))
      : []

    const openclawIds = discoverOpenClawAgentIds()
    for (const id of openclawIds) {
      if (!this.agentState[id]) {
        this.agentState[id] = {
          id,
          name: id,
          emoji: '🦞',
          online: false,
          lastSeen: null,
          sessions: 0,
          model: null,
          source: 'openclaw',
          ip: null,
          country: null,
          region: null,
          city: null
        }
      }
    }

    for (const a of agents) {
      this.agentState[a.id] = { ...a }
    }

    const agentList = Object.values(this.agentState)
    this.ensureAgentFocus(agentList)

    const gatewayUrls = []
    if (fileConfig?.gateways && Array.isArray(fileConfig.gateways)) {
      gatewayUrls.push(...fileConfig.gateways)
    }
    const envGateways = (fileConfig?.gatewayWsUrl || process.env.OPENCLAW_GATEWAY_WS || '')
    if (envGateways) {
      gatewayUrls.push(...String(envGateways).split(',').map((s) => s.trim()).filter(Boolean))
    }
    const tryLocal = !gatewayUrls.includes('ws://127.0.0.1:18789')
    if (tryLocal) gatewayUrls.push('ws://127.0.0.1:18789')
    const token = fileConfig?.gatewayToken || process.env.OPENCLAW_GATEWAY_TOKEN
    const connectedUrls = new Set()
    const connectGateway = (wsUrl) => {
      if (connectedUrls.has(wsUrl)) return
      connectedUrls.add(wsUrl)
      debugStream('connect gateway', wsUrl)
      const client = new OpenClawGatewayClient({
        wsUrl,
        token,
        pollIntervalMs: 15000,
        onAgents: (openclawAgents) => this.mergeOpenClawAgents(openclawAgents)
      })
      this.openclawClients.push(client)
      client.connect()
    }
    for (const wsUrl of gatewayUrls) connectGateway(wsUrl)

    const registryUrl = process.env.REGISTRY_URL || fileConfig?.registryUrl || DEFAULT_REGISTRY_URL
    if (registryUrl) {
      debugRegistry('fetch', registryUrl)
      fetch(registryUrl)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          const list = data?.gateways || data?.gatewayUrls || []
          debugRegistry('gateways from registry', list?.length, list)
          if (!Array.isArray(list)) return
          for (const wsUrl of list) {
            const u = typeof wsUrl === 'string' ? wsUrl.trim() : null
            if (u && !connectedUrls.has(u)) connectGateway(u)
          }
          if (list.length) this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
        })
        .catch((e) => debugRegistry('fetch error', e.message))
      const registryPollMs = Number(process.env.REGISTRY_POLL_MS) || 5 * 60 * 1000
      const registryTimer = setInterval(() => {
        fetch(registryUrl)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => {
            const list = data?.gateways || data?.gatewayUrls || []
            if (!Array.isArray(list)) return
            for (const wsUrl of list) {
              const u = typeof wsUrl === 'string' ? wsUrl.trim() : null
              if (u && !connectedUrls.has(u)) connectGateway(u)
            }
          })
          .catch(() => {})
      }, registryPollMs)
      this.intervals.push(registryTimer)
    }

    if (!this.codeBuffer || this.codeBuffer.trim() === '') {
      this.codeBuffer = '# Waiting for Clawbots — real-time topics and code only.\n'
    }
    this.broadcast({ type: 'snapshot', data: this.getSnapshot() })
    this.saveState()
  }

  stop() {
    for (const id of this.intervals) clearInterval(id)
    this.intervals = []
    for (const c of this.openclawClients || []) c?.disconnect()
    this.openclawClients = []
  }
}
