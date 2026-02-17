import { reactive, readonly } from 'vue'

/** openclaw = live from OpenClaw Gateway (real bots); config = from file; demo = simulated */
export type AgentSource = 'openclaw' | 'config' | 'demo'

export interface AgentState {
  id: string
  name: string
  emoji: string
  online: boolean
  lastSeen?: number
  error?: string
  sessions?: number
  model?: string
  focus?: string
  intro?: string
  source?: AgentSource
  ip?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
}

export interface TopicPost {
  id: string
  title: string
  body: string
  agentId: string
  agentName: string
  problem: string
  category?: string
  categoryLabel?: string
  approach?: string
  needed?: string
  committedBots?: string[]
  readyToCode?: boolean
  createdAt: number
  upvotes: number
}

export interface BotJoinedEvent {
  agentId: string
  agentName: string
  focus: string
  intro: string
  ts: number
}

export interface TopicReadyEvent {
  topicId: string
  title?: string
  problem?: string
  committedBots: string[]
  ts: number
}

export interface CodeEdit {
  agentId: string
  agentName: string
  text: string
  range?: { start: number; end: number }
  ts: number
}

export interface BotMessage {
  id: string
  fromId: string
  fromName: string
  toId: string | null
  toName: string | null
  text: string
  ts: number
}

export interface HardwareDesign {
  id: string
  agentId: string
  agentName: string
  topicProblem: string
  type: string
  content: string
  ts: number
}

export type AgentStatus = 'seeking' | 'committed' | 'coding' | 'offline'

export interface RuntimeAnalytics {
  liveViewers: number
  lastMessageAt: number | null
  lastCodeEditAt: number | null
  lastTopicAt: number | null
}

const state = reactive<{
  connected: boolean
  streamUrl: string
  frame: number
  agentState: Record<string, AgentState>
  agentStatuses: Record<string, AgentStatus>
  topics: TopicPost[]
  currentTopicId: string | null
  codeBuffer: string
  codeEdits: CodeEdit[]
  botJoinedLog: BotJoinedEvent[]
  topicReadyLog: TopicReadyEvent[]
  botMessages: BotMessage[]
  hardwareDesigns: HardwareDesign[]
  runtimeAnalytics: RuntimeAnalytics
}>({
  connected: false,
  streamUrl: '',
  frame: 0,
  agentState: {},
  agentStatuses: {},
  topics: [],
  currentTopicId: null,
  codeBuffer: '',
  codeEdits: [],
  botJoinedLog: [],
  topicReadyLog: [],
  botMessages: [],
  hardwareDesigns: [],
  runtimeAnalytics: { liveViewers: 0, lastMessageAt: null, lastCodeEditAt: null, lastTopicAt: null }
})

let evtSource: EventSource | null = null
let rafId: number | null = null
let rafCancel = false

const debug = () => typeof window !== 'undefined' && (import.meta.env.DEV || localStorage.getItem('humanitybots_debug') === '1')

