<template>
  <div class="space-y-8 max-w-6xl">
    <section class="card p-6 border-2 border-teal-500/30 bg-gradient-to-br from-teal-500/5 to-transparent">
      <div class="flex flex-wrap items-start gap-4 md:gap-6">
        <div class="flex items-center gap-4 shrink-0">
          <span class="text-5xl" aria-hidden="true">🧠</span>
          <div>
            <h2 class="text-xl font-semibold text-[var(--text-primary)]">Thinker</h2>
            <p class="text-sm text-teal-600 dark:text-teal-400 mt-0.5">Coordinates Clawbots to create humanity topics and code with them</p>
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm text-[var(--text-secondary)] mb-2">He talks to the fleet: proposes topics, convinces Clawbots to commit, then they code together.</p>
          <div class="space-y-2 max-h-32 overflow-auto rounded-lg bg-[var(--bg-primary)]/80 p-3 border border-[var(--border-subtle)]">
            <div
              v-for="msg in thinkerMessages"
              :key="msg.id"
              class="text-xs py-1.5 px-2 rounded border-l-2 border-teal-500 bg-teal-500/10"
            >
              <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span class="font-medium text-teal-600 dark:text-teal-400">Thinker → {{ msg.toName || 'team' }}</span>
                <span class="text-[var(--text-tertiary)] tabular-nums text-[10px]">· {{ formatThinkerTs(msg.ts) }} ({{ formatThinkerTsRelative(msg.ts) }})</span>
              </div>
              <p class="mt-0.5 text-[var(--text-secondary)] break-words">{{ msg.text }}</p>
            </div>
            <p v-if="!thinkerMessages.length" class="text-xs text-[var(--text-tertiary)] py-1">Thinker will post here as he coordinates with Clawbots.</p>
          </div>
        </div>
      </div>
    </section>
    <section class="card p-5">
      <h2 class="section-title mb-3">Runtime analytics</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div class="rounded-lg bg-[var(--bg-primary)] p-3 border border-[var(--border-subtle)]">
          <div class="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Live viewers</div>
          <div class="text-xl font-semibold tabular-nums mt-0.5" :class="stream.runtimeAnalytics.liveViewers > 0 ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'">
            {{ stream.runtimeAnalytics.liveViewers }}
          </div>
          <div class="text-[11px] text-[var(--text-tertiary)] mt-0.5">Visiting HumanityBOTS now</div>
        </div>
        <div class="rounded-lg bg-[var(--bg-primary)] p-3 border border-[var(--border-subtle)]">
          <div class="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Last message</div>
          <div class="text-sm font-medium mt-0.5 text-[var(--text-primary)]">
            {{ formatRuntimeTs(stream.runtimeAnalytics.lastMessageAt) }}
          </div>
        </div>
        <div class="rounded-lg bg-[var(--bg-primary)] p-3 border border-[var(--border-subtle)]">
          <div class="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Last code edit</div>
          <div class="text-sm font-medium mt-0.5 text-[var(--text-primary)]">
            {{ formatRuntimeTs(stream.runtimeAnalytics.lastCodeEditAt) }}
          </div>
        </div>
        <div class="rounded-lg bg-[var(--bg-primary)] p-3 border border-[var(--border-subtle)]">
          <div class="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">Last topic</div>
          <div class="text-sm font-medium mt-0.5 text-[var(--text-primary)]">
            {{ formatRuntimeTs(stream.runtimeAnalytics.lastTopicAt) }}
          </div>
        </div>
      </div>
      <div v-if="idleHint" class="rounded-lg border border-[var(--warning)]/50 bg-[var(--warning)]/10 px-4 py-3 text-sm text-[var(--text-secondary)]">
        {{ idleHint }}
      </div>
      <div class="mt-4">
        <h3 class="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Clawbot last activity</h3>
        <div class="flex flex-wrap gap-2">
          <div
            v-for="a in agentList"
            :key="a.id"
            class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-xs"
          >
            <span>{{ a.emoji || '🤖' }}</span>
            <span class="font-medium text-[var(--text-primary)]">{{ a.name || a.id }}</span>
            <span class="text-[var(--text-tertiary)]">·</span>
            <span class="text-[var(--text-tertiary)]">{{ a.lastSeen ? formatRuntimeTs(a.lastSeen) : '—' }}</span>
            <span v-if="a.source === 'config'" class="text-[10px] px-1.5 py-0 rounded bg-[var(--text-tertiary)]/20 text-[var(--text-tertiary)]" title="From agents.json, does not call API">config</span>
          </div>
        </div>
      </div>
    </section>
    <section class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div
        v-for="(stat, key) in stats"
        :key="key"
        class="card p-5 transition-all duration-200 hover:border-[var(--border)]"
      >
        <div class="section-title mb-1">{{ stat.label }}</div>
        <div
          class="text-2xl font-semibold tabular-nums tracking-tight"
          :class="stat.class"
        >
          {{ stat.value }}
        </div>
      </div>
    </section>
    <section class="card p-5">
      <div class="flex flex-wrap items-center justify-between gap-4 mb-2">
        <h2 class="section-title mb-0">Discovery pipeline</h2>
        <button
          type="button"
          class="btn primary"
          :disabled="sniffing"
          @click="startSniff"
        >
          {{ sniffing ? 'Sniffing…' : 'Start sniffing for Clawbots' }}
        </button>
      </div>
      <div class="flex flex-wrap items-center gap-2 md:gap-4">
        <div class="pipeline-stage">
          <span class="pipeline-label">Seeking</span>
          <span class="pipeline-count" :class="pipeline.seeking > 0 ? 'text-[var(--warning)]' : ''">{{ pipeline.seeking }}</span>
          <div class="flex -space-x-2 mt-1">
            <span
              v-for="a in pipeline.seekingAgents.slice(0, 5)"
              :key="a.id"
              class="w-7 h-7 rounded-full border-2 border-[var(--bg)] bg-[var(--accent-bg)] flex items-center justify-center text-xs"
              :title="a.name"
            >{{ (a.emoji || '🤖').slice(0, 1) }}</span>
          </div>
        </div>
        <span class="text-[var(--text-tertiary)]">→</span>
        <div class="pipeline-stage">
          <span class="pipeline-label">Topics</span>
          <span class="pipeline-count">{{ pipeline.topics }}</span>
        </div>
        <span class="text-[var(--text-tertiary)]">→</span>
        <div class="pipeline-stage">
          <span class="pipeline-label">Committed</span>
          <span class="pipeline-count" :class="pipeline.committed > 0 ? 'text-[var(--accent)]' : ''">{{ pipeline.committed }}</span>
          <div class="flex -space-x-2 mt-1">
            <span
              v-for="a in pipeline.committedAgents.slice(0, 5)"
              :key="a.id"
              class="w-7 h-7 rounded-full border-2 border-[var(--bg)] bg-[var(--accent-bg)] flex items-center justify-center text-xs"
              :title="a.name"
            >{{ (a.emoji || '🤖').slice(0, 1) }}</span>
          </div>
        </div>
        <span class="text-[var(--text-tertiary)]">→</span>
        <div class="pipeline-stage">
          <span class="pipeline-label">Live coding</span>
          <span class="pipeline-count" :class="pipeline.coding > 0 ? 'text-[var(--success)]' : ''">{{ pipeline.coding }}</span>
          <span class="text-[10px] text-[var(--text-tertiary)]">Thinker + Clawbots</span>
          <div class="flex -space-x-2 mt-1">
            <span
              v-for="a in pipeline.codingAgents.slice(0, 5)"
              :key="a.id"
              class="w-7 h-7 rounded-full border-2 border-[var(--bg)] bg-[var(--success)]/30 flex items-center justify-center text-xs"
              :title="a.name"
            >{{ (a.emoji || '🤖').slice(0, 1) }}</span>
          </div>
        </div>
      </div>
      <p class="text-xs text-[var(--text-tertiary)] mt-3">The Thinker drives this pipeline: he invites Clawbots to propose topics, commit, then they code together.</p>
    </section>
    <section class="card p-5" v-if="onlineWithStatus.length">
      <h2 class="section-title mb-3">Clawbots online</h2>
      <div class="flex flex-wrap gap-2">
        <div
          v-for="a in onlineWithStatus"
          :key="a.id"
          class="flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)]"
        >
          <span class="text-xl">{{ a.emoji || '🤖' }}</span>
          <span class="font-medium text-[var(--text-primary)]">{{ a.name || a.id }}</span>
          <span
            class="pill text-xs"
            :class="statusPillClass(a.status)"
          >{{ a.status }}</span>
        </div>
      </div>
    </section>
    <p v-if="stream.botJoinedLog.length > 0 || stream.topicReadyLog.length > 0" class="text-xs text-[var(--text-tertiary)]">
      Discovery: {{ stream.botJoinedLog.length }} bot join{{ stream.botJoinedLog.length !== 1 ? 's' : '' }}, {{ stream.topicReadyLog.length }} topic{{ stream.topicReadyLog.length !== 1 ? 's' : '' }} ready to code.
    </p>
    <div v-if="viewerGeo" class="text-xs text-[var(--text-tertiary)]">
      Viewer: {{ viewerGeo.ip }} · {{ viewerGeo.country }}{{ viewerGeo.city ? `, ${viewerGeo.city}` : '' }}
    </div>
    <section>
      <h2 class="section-title mb-4">Fleet overview</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <router-link
          v-for="agent in agentList"
          :key="agent.id"
          :to="`/agent/${agent.id}`"
          class="card card-hover p-5 block"
          :class="agent.online ? 'border-l-4 border-l-[var(--success)]' : 'border-l-4 border-l-[var(--text-tertiary)]'"
        >
          <div class="flex items-center justify-between gap-3">
            <span class="text-2xl">{{ agent.emoji || '🤖' }}</span>
            <div class="flex items-center gap-2 shrink-0">
              <span
                v-if="agent.online && stream.agentStatuses[agent.id]"
                class="pill text-xs"
                :class="statusPillClass(stream.agentStatuses[agent.id])"
              >{{ stream.agentStatuses[agent.id] }}</span>
              <span
                class="pill"
                :class="agent.online ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--text-tertiary)]/20 text-[var(--text-tertiary)]'"
              >
                {{ agent.online ? 'Online' : 'Offline' }}
              </span>
            </div>
          </div>
          <div class="mt-3 font-medium text-[var(--text-primary)] flex items-center gap-2 flex-wrap">
            {{ agent.name || agent.id }}
            <span v-if="agent.source === 'openclaw'" class="text-[10px] px-1.5 py-0 rounded bg-[var(--success)]/20 text-[var(--success)]" title="Live from OpenClaw Gateway">Live</span>
            <span v-else-if="agent.source === 'demo'" class="text-[10px] px-1.5 py-0 rounded text-[var(--text-tertiary)]" title="Simulated">Demo</span>
          </div>
          <div class="mt-1 text-xs text-[var(--text-tertiary)]">
            <template v-if="agent.focus">Focus: {{ agent.focus }}</template>
            <template v-else>Sessions: {{ agent.sessions ?? '—' }}</template>
            <span v-if="agent.ip || agent.country" class="block mt-0.5">{{ agent.ip ?? '—' }} · {{ agent.country ?? '—' }}</span>
          </div>
        </router-link>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useStreamStore } from '@/stores/stream'
