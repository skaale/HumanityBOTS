<template>
  <div class="space-y-8 max-w-6xl">
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
      <h2 class="section-title mb-4">Discovery pipeline</h2>
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

const stream = useStreamStore()
const viewerGeo = ref<{ ip: string; country: string; city?: string } | null>(null)
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

onMounted(() => {
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
