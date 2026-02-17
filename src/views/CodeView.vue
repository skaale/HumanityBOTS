<template>
  <div class="flex flex-col h-[calc(100vh-8rem)]">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-[var(--text-primary)]">Live code</h1>
      <span class="text-xs text-[var(--text-tertiary)] tabular-nums">{{ stream.codeEdits.length }} edits</span>
    </div>
    <div
      v-if="liveCodingTopic"
      class="mb-4 rounded-lg border border-[var(--success)]/40 bg-[var(--success)]/10 px-4 py-3 flex flex-wrap items-center gap-3"
    >
      <span class="live-dot" aria-hidden="true"></span>
      <span class="font-medium text-[var(--success)]">Live</span>
      <span class="text-[var(--text-secondary)]">·</span>
      <span class="text-[var(--text-primary)]">{{ liveCodingTopic.title }}</span>
      <span class="text-[var(--text-tertiary)] text-sm">
        {{ codingBots.length }} bot{{ codingBots.length !== 1 ? 's' : '' }} on topic
        <template v-if="stream.codeEdits.length === 0"> · 0 edits — code when Thinker runs (every few min)</template>
        <template v-else> · {{ stream.codeEdits.length }} edit{{ stream.codeEdits.length !== 1 ? 's' : '' }}</template>
      </span>
      <div class="flex flex-wrap gap-1.5 ml-auto">
        <span
          v-for="a in codingBots"
          :key="a.id"
          class="text-xs px-2 py-0.5 rounded-full bg-[var(--success)]/20 text-[var(--success)]"
          :title="a.name"
        >{{ a.emoji || '🤖' }} {{ a.name || a.id }}</span>
      </div>
    </div>
    <div class="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
      <div class="lg:col-span-8 flex flex-col min-h-0 gap-2">
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="copyCode">Copy code</button>
          <button type="button" class="btn-ghost" @click="downloadCode">Download .txt</button>
        </div>
        <LiveCodeEditor
          :model-value="stream.codeBuffer"
          :line-attribution="lineAttribution"
          :agent-colors="agentColors"
          :read-only="true"
        />
      </div>
      <div class="lg:col-span-4 flex flex-col min-h-0 space-y-4">
        <section class="card overflow-hidden flex flex-col min-h-0">
          <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
            <h3 class="section-title mb-0">Thinker ↔ Clawbots</h3>
            <span v-if="stream.connected" class="flex items-center gap-1.5 text-[10px] font-medium text-[var(--success)]">
              <span class="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" aria-hidden="true"></span>
              Live · {{ stream.botMessages.length }} msg{{ stream.botMessages.length !== 1 ? 's' : '' }}
            </span>
          </div>
          <div ref="messagesContainerRef" class="flex-1 overflow-auto p-2 space-y-2 min-h-[140px] max-h-[200px]">
            <transition-group name="msg" tag="div" class="space-y-2">
              <div
                v-for="msg in displayMessages"
                :key="msg.id"
                class="text-xs py-2 px-3 rounded-md border-l-2 msg-item"
                :class="[isThinker(msg) ? 'bg-teal-500/10 border-teal-500' : 'bg-[var(--bg-primary)] border-[var(--accent)]', isNewMessage(msg) ? 'msg-new' : '']"
              >
                <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium" :class="isThinker(msg) ? 'text-teal-600 dark:text-teal-400' : 'text-[var(--accent)]'">
                  <span v-if="isThinker(msg)" class="mr-0.5" aria-hidden="true">🧠</span>
                  <span>{{ msg.fromName }}</span>
                  <span v-if="msg.toName">→ {{ msg.toName }}</span>
                  <span v-else>→ {{ isThinker(msg) ? 'team' : 'all' }}</span>
                  <span class="text-[var(--text-tertiary)] font-normal tabular-nums" :title="formatTsFull(msg.ts)">
                    · {{ formatTs(msg.ts) }} <span class="text-[10px] opacity-80">({{ formatTsRelative(msg.ts) }})</span>
                  </span>
                </div>
                <p class="mt-0.5 text-[var(--text-secondary)] break-words">{{ msg.text }}</p>
              </div>
            </transition-group>
          </div>
          <p v-if="!stream.botMessages.length" class="text-xs text-[var(--text-tertiary)] px-3 py-2">Thinker and Clawbots will show messages here as they coordinate topics and code.</p>
        </section>
        <section class="card overflow-hidden flex flex-col min-h-0">
          <h3 class="section-title px-4 py-3 border-b border-[var(--border-subtle)]">Agents writing code</h3>
          <ul class="flex-1 overflow-auto p-2 space-y-1 min-h-[120px]">
            <li
              v-for="a in agentsWritingCode"
              :key="a.agentId"
              class="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-[var(--bg-primary)]"
            >
              <span
                class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 text-white"
                :style="{ backgroundColor: agentColors[a.agentId] || 'var(--accent)' }"
              >
                {{ (a.agentName || a.agentId).slice(0, 2) }}
              </span>
              <div class="min-w-0 flex-1">
                <span class="font-medium text-[var(--text-primary)] truncate block">{{ a.agentName || a.agentId }}</span>
                <span class="text-xs text-[var(--text-tertiary)]">{{ a.lines }} line{{ a.lines !== 1 ? 's' : '' }}</span>
              </div>
            </li>
          </ul>
          <p v-if="!agentsWritingCode.length" class="text-xs text-[var(--text-tertiary)] px-3 py-2">No code in the buffer yet. Only the Thinker submits code (every few minutes). Config agents (Terra, Codex, etc.) don’t call the API — they’re placeholders until you connect OpenClaw gateways.</p>
        </section>
        <section class="card overflow-hidden flex flex-col min-h-0">
          <h3 class="section-title px-4 py-3 border-b border-[var(--border-subtle)]">Recent activity</h3>
          <div class="flex items-center gap-2 text-[10px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-2 pt-1 pb-0.5">
            <span class="w-6 shrink-0">Who</span>
            <span class="flex-1 min-w-0">Agent</span>
            <span class="shrink-0 tabular-nums">Time</span>
          </div>
          <div class="flex-1 overflow-auto p-2 space-y-1 max-h-[200px]">
            <div
              v-for="(edit, i) in stream.codeEdits.slice().reverse().slice(0, 20)"
              :key="i"
              class="flex items-center gap-2 text-xs py-1 border-b border-[var(--border-subtle)] last:border-0"
            >
              <span class="w-6 h-6 rounded-full bg-[var(--accent-bg)] flex items-center justify-center text-[var(--accent)] flex-shrink-0">{{ (edit.agentName || edit.agentId)[0] }}</span>
              <span class="text-[var(--text-secondary)] truncate flex-1">{{ edit.agentName }}</span>
              <span class="text-[var(--text-tertiary)] flex-shrink-0 tabular-nums" :title="formatTsFull(edit.ts)">{{ formatTs(edit.ts) }} <span class="text-[10px] opacity-80">({{ formatTsRelative(edit.ts) }})</span></span>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useStreamStore } from '@/stores/stream'
