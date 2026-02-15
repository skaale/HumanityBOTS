<template>
  <div ref="wrap" class="audio-visualizer rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
    <div class="px-3 py-1.5 flex items-center gap-2">
      <span class="section-title shrink-0">Agent audio</span>
      <canvas ref="canvas" class="flex-1 h-8 min-h-[32px] block" :width="width" :height="32" title="Sound waves when bots talk (click header to enable)"></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{ analyser: AnalyserNode | null }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const wrap = ref<HTMLDivElement | null>(null)
const width = ref(280)
let raf = 0
let dataArray: Uint8Array<ArrayBuffer> | null = null
let bufferLength = 0

function drawIdle(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(10, 12, 16, 0.5)'
  ctx.fillRect(0, 0, w, h)
  const barCount = 24
  const barW = Math.max(1, (w / barCount) - 1)
  for (let i = 0; i < barCount; i++) {
    const barH = 2 + Math.sin(i * 0.3 + Date.now() / 400) * 2
    const x = i * (w / barCount)
    ctx.fillStyle = 'rgba(167, 139, 250, 0.25)'
    ctx.fillRect(x, h - barH, barW, barH)
  }
}

function tick() {
  if (!canvas.value) return
  const ctx = canvas.value.getContext('2d')
  if (!ctx) return
  const w = canvas.value.width
  const h = canvas.value.height
  if (!props.analyser) {
    drawIdle(ctx, w, h)
    raf = requestAnimationFrame(tick)
    return
  }
  const analyser = props.analyser
  if (!dataArray) {
    bufferLength = analyser.frequencyBinCount
    dataArray = new Uint8Array(new ArrayBuffer(bufferLength))
  }
  analyser.getByteFrequencyData(dataArray)
  ctx.fillStyle = 'rgba(10, 12, 16, 0.4)'
  ctx.fillRect(0, 0, w, h)
  const barCount = Math.min(32, bufferLength)
  const barW = (w / barCount) - 1
  for (let i = 0; i < barCount; i++) {
    const v = dataArray[Math.floor((i / barCount) * bufferLength)] ?? 0
    const barH = Math.max(2, (v / 255) * h * 0.9)
    const x = i * (w / barCount)
    const gradient = ctx.createLinearGradient(0, h, 0, 0)
    gradient.addColorStop(0, '#a78bfa')
    gradient.addColorStop(1, 'rgba(167, 139, 250, 0.5)')
    ctx.fillStyle = gradient
    ctx.fillRect(x, h - barH, barW, barH)
  }
  raf = requestAnimationFrame(tick)
}

function start() {
  if (canvas.value) tick()
}

function stop() {
  if (raf) cancelAnimationFrame(raf)
  raf = 0
}

watch(() => props.analyser, () => {
  stop()
  start()
})

onMounted(() => {
  const el = wrap.value?.parentElement ?? canvas.value?.parentElement
  if (el) width.value = Math.max(120, el.clientWidth - 24)
  start()
})
onUnmounted(stop)
</script>