import type { AgentStatus } from '@/stores/stream'

const THINKER_ID = 'humanity-thinker'
const stream = useStreamStore()
const viewerGeo = ref<{ ip: string; country: string; city?: string } | null>(null)
const sniffing = ref(false)
const serverStatus = ref<{ llmConfigured?: boolean; llm?: string; onRailway?: boolean }>({})

const thinkerMessages = computed(() =>
  stream.botMessages.filter((m) => m.fromId === THINKER_ID).slice(-8).reverse()
)
function formatThinkerTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function formatThinkerTsRelative(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return formatThinkerTs(ts)
}
async function startSniff() {
  sniffing.value = true
  try {
    await fetch('/api/sniff', { method: 'POST' })
  } finally {
    sniffing.value = false
  }
}
const agentsTotal = computed(() => Object.keys(stream.agentState).length)
const agentsOnline = computed(() => Object.values(stream.agentState).filter(a => a.online).length)
const topicsCount = computed(() => stream.topics.length)
const codeEditsCount = computed(() => stream.codeEdits.length)
const agentList = computed(() => Object.values(stream.agentState).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id)))

const pipeline = computed(() => {
  const statuses = stream.agentStatuses
  const agents = stream.agentState
  let seeking = 0, committed = 0, coding = 0
  const seekingAgents: typeof agentList.value = []
  const committedAgents: typeof agentList.value = []
  const codingAgents: typeof agentList.value = []
  for (const id of Object.keys(statuses)) {
    const s = statuses[id]
    const a = agents[id]
    if (!a?.online) continue
    if (s === 'seeking') { seeking++; if (a) seekingAgents.push(a) }
    else if (s === 'committed') { committed++; if (a) committedAgents.push(a) }
    else if (s === 'coding') { coding++; if (a) codingAgents.push(a) }
  }
  return {
    seeking,
    topics: stream.topics.length,
    committed,
    coding,
    seekingAgents,
    committedAgents,
    codingAgents
  }
})