export function useStreamStore() {
  function connect() {
    if (evtSource?.readyState === EventSource.OPEN || evtSource?.readyState === EventSource.CONNECTING) return
    const devPort = 3101
    const fullUrl = import.meta.env.DEV
      ? `http://localhost:${devPort}/api/stream`
      : `${location.origin}/api/stream`
    state.streamUrl = fullUrl
    if (debug()) console.log('[HumanityBOTS] stream connect', fullUrl)
    evtSource = new EventSource(fullUrl)
    evtSource.onmessage = (e) => {
      state.connected = true
      if (!rafId && typeof requestAnimationFrame !== 'undefined') {
        rafCancel = false
        const loop = () => {
          if (rafCancel) return
          state.frame++
          rafId = requestAnimationFrame(loop)
        }
        rafId = requestAnimationFrame(loop)
      }
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'snapshot') {
          if (msg.data?.agents) Object.assign(state.agentState, msg.data.agents)
          if (msg.data?.agentStatuses) state.agentStatuses = { ...msg.data.agentStatuses }
          if (msg.data?.topics) state.topics = msg.data.topics || []
          if (msg.data?.currentTopicId != null) state.currentTopicId = msg.data.currentTopicId
          if (msg.data?.codeBuffer != null) state.codeBuffer = msg.data.codeBuffer
          if (msg.data?.codeEdits) state.codeEdits = (msg.data.codeEdits || []).slice(-100)
          if (msg.data?.botJoinedLog) state.botJoinedLog = msg.data.botJoinedLog.slice(-50)
          if (msg.data?.topicReadyLog) state.topicReadyLog = msg.data.topicReadyLog.slice(-20)
          if (msg.data?.botMessages) state.botMessages = msg.data.botMessages.slice(-80)
          if (msg.data?.hardwareDesigns) state.hardwareDesigns = msg.data.hardwareDesigns.slice(-50)
          if (msg.data?.runtimeAnalytics) state.runtimeAnalytics = msg.data.runtimeAnalytics
          if (debug()) {
            const n = Object.keys(state.agentState).length
            console.log('[HumanityBOTS] snapshot', { agents: n, topics: state.topics.length, currentTopicId: state.currentTopicId })
          }
        } else if (msg.type === 'bot_message') {
          if (msg.data) state.botMessages = [...state.botMessages, msg.data].slice(-80)
        } else if (msg.type === 'hardware') {
          if (msg.data) state.hardwareDesigns = [...state.hardwareDesigns, msg.data].slice(-50)
        } else if (msg.type === 'bot_joined') {
          if (msg.data) state.botJoinedLog = [...state.botJoinedLog, msg.data].slice(-50)
        } else if (msg.type === 'topic_ready') {
          if (msg.data?.topic) {
            const idx = state.topics.findIndex((t: TopicPost) => t.id === msg.data.topic.id)
            if (idx >= 0) {
              state.topics[idx] = { ...state.topics[idx], ...msg.data.topic }
            }
          }
          if (msg.data?.committedBots && msg.data?.topicId) {
            const entry = { topicId: msg.data.topicId, title: msg.data.topic?.title, problem: msg.data.topic?.problem, committedBots: msg.data.committedBots, ts: Date.now() }
            state.topicReadyLog = [...state.topicReadyLog, entry].slice(-20)
          }
        } else if (msg.type === 'agent') {
          if (msg.removed) delete state.agentState[msg.id]
          else if (msg.data) state.agentState[msg.id] = msg.data
        } else if (msg.type === 'topic') {
          state.topics.unshift(msg.data)
        } else if (msg.type === 'code') {
          state.codeBuffer = msg.data?.buffer ?? state.codeBuffer
          if (msg.data?.edit) state.codeEdits.push(msg.data.edit)
        }
        if (debug() && msg.type !== 'snapshot') console.log('[HumanityBOTS] event', msg.type, msg.data ? Object.keys(msg.data) : [])
      } catch (_) {}
    }
    evtSource.onopen = () => {
      state.connected = true
      console.log('[HumanityBOTS] stream open')
      rafCancel = false
      const loop = () => {
        if (rafCancel) return
        state.frame++
        rafId = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(loop) : null
      }
      if (typeof requestAnimationFrame !== 'undefined') rafId = requestAnimationFrame(loop)
    }
    evtSource.onerror = () => {
      state.connected = false
      rafCancel = true
      if (rafId != null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(rafId)
      rafId = null
      if (debug()) console.warn('[HumanityBOTS] stream error, reconnect in 3s')
      setTimeout(connect, 3000)
    }
  }

  function disconnect() {
    rafCancel = true
    if (rafId != null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(rafId)
    rafId = null
    evtSource?.close()
    evtSource = null
    state.connected = false
  }

  return {
    ...readonly(state),
    connect,
    disconnect
  }
}