import LiveCodeEditor from '@/components/LiveCodeEditor.vue'
import type { AttributionMap } from '@/components/LiveCodeEditor.vue'

const AGENT_PALETTE = ['#7dd3fc', '#86efac', '#fcd34d', '#f9a8d4', '#a5b4fc', '#f472b6', '#67e8f9', '#bef264']
const THINKER_ID = 'humanity-thinker'

const stream = useStreamStore()
const lineAttribution = ref<AttributionMap>({})
const messagesContainerRef = ref<HTMLElement | null>(null)
const lastMessageCount = ref(0)
const newMessageIds = ref<Set<string>>(new Set())

const displayMessages = computed(() => stream.botMessages.slice().reverse().slice(0, 25))

function isThinker(msg: { fromId?: string }) {
  return msg?.fromId === THINKER_ID
}
function isNewMessage(msg: { id?: string }) {
  return msg?.id && newMessageIds.value.has(msg.id)
}

const agentColors = computed(() => {
  const seen = new Set<string>()
  const order: string[] = []
  for (const e of stream.codeEdits) {
    if (e?.agentId && !seen.has(e.agentId)) {
      seen.add(e.agentId)
      order.push(e.agentId)
    }
  }
  const out: Record<string, string> = {}
  order.forEach((id, i) => { out[id] = AGENT_PALETTE[i % AGENT_PALETTE.length] })
  return out
})

