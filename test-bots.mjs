#!/usr/bin/env node
/**
 * Quick test: health, snapshot, stream first event.
 * Run: node test-bots.mjs
 */
const BASE = 'http://127.0.0.1:3101'

async function testHealth() {
  const r = await fetch(`${BASE}/api/health`)
  const j = await r.json()
  if (!j.ok) throw new Error('Health not ok')
  console.log('OK /api/health')
}

async function testSnapshot() {
  const r = await fetch(`${BASE}/api/snapshot`)
  const j = await r.json()
  const agents = j.agents && typeof j.agents === 'object' ? Object.keys(j.agents) : []
  if (agents.length === 0) throw new Error('No agents in snapshot')
  if (!Array.isArray(j.topics)) throw new Error('topics not array')
  if (!Array.isArray(j.botMessages)) throw new Error('botMessages not array')
  console.log(`OK /api/snapshot (${agents.length} agents, ${j.topics.length} topics, ${j.botMessages.length} messages)`)
  return j
}

async function testStream() {
  const res = await fetch(`${BASE}/api/stream`, { headers: { Accept: 'text/event-stream' } })
  if (!res.ok || !res.body) throw new Error('Stream request failed')
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const match = buf.match(/data: (\{.*?\})\n\n/s)
    if (match) {
      const msg = JSON.parse(match[1])
      if (msg.type === 'snapshot' && msg.data) {
        const d = msg.data
        if (!d.agents || Object.keys(d.agents).length === 0) throw new Error('Stream snapshot had no agents')
        console.log(`OK /api/stream (snapshot: ${Object.keys(d.agents).length} agents, ${(d.topics || []).length} topics)`)
        reader.cancel()
        return d
      }
    }
  }
  throw new Error('Stream timeout: no snapshot event')
}

async function main() {
  console.log('Testing HumanityBOTS backend...')
  await testHealth()
  await testSnapshot()
  await testStream()
  console.log('All bot system checks passed.')
}

main().catch((e) => {
  console.error('FAIL:', e.message)
  process.exit(1)
})
