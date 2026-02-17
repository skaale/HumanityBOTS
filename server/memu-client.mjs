/**
 * memU Cloud API client for 24/7 proactive memory.
 * See https://github.com/NevaMind-AI/memU — memorize + retrieve to keep agents always-on with lower token cost.
 * Set MEMU_API_KEY (and optional MEMU_API_URL) to enable.
 */

const DEFAULT_MEMU_URL = 'https://api.memu.so'

export function getMemuClient() {
  const apiKey = process.env.MEMU_API_KEY
  const baseUrl = (process.env.MEMU_API_URL || DEFAULT_MEMU_URL).replace(/\/$/, '')
  if (!apiKey) return null

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`
  }

  async function memorize(resourceUrl, modality = 'conversation', user = null) {
    const body = { resource_url: resourceUrl, modality }
    if (user) body.user = user
    const res = await fetch(`${baseUrl}/api/v3/memory/memorize`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`memU memorize ${res.status}: ${t.slice(0, 200)}`)
    }
    return res.json()
  }

  async function retrieve(queries, options = {}) {
    const { where = null, method = 'rag' } = options
    const body = { queries, method }
    if (where) body.where = where
    const res = await fetch(`${baseUrl}/api/v3/memory/retrieve`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`memU retrieve ${res.status}: ${t.slice(0, 200)}`)
    }
    return res.json()
  }

  return { memorize, retrieve, enabled: true }
}