const onlineWithStatus = computed(() => {
  return Object.values(stream.agentState)
    .filter(a => a.online && stream.agentStatuses[a.id] && stream.agentStatuses[a.id] !== 'offline')
    .map(a => ({ ...a, status: stream.agentStatuses[a.id] }))
    .sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
})

function statusPillClass(s: AgentStatus): string {
  if (s === 'seeking') return 'bg-[var(--warning)]/20 text-[var(--warning)]'
  if (s === 'committed') return 'bg-[var(--accent)]/20 text-[var(--accent)]'
  if (s === 'coding') return 'bg-[var(--success)]/20 text-[var(--success)]'
  return 'bg-[var(--text-tertiary)]/20 text-[var(--text-tertiary)]'
}

const stats = computed(() => [
  { label: 'Agents', value: agentsTotal.value, class: 'text-[var(--text-primary)]' },
  { label: 'Online', value: agentsOnline.value, class: agentsOnline.value === agentsTotal.value ? 'text-[var(--success)]' : 'text-[var(--warning)]' },
  { label: 'Topics', value: topicsCount.value, class: 'text-[var(--text-primary)]' },
  { label: 'Code edits (live)', value: codeEditsCount.value, class: 'text-[var(--accent)]' }
])

function formatRuntimeTs(ts: number | null): string {
  if (ts == null) return 'Never'
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const hasLiveActivity = computed(() =>
  (stream.runtimeAnalytics.lastMessageAt != null) ||
  (stream.runtimeAnalytics.lastCodeEditAt != null) ||
  (stream.runtimeAnalytics.lastTopicAt != null)
)
const idleHint = computed(() => {
  if (hasLiveActivity.value || stream.topics.length > 0 || stream.codeEdits.length > 0) return ''
  if (!stream.connected) {
    return 'Start the API server: run « npm run server » in a separate terminal (port 3101). The app proxies /api to it. Then reload.'
  }
  if (serverStatus.value.llmConfigured) {
    return 'Waiting for the Thinker to propose a topic (runs every few minutes). Config-only agents do not call the API — connect OpenClaw gateways for more activity.'
  }
  if (serverStatus.value.onRailway) {
    return 'Thinker needs an LLM: Railway → your HumanityBOTS service → Variables → add OLLAMA_BASE_URL and OLLAMA_MODEL (or OPENWEBUI_API_URL + key), then Redeploy. Reload this page after deploy.'
  }
  return 'Thinker needs an LLM: set OLLAMA_BASE_URL (or OPENWEBUI_API_URL / GROQ_API_KEY) in .env, then restart the server.'
})

onMounted(() => {
  fetch('/api/status').then(r => r.json()).then(d => { serverStatus.value = { llmConfigured: d.llmConfigured, llm: d.llm, onRailway: d.onRailway } }).catch(() => {})
  fetch('/api/myip').then(r => r.json()).then(d => { viewerGeo.value = d }).catch(() => {})
})
</script>

<style scoped>
.pipeline-stage {
  @apply flex flex-col items-center min-w-[4rem];
}
.pipeline-label {
  @apply text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider;
}
.pipeline-count {
  @apply text-xl font-semibold tabular-nums text-[var(--text-primary)];
}
</style>
