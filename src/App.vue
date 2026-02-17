<template>
  <div class="min-h-screen flex bg-[var(--bg-primary)]">
    <aside class="w-[200px] shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <div class="p-5 border-b border-[var(--border-subtle)]">
        <h1 class="font-semibold text-[var(--text-primary)] text-base tracking-tight">HumanityBOTS</h1>
        <p class="text-[11px] text-[var(--text-tertiary)] mt-1">Fleet & Live Code</p>
      </div>
      <nav class="flex-1 p-2 space-y-0.5">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          active-class="nav-item-active"
        >
          {{ item.label }}
        </router-link>
      </nav>
      <div class="p-3 border-t border-[var(--border-subtle)]">
        <div
          class="flex items-center gap-2 rounded-lg px-3 py-2 border transition-all duration-200"
          :class="streamConnected
            ? 'border-[var(--success)]/50 bg-[var(--success)]/10'
            : 'border-[var(--error)]/40 bg-[var(--error)]/5'"
          :title="streamConnected ? 'SSE stream connected' : 'Connecting to server…'"
        >
          <span
            class="w-3 h-3 rounded-full shrink-0"
            :class="streamConnected
              ? 'bg-[var(--success)] shadow-[0_0_8px_var(--success)] animate-pulse'
              : 'bg-[var(--error)] animate-ping-slow'"
          />
          <span
            class="text-xs font-medium"
            :class="streamConnected ? 'text-[var(--success)]' : 'text-[var(--error)]'"
          >
            {{ streamConnected ? 'Live' : 'Connecting…' }}
          </span>
        </div>
        <template v-if="!streamConnected">
          <p class="text-[10px] text-[var(--text-tertiary)] mt-1.5">Trying: <code class="bg-[var(--bg-primary)] px-1 rounded break-all">{{ streamUrlDisplay }}</code></p>
          <p class="text-[10px] font-medium text-[var(--text-primary)] mt-1.5">One localhost only:</p>
          <p class="text-[10px] text-[var(--text-tertiary)] mt-0.5"><code class="bg-[var(--bg-primary)] px-1 rounded">npm run build</code> then <code class="bg-[var(--bg-primary)] px-1 rounded">npm run server</code></p>
          <p class="text-[10px] mt-0.5">Open <a href="http://localhost:3101" target="_blank" rel="noopener" class="text-[var(--accent)] underline">localhost:3101</a> — app + API on one port.</p>
          <p class="text-[10px] text-[var(--text-tertiary)] mt-1">Dev with hot reload: <code class="bg-[var(--bg-primary)] px-0.5 rounded">npm run dev:all</code> → app :3100, API :3101</p>
          <button type="button" class="mt-1.5 w-full text-[11px] btn-ghost border border-[var(--border-subtle)] py-1.5 rounded" @click="reconnectStream">Reconnect</button>
        </template>
        <div v-if="debugOn" class="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] p-2 text-[10px] font-mono text-[var(--text-tertiary)] space-y-1 overflow-auto max-h-32">
          <div>frame: {{ stream.frame }}</div>
          <div>agents: {{ Object.keys(stream.agentState).length }}</div>
          <div>topics: {{ stream.topics.length }}</div>
          <div>edits: {{ stream.codeEdits.length }}</div>
          <div>msgs: {{ stream.botMessages.length }}</div>
          <div>viewers: {{ stream.runtimeAnalytics.liveViewers }}</div>
          <div>lastMsg: {{ stream.runtimeAnalytics.lastMessageAt ? '✓' : '—' }}</div>
          <div>lastEdit: {{ stream.runtimeAnalytics.lastCodeEditAt ? '✓' : '—' }}</div>
        </div>
      </div>
    </aside>
    <main class="flex-1 flex flex-col min-w-0">
      <header class="sticky top-0 z-10 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/95 backdrop-blur-sm">
        <div class="h-14 flex items-center justify-between px-6 gap-4">
          <span class="text-sm font-medium text-[var(--text-secondary)] truncate">{{ $route.meta.title || 'HumanityBOTS' }}</span>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <span
              class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border"
              :class="streamConnected ? 'border-[var(--success)]/40 bg-[var(--success)]/10 text-[var(--success)]' : 'border-[var(--error)]/40 bg-[var(--error)]/10 text-[var(--error)]'"
              :title="streamConnected ? 'Stream connected' : 'Connecting to server…'"
            >
              <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="streamConnected ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--error)] animate-ping-slow'"></span>
              {{ streamConnected ? 'Live' : 'Connecting…' }}
            </span>
            <button type="button" class="btn-ghost text-xs px-2 py-1 rounded border border-[var(--border-subtle)] hover:border-[var(--accent)] hover:text-[var(--accent)]" :title="streamConnected ? 'Reconnect stream' : 'Connect to stream'" @click="reconnectStream">{{ streamConnected ? 'Reconnect' : 'Connect' }}</button>
            <span class="text-xs text-[var(--text-tertiary)] tabular-nums">{{ agentsOnline }}/{{ agentsTotal }} agents</span>
            <button type="button" class="btn-ghost border border-[var(--accent)] text-[var(--accent)]" :class="agentAudio.unlocked() && 'opacity-70'" @click="agentAudio.unlockAudio()">{{ agentAudio.unlocked() ? 'Audio on' : 'Click to enable bot sound' }}</button>
            <label class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] cursor-pointer whitespace-nowrap">
              <input v-model="soundOnComms" type="checkbox" class="rounded border-[var(--border)]" />
              Bot talk
            </label>
            <label class="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap" :class="speakThinker ? 'text-teal-500' : 'text-[var(--text-tertiary)]'">
              <input v-model="speakThinker" type="checkbox" class="rounded border-teal-500 text-teal-600" />
              Speak Thinker
            </label>
            <label class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] cursor-pointer whitespace-nowrap">
              <input v-model="speakMessages" type="checkbox" class="rounded border-[var(--border)]" />
              Speak all
            </label>
            <label class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] cursor-pointer whitespace-nowrap">
              <input v-model="soundOnEdit" type="checkbox" class="rounded border-[var(--border)]" />
              Edit
            </label>
            <label class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] cursor-pointer whitespace-nowrap">
              <input v-model="agentAudio.muteAll" type="checkbox" class="rounded border-[var(--border)]" />
              Mute all
            </label>
            <button type="button" class="btn-ghost text-xs" @click="toggleDebug" :title="debugOn ? 'Disable console debug' : 'Enable console debug'">{{ debugOn ? 'Debug on' : 'Debug' }}</button>
            <button type="button" class="btn-ghost" @click="toggleTheme">Theme</button>
          </div>
        </div>
        <div class="px-4 pb-2">
          <AudioVisualizer :analyser="agentAudio.analyserRef?.value ?? null" />
        </div>
      </header>
      <div class="flex-1 overflow-auto p-6">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useStreamStore } from './stores/stream'
