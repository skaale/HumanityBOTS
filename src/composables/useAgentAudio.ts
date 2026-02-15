import { ref, shallowRef } from 'vue'

let ctx: AudioContext | null = null
let analyser: AnalyserNode | null = null
const analyserRef = shallowRef<AnalyserNode | null>(null)
const muteAll = ref(false)
let unlocked = false

function getContext(): { ctx: AudioContext; analyser: AnalyserNode } {
  if (ctx && analyser) return { ctx, analyser }
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  ctx = new Ctx()
  analyser = ctx.createAnalyser()
  analyser.fftSize = 128
  analyser.smoothingTimeConstant = 0.6
  analyser.connect(ctx.destination)
  analyserRef.value = analyser
  return { ctx, analyser }
}

export function useAgentAudio() {
  async function unlockAudio() {
    if (unlocked) return true
    try {
      const { ctx: c } = getContext()
      if (c.state === 'suspended') await c.resume()
      unlocked = c.state === 'running'
      return unlocked
    } catch {
      return false
    }
  }

  async function playEditSound() {
    if (muteAll.value || !unlocked) return
    try {
      const { ctx: c, analyser: a } = getContext()
      if (c.state === 'suspended') return
      const g = c.createGain()
      g.connect(a)
      g.gain.setValueAtTime(0.12, c.currentTime)
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.1)
      const o = c.createOscillator()
      o.connect(g)
      o.frequency.value = 520
      o.type = 'sine'
      o.start(c.currentTime)
      o.stop(c.currentTime + 0.1)
    } catch (_) {}
  }

  async function playCommsSound() {
    if (muteAll.value || !unlocked) return
    try {
      const { ctx: c, analyser: a } = getContext()
      if (c.state === 'suspended') return
      const g = c.createGain()
      g.connect(a)
      g.gain.setValueAtTime(0.25, c.currentTime)
      g.gain.exponentialRampToValueAtTime(0.02, c.currentTime + 0.5)
      const o1 = c.createOscillator()
      const o2 = c.createOscillator()
      o1.connect(g)
      o2.connect(g)
      o1.frequency.value = 440
      o2.frequency.value = 554
      o1.type = 'sine'
      o2.type = 'sine'
      o1.start(c.currentTime)
      o2.start(c.currentTime + 0.1)
      o1.stop(c.currentTime + 0.25)
      o2.stop(c.currentTime + 0.4)
    } catch (_) {}
  }

  function speakMessage(text: string, maxLen = 200) {
    if (muteAll.value || !text?.trim()) return
    try {
      if (typeof window.speechSynthesis === 'undefined') return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text.slice(0, maxLen))
      u.rate = 1.0
      u.pitch = 1.0
      u.volume = 1
      const voices = window.speechSynthesis.getVoices()
      const en = voices.find((v) => v.lang.startsWith('en'))
      if (en) u.voice = en
      window.speechSynthesis.speak(u)
    } catch (_) {}
  }

  function speakThinker(text: string) {
    if (muteAll.value || !text?.trim()) return
    speakMessage(`Thinker: ${text}`, 400)
  }

  return {
    analyserRef,
    muteAll,
    unlocked: () => unlocked,
    get analyser() {
      return analyserRef.value ?? getContext().analyser
    },
    unlockAudio,
    playEditSound,
    playCommsSound,
    speakMessage,
    speakThinker
  }
}
