<template>
  <div class="max-w-4xl space-y-8">
    <div class="flex items-center gap-5">
      <router-link
        to="/fleet"
        class="text-sm text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
      >
        ← Fleet
      </router-link>
      <span class="text-4xl">{{ agent?.emoji || '🤖' }}</span>
      <div>
        <h1 class="text-xl font-semibold text-[var(--text-primary)]">{{ agent?.name || agentId }}</h1>
        <div class="flex items-center gap-2 mt-1 flex-wrap">
          <span class="text-sm text-[var(--text-tertiary)]">ID: {{ agentId }}</span>
          <span
            class="pill text-xs"
            :class="agent?.online ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--text-tertiary)]/20 text-[var(--text-tertiary)]'"
          >
            {{ agent?.online ? 'Online' : 'Offline' }}
          </span>
          <span v-if="agent?.source === 'openclaw'" class="pill text-xs bg-[var(--success)]/20 text-[var(--success)]" title="Real bot from OpenClaw Gateway">Live · from internet</span>
          <span v-else-if="agent?.source === 'config'" class="text-xs text-[var(--text-tertiary)]">From config</span>
          <span v-else-if="agent?.source === 'demo'" class="text-xs text-[var(--text-tertiary)]">Demo (simulated)</span>
        </div>
      </div>
    </div>
    <div v-if="agent" class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div class="card p-5">
        <h3 class="section-title mb-4">Status</h3>
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between gap-4"><dt class="text-[var(--text-tertiary)]">Source</dt><dd>{{ sourceLabel(agent.source) }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-[var(--text-tertiary)]">Sessions</dt><dd>{{ agent.sessions ?? '—' }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-[var(--text-tertiary)]">Model</dt><dd>{{ agent.model ?? '—' }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-[var(--text-tertiary)]">Last seen</dt><dd>{{ agent.lastSeen ? formatTime(agent.lastSeen) : '—' }}</dd></div>
        </dl>
      </div>
      <div class="card p-5">
        <h3 class="section-title mb-4">Location</h3>
        <dl class="space-y-3 text-sm">
          <div class="flex justify-between gap-4"><dt class="text-[var(--text-tertiary)]">IP</dt><dd class="font-mono text-xs truncate max-w-[180px]">{{ agent.ip ?? '—' }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-[var(--text-tertiary)]">Country</dt><dd>{{ agent.country ?? '—' }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-[var(--text-tertiary)]">Region</dt><dd>{{ agent.region ?? '—' }}</dd></div>
          <div class="flex justify-between gap-4"><dt class="text-[var(--text-tertiary)]">City</dt><dd>{{ agent.city ?? '—' }}</dd></div>
        </dl>
      </div>
      <div class="card p-5 md:col-span-2">
        <h3 class="section-title mb-4">Recent code contributions</h3>
        <ul class="space-y-2 text-sm">
          <li v-for="(e, i) in agentEdits.slice(0, 8)" :key="i" class="text-[var(--text-secondary)] font-mono text-xs truncate py-0.5">{{ e.text || '…' }}</li>
        </ul>
        <p v-if="!agentEdits.length" class="text-[var(--text-tertiary)] text-sm mt-2">No edits yet from this agent.</p>
      </div>
    </div>
    <p v-else class="text-[var(--text-tertiary)]">Agent not found or not in stream.</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useStreamStore } from '@/stores/stream'
import type { AgentSource } from '@/stores/stream'

const route = useRoute()
const stream = useStreamStore()
const agentId = computed(() => route.params.id as string)
const agent = computed(() => stream.agentState[agentId.value])
const agentEdits = computed(() => stream.codeEdits.filter(e => e.agentId === agentId.value))
function sourceLabel(s?: AgentSource): string {
  if (s === 'openclaw') return 'OpenClaw (live from internet)'
  if (s === 'config') return 'Config file'
  if (s === 'demo') return 'Demo (simulated)'
  return '—'
}
function formatTime(ts: number) {
  const d = new Date(ts)
  const now = Date.now()
  const diff = now - ts
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  return d.toLocaleString()
}
</script>