import { useAgentAudio } from './composables/useAgentAudio'
import AudioVisualizer from './components/AudioVisualizer.vue'

const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: '/topics', label: 'Topics' },
  { path: '/code', label: 'Live Code' },
  { path: '/hardware', label: 'Hardware' },
  { path: '/fleet', label: 'Fleet' }
]

const stream = useStreamStore()
const agentAudio = useAgentAudio()
provide('agentAudio', agentAudio)
const THINKER_AGENT_ID = 'humanity-thinker'
const debugOn = ref(false)
const soundOnEdit = ref(true)
const soundOnComms = ref(true)
const speakThinker = ref(true)
const speakMessages = ref(false)
const streamConnected = computed(() => stream.connected)
const streamUrlDisplay = computed(() => stream.streamUrl || (typeof location !== 'undefined' && import.meta.env.DEV ? 'http://localhost:3101/api/stream' : `${typeof location !== 'undefined' ? location.origin : ''}/api/stream`))
const _frame = computed(() => stream.frame)
const agentsTotal = computed(() => (void _frame.value, Object.keys(stream.agentState).length))
const agentsOnline = computed(() => (void _frame.value, Object.values(stream.agentState).filter((a: { online?: boolean }) => a.online).length))

let lastEditLen = 0
watch(() => stream.codeEdits.length, (n) => {
  if (soundOnEdit.value && !agentAudio.muteAll.value && n > lastEditLen && n > 0) agentAudio.playEditSound()
  lastEditLen = n
})
let lastMsgLen = 0
watch(() => stream.botMessages.length, (n) => {
  if (n > lastMsgLen && n > 0 && !agentAudio.muteAll.value) {
    const msg = stream.botMessages[stream.botMessages.length - 1]
    if (soundOnComms.value) agentAudio.playCommsSound()
    if (msg?.text) {
      const isThinker = msg.fromId === THINKER_AGENT_ID
      if (isThinker && speakThinker.value) agentAudio.speakThinker(msg.text)
      else if (!isThinker && speakMessages.value) agentAudio.speakMessage(`${msg.fromName} says ${msg.text}`)
    }
  }
  lastMsgLen = n
})

function toggleTheme() {
  document.documentElement.classList.toggle('dark')
}
function reconnectStream() {
  stream.disconnect()
  setTimeout(() => stream.connect(), 100)
}
function toggleDebug() {
  if (debugOn.value) {
    localStorage.removeItem('humanitybots_debug')
    debugOn.value = false
  } else {
    localStorage.setItem('humanitybots_debug', '1')
    debugOn.value = true
    console.log('[HumanityBOTS] Debug on — stream logs in console and panel below.')
  }
}

function onceUnlock() {
  agentAudio.unlockAudio()
  document.removeEventListener('click', onceUnlock)
  document.removeEventListener('keydown', onceUnlock)
}

onMounted(() => {
  try {
    debugOn.value = localStorage.getItem('humanitybots_debug') === '1'
  } catch (_) {}
  stream.connect()
  if (typeof window.speechSynthesis !== 'undefined') window.speechSynthesis.getVoices()
  document.addEventListener('click', onceUnlock, { once: true })
  document.addEventListener('keydown', onceUnlock, { once: true })
})
onUnmounted(() => {
  stream.disconnect()
  document.removeEventListener('click', onceUnlock)
  document.removeEventListener('keydown', onceUnlock)
})
</script>

<style scoped>
.nav-item {
  display: block;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--text-secondary);
  transition: background 0.15s ease, color 0.15s ease;
}
.nav-item:hover {
  background: var(--surface-hover);
  color: var(--text-primary);
}
.nav-item-active {
  background: var(--accent-bg);
  color: var(--accent);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
@keyframes ping-slow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.15); }
}
.animate-ping-slow {
  animation: ping-slow 1.5s ease-in-out infinite;
}
</style>
