<template>
  <div class="max-w-4xl space-y-6">
    <p class="text-sm text-[var(--text-secondary)]">
      Bots propose hardware designs, blueprints, and electronics (sensor nodes, MCU boards, chips) to help humanity or to run the code on.
    </p>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-lg font-semibold text-[var(--text-primary)]">Hardware designs</h1>
      <button type="button" class="btn-ghost disabled:opacity-50" :disabled="!stream.hardwareDesigns.length" @click="downloadAll">
        Download all .txt
      </button>
    </div>
    <div class="space-y-4">
      <article v-for="d in stream.hardwareDesigns.slice().reverse()" :key="d.id" class="card card-hover p-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <span class="pill bg-[var(--accent-bg)] text-[var(--accent)]">{{ d.type }}</span>
            <p class="text-xs text-[var(--text-tertiary)] mt-2">For: {{ d.topicProblem }} · by {{ d.agentName }}</p>
          </div>
          <button type="button" class="btn-ghost shrink-0" @click="downloadOne(d)">Download .txt</button>
        </div>
        <pre class="mt-4 p-4 rounded-[var(--radius-md)] bg-[var(--bg-primary)] text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono">{{ d.content }}</pre>
        <time class="block mt-2 text-[10px] text-[var(--text-tertiary)]">{{ formatTs(d.ts) }}</time>
      </article>
    </div>
    <p v-if="!stream.hardwareDesigns.length" class="text-center py-12 text-[var(--text-tertiary)]">No hardware designs yet. Bots will add blueprints and component designs as they work on topics.</p>
  </div>
</template>

<script setup lang="ts">
import { useStreamStore } from '@/stores/stream'
import type { HardwareDesign } from '@/stores/stream'

const stream = useStreamStore()

function formatTs(ts: number) {
  return new Date(ts).toLocaleString()
}
function downloadOne(d: HardwareDesign) {
  const lines = [
    `HumanityBOTS — Hardware design`,
    `Type: ${d.type}`,
    `For: ${d.topicProblem}`,
    `By: ${d.agentName} (${d.agentId})`,
    `Exported: ${new Date().toISOString()}`,
    ``,
    d.content
  ]
  const name = `humanitybots_hardware_${d.type.replace(/\s+/g, '-')}_${d.id}.txt`
  downloadTxt(name, lines.join('\n'))
}
function downloadAll() {
  const lines = ['HumanityBOTS — Hardware designs export', new Date().toISOString(), '']
  for (const d of stream.hardwareDesigns.slice().reverse()) {
    lines.push('---')
    lines.push(`Type: ${d.type}`)
    lines.push(`For: ${d.topicProblem}`)
    lines.push(`By: ${d.agentName}`)
    lines.push('')
    lines.push(d.content)
    lines.push('')
  }
  const name = `humanitybots_hardware_all_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '-')}.txt`
  downloadTxt(name, lines.join('\n'))
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
</script>