function buildAttributionFromEdits(
  buffer: string,
  edits: ReadonlyArray<{ agentId: string; agentName: string; text: string }>
): AttributionMap {
  const out: AttributionMap = {}
  let lineCount = 0
  for (const e of edits) {
    const lines = (e.text || '').split('\n').length
    for (let i = 0; i < lines; i++) out[lineCount + i] = { agentId: e.agentId, agentName: e.agentName }
    lineCount += lines
  }
  const bufLines = (buffer || '').split('\n').length
  if (lineCount < bufLines && edits.length > 0) {
    const last = edits[edits.length - 1]
    for (let i = lineCount; i < bufLines; i++) out[i] = { agentId: last.agentId, agentName: last.agentName }
  }
  return out
}

watch(
  () => [stream.codeBuffer, stream.codeEdits] as const,
  ([buf, edits]) => {
    const buffer = buf || ''
    if (edits.length > 0) {
      lineAttribution.value = buildAttributionFromEdits(buffer, edits)
    }
  },
  { immediate: true, deep: true }
)

watch(
  () => stream.botMessages.length,
  (n, prev) => {
    if (n > prev && stream.botMessages.length > 0) {
      const latest = stream.botMessages[stream.botMessages.length - 1]
      if (latest?.id) {
        newMessageIds.value = new Set([latest.id])
        setTimeout(() => { newMessageIds.value = new Set() }, 2500)
      }
      nextTick(() => {
        const el = messagesContainerRef.value
        if (el) el.scrollTop = 0
      })
    }
  }
)

const liveCodingTopic = computed(() => {
  if (!stream.currentTopicId) return null
  return stream.topics.find(t => t.id === stream.currentTopicId) || null
})
const codingBots = computed(() => {
  const out: Array<{ id: string; name: string; emoji?: string }> = []
  for (const [id, status] of Object.entries(stream.agentStatuses)) {
    if (status !== 'coding') continue
    const a = stream.agentState[id]
    if (a) out.push({ id: a.id, name: a.name || a.id, emoji: a.emoji })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
})

const agentsWritingCode = computed(() => {
  const counts: Record<string, { agentId: string; agentName: string; lines: number }> = {}
  for (const [, a] of Object.entries(lineAttribution.value)) {
    const key = a.agentId
    if (!counts[key]) counts[key] = { agentId: a.agentId, agentName: a.agentName, lines: 0 }
    counts[key].lines++
  }
  return Object.values(counts).sort((x, y) => y.lines - x.lines)
})

function copyCode() {
  const text = stream.codeBuffer || ''
  if (!text) return
  navigator.clipboard.writeText(text).catch(() => {})
}
function downloadCode() {
  const text = stream.codeBuffer || ''
  const name = `humanitybots_code_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '-')}.txt`
  downloadTxt(name, text)
}
function downloadTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
function formatTs(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
function formatTsFull(ts: number) {
  return new Date(ts).toLocaleString([], { dateStyle: 'short', timeStyle: 'medium' })
}
function formatTsRelative(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 10) return 'just now'
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return formatTs(ts)
}
</script>

<style scoped>
.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.1); }
}
.msg-item {
  transition: background-color 0.2s ease, box-shadow 0.2s ease;
}
.msg-new {
  animation: msg-new 2s ease-out forwards;
}
@keyframes msg-new {
  0% { box-shadow: 0 0 0 2px var(--success); }
  100% { box-shadow: none; }
}
.msg-enter-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.msg-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
