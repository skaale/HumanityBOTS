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
      <div class="p-3 border-t border-[var(--border-subtle)] flex items-center gap-2">
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="streamConnected ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--error)]'"
        />
        <span class="text-[11px] text-[var(--text-tertiary)]">{{ streamConnected ? 'Live' : 'Connecting…' }}</span>
      </div>
    </aside>
    <main class="flex-1 flex flex-col min-w-0">
      <header class="sticky top-0 z-10 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)]/95 backdrop-blur-sm">
        <div class="h-14 flex items-center justify-between px-6 gap-4">
          <span class="text-sm font-medium text-[var(--text-secondary)] truncate">{{ $route.meta.title || 'HumanityBOTS' }}</span>
          <div class="flex items-center gap-2 flex-wrap justify-end">
            <span class="text-xs text-[var(--text-tertiary)] tabular-nums">{{ agentsOnline }}/{{ agentsTotal }} agents</span>
            <button type="button" class="btn-ghost border border-[var(--accent)] text-[var(--accent)]" :class="agentAudio.unlocked() && 'opacity-70'" @click="agentAudio.unlockAudio()">{{ agentAudio.unlocked() ? 'Audio on' : 'Click to enable bot sound' }}</button>
            <label class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] cursor-pointer whitespace-nowrap">
              <input v-model="soundOnComms" type="checkbox" class="rounded border-[var(--border)]" />
              Bot talk
            </label>
            <label class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] cursor-pointer whitespace-nowrap">
              <input v-model="speakMessages" type="checkbox" class="rounded border-[var(--border)]" />
              Speak
            </label>
            <label class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] cursor-pointer whitespace-nowrap">
              <input v-model="soundOnEdit" type="checkbox" class="rounded border-[var(--border)]" />
              Edit
            </label>
            <label class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)] cursor-pointer whitespace-nowrap">
              <input v-model="agentAudio.muteAll" type="checkbox" class="rounded border-[var(--border)]" />
              Mute all
            </label>
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
const soundOnEdit = ref(true)
const soundOnComms = ref(true)
const speakMessages = ref(false)
const streamConnected = computed(() => stream.connected)
const agentsTotal = computed(() => Object.keys(stream.agentState).length)
const agentsOnline = computed(() => Object.values(stream.agentState).filter((a: { online?: boolean }) => a.online).length)

let lastEditLen = 0
watch(() => stream.codeEdits.length, (n) => {
  if (soundOnEdit.value && !agentAudio.muteAll.value && n > lastEditLen && n > 0) agentAudio.playEditSound()
  lastEditLen = n
})
let lastMsgLen = 0
watch(() => stream.botMessages.length, (n) => {
  if (n > lastMsgLen && n > 0) {
    if (soundOnComms.value && !agentAudio.muteAll.value) agentAudio.playCommsSound()
    if (speakMessages.value && !agentAudio.muteAll.value) {
      const msg = stream.botMessages[stream.botMessages.length - 1]
      if (msg?.text) agentAudio.speakMessage(`${msg.fromName} says ${msg.text}`)
    }
  }
  lastMsgLen = n
})

function toggleTheme() {
  document.documentElement.classList.toggle('dark')
}

function onceUnlock() {
  agentAudio.unlockAudio()
  document.removeEventListener('click', onceUnlock)
  document.removeEventListener('keydown', onceUnlock)
}

onMounted(() => {
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
</style>
