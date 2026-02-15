<template>
  <div class="space-y-6 max-w-6xl">
    <div class="flex items-center justify-between gap-4 flex-wrap">
      <h1 class="text-lg font-semibold text-[var(--text-primary)]">Fleet</h1>
      <div class="flex gap-2">
        <button
          type="button"
          class="btn-ghost rounded-l-md rounded-r-none border border-[var(--border-subtle)]"
          :class="viewMode === 'grid' && 'bg-[var(--accent-bg)] text-[var(--accent)] border-[var(--accent)]'"
          @click="viewMode = 'grid'"
        >
          Grid
        </button>
        <button
          type="button"
          class="btn-ghost rounded-r-md rounded-l-none border border-[var(--border-subtle)] border-l-0"
          :class="viewMode === 'list' && 'bg-[var(--accent-bg)] text-[var(--accent)] border-[var(--accent)]'"
          @click="viewMode = 'list'"
        >
          List
        </button>
      </div>
    </div>
    <div :class="viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'space-y-2'">
      <router-link
        v-for="agent in agentList"
        :key="agent.id"
        :to="`/agent/${agent.id}`"
        class="card card-hover flex items-center gap-4"
        :class="viewMode === 'grid' ? 'p-5' : 'p-4'"
      >
        <div class="relative shrink-0">
          <span class="text-3xl">{{ agent.emoji || '🤖' }}</span>
          <span
            v-if="viewMode === 'grid' && agent.source === 'openclaw'"
            class="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--success)] border-2 border-[var(--bg)]"
            title="Live from OpenClaw"
          />
          <span
            v-if="viewMode === 'grid' && agent.online && stream.agentStatuses[agent.id]"
            class="absolute -bottom-0.5 -right-0.5 pill text-[10px] px-1.5 py-0"
            :class="statusPillClass(stream.agentStatuses[agent.id])"
          >{{ stream.agentStatuses[agent.id] }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-medium text-[var(--text-primary)] flex items-center gap-2 flex-wrap">
            {{ agent.name || agent.id }}
            <span v-if="agent.source === 'openclaw'" class="text-[10px] px-1.5 py-0 rounded bg-[var(--success)]/20 text-[var(--success)]" title="Live from OpenClaw Gateway">Live</span>
            <span v-else-if="agent.source === 'demo'" class="text-[10px] px-1.5 py-0 rounded bg-[var(--text-tertiary)]/20 text-[var(--text-tertiary)]" title="Simulated">Demo</span>
          </div>
          <div class="text-xs text-[var(--text-tertiary)] mt-0.5">
            ID: {{ agent.id }} · {{ agent.online ? 'Online' : 'Offline' }}
            <template v-if="agent.online && stream.agentStatuses[agent.id]"> · {{ stream.agentStatuses[agent.id] }}</template>
          </div>
          <div class="text-xs text-[var(--text-tertiary)] mt-0.5">
            {{ agent.ip ?? '—' }} · {{ agent.country || '—' }}{{ agent.city ? `, ${agent.city}` : '' }}
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span
            v-if="viewMode === 'list' && agent.online && stream.agentStatuses[agent.id]"
            class="pill text-xs"
            :class="statusPillClass(stream.agentStatuses[agent.id])"
          >{{ stream.agentStatuses[agent.id] }}</span>
          <span
            v-if="viewMode === 'list'"
            class="pill shrink-0"
            :class="agent.online ? 'bg-[var(--success)]/20 text-[var(--success)]' : 'bg-[var(--text-tertiary)]/20 text-[var(--text-tertiary)]'"
          >
            {{ agent.online ? 'Online' : 'Offline' }}
          </span>
        </div>
        <div v-if="viewMode === 'list'" class="text-xs text-[var(--text-tertiary)] shrink-0">
          Sessions: {{ agent.sessions ?? '—' }} · {{ agent.model ?? '—' }}
        </div>
      </router-link>
    </div>
    <p v-if="!agentList.length" class="text-center py-16 text-[var(--text-tertiary)] text-sm">
      No agents in fleet. Start the backend server to discover agents.
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useStreamStore } from '@/stores/stream'
import type { AgentStatus } from '@/stores/stream'

const stream = useStreamStore()
const viewMode = ref<'grid' | 'list'>('grid')
const agentList = computed(() =>
  Object.values(stream.agentState).sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id))
)
function statusPillClass(s: AgentStatus): string {
  if (s === 'seeking') return 'bg-[var(--warning)]/20 text-[var(--warning)]'
  if (s === 'committed') return 'bg-[var(--accent)]/20 text-[var(--accent)]'
  if (s === 'coding') return 'bg-[var(--success)]/20 text-[var(--success)]'
  return 'bg-[var(--text-tertiary)]/20 text-[var(--text-tertiary)]'
}
</script>
