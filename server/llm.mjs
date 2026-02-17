/**
 * Unified LLM — Ollama, Open WebUI (e.g. Qwen 3 - Coder 30B), Groq, or Anthropic.
 * Order: OLLAMA_BASE_URL → OPENWEBUI_API_URL → GROQ_API_KEY → ANTHROPIC_API_KEY.
 */

import { debugLLM } from './debug.mjs'

export function hasLLM() {
  return !!(process.env.OLLAMA_BASE_URL || process.env.OPENWEBUI_API_URL || process.env.GROQ_API_KEY || process.env.ANTHROPIC_API_KEY)
}

export function getLLMBackend() {
  if (process.env.OLLAMA_BASE_URL) return 'ollama'
  if (process.env.OPENWEBUI_API_URL) return 'openwebui'
  if (process.env.GROQ_API_KEY) return 'groq'
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic'
  return null
}

export async function callLLM(system, user, options = {}) {
  const maxTokens = options.maxTokens ?? 600
  const baseUrl = (process.env.OLLAMA_BASE_URL || '').replace(/\/$/, '')

  if (baseUrl) {
    try {
      const model = process.env.OLLAMA_MODEL || 'llama3.2'
      debugLLM('call ollama', model)
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ],
          stream: false,
          options: { num_predict: maxTokens }
        })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const text = data.message?.content ?? ''
      debugLLM('ollama ok', text?.length, 'chars')
      return { text, backend: 'ollama', model }
    } catch (e) {
      debugLLM('ollama error', e.message)
      return { text: null, backend: 'ollama', error: e.message }
    }
  }

  const openWebUiUrl = (process.env.OPENWEBUI_API_URL || '').replace(/\/$/, '')
  if (openWebUiUrl) {
    try {
      const model = process.env.OPENWEBUI_MODEL || 'Qwen 3 - Coder 30B'
      const headers = { 'Content-Type': 'application/json' }
      if (process.env.OPENWEBUI_API_KEY) headers.Authorization = `Bearer ${process.env.OPENWEBUI_API_KEY}`
      debugLLM('call openwebui', model)
      const res = await fetch(`${openWebUiUrl}/api/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content ?? ''
      debugLLM('openwebui ok', text?.length, 'chars')
      return { text, backend: 'openwebui', model }
    } catch (e) {
      debugLLM('openwebui error', e.message)
      return { text: null, backend: 'openwebui', error: e.message }
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant'
      debugLLM('call groq', model)
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const text = data.choices?.[0]?.message?.content ?? ''
      debugLLM('groq ok', text?.length, 'chars')
      return { text, backend: 'groq', model }
    } catch (e) {
      debugLLM('groq error', e.message)
      return { text: null, backend: 'groq', error: e.message }
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const model = process.env.ANTHROPIC_MODEL || process.env.ASSISTANT_MODEL || 'claude-3-5-haiku-20241022'
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: user }]
        })
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const text = data.content?.[0]?.text ?? ''
      debugLLM('anthropic ok', text?.length, 'chars')
      return { text, backend: 'anthropic', model: data.model }
    } catch (e) {
      debugLLM('anthropic error', e.message)
      return { text: null, backend: 'anthropic', error: e.message }
    }
  }

  debugLLM('no LLM configured')
  return { text: null, backend: null, error: 'No LLM configured. Set OLLAMA_BASE_URL, GROQ_API_KEY, or ANTHROPIC_API_KEY.' }
}
