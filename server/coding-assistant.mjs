/**
 * Coding assistant — uses memory API context to suggest or improve code via an LLM.
 * Supports Ollama (free, no key), Groq (free key), or Anthropic. See server/llm.mjs.
 */

import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { callLLM, hasLLM } from './llm.mjs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'data')
const LOG_FILE = join(DATA_DIR, 'assistant-log.jsonl')

function buildPrompt(memory, request) {
  const { currentTopic, codeBuffer, codeEdits, recentMessages, topics, agentsOnline } = memory || {}
  const topicLine = currentTopic
    ? `Current topic: ${currentTopic.title} — ${currentTopic.problem || ''}\n${currentTopic.body || ''}`
    : 'No topic selected.'
  const codeSection = codeBuffer
    ? `Current code:\n\`\`\`\n${codeBuffer.slice(-6000)}\n\`\`\``
    : 'No code yet.'
  const recentEdits = (codeEdits && codeEdits.length)
    ? `Last edits:\n${codeEdits.slice(-8).map((e) => `- ${e.agentName}: ${e.text?.slice(0, 80)}`).join('\n')}`
    : ''
  const discussion = (recentMessages && recentMessages.length)
    ? `Recent discussion:\n${recentMessages.slice(-12).map((m) => `- ${m.fromName}: ${m.text}`).join('\n')}`
    : ''
  const agents = (agentsOnline && agentsOnline.length)
    ? `Agents online: ${agentsOnline.map((a) => a.name || a.id).join(', ')}`
    : ''
  const userRequest = request && String(request).trim() ? `\nRequest: ${request}` : '\nSuggest the next logical code snippet to add (1–10 lines). Output only code, no markdown fences or explanation.'

  return {
    system: `You are a coding assistant in a collaborative session. Humanity focus: real problems (environment, health, education, infrastructure, equity). Output only valid code that fits the existing buffer. Prefer Python. No commentary unless the request asks for it.`,
    user: `${topicLine}\n\n${codeSection}\n\n${recentEdits}\n\n${discussion}\n\n${agents}${userRequest}`
  }
}

function logInteraction(entry) {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    appendFileSync(LOG_FILE, JSON.stringify({ ...entry, ts: Date.now() }) + '\n', 'utf8')
  } catch (_) {}
}

export async function suggestCode(memory, request = '') {
  if (!hasLLM()) {
    logInteraction({ type: 'suggest', request, placeholder: true, error: 'No LLM configured' })
    return {
      suggestion: null,
      placeholder: true,
      error: 'Set OLLAMA_BASE_URL (free), GROQ_API_KEY (free tier), or ANTHROPIC_API_KEY.'
    }
  }

  const { system, user } = buildPrompt(memory, request)
  try {
    const { text, backend, model, error } = await callLLM(system, user, { maxTokens: 512 })
    if (error) {
      logInteraction({ type: 'suggest', request, error })
      return { suggestion: null, error }
    }
    const suggestion = text ? text.replace(/^```\w*\n?|\n?```$/g, '').trim() : null
    logInteraction({
      type: 'suggest',
      request,
      contextSummary: { topic: memory?.currentTopic?.title, bufferLines: memory?.codeBuffer?.split('\n').length },
      suggestionLength: suggestion?.length,
      backend,
      model
    })
    return { suggestion, model, backend }
  } catch (e) {
    logInteraction({ type: 'suggest', request, error: e.message })
    return { suggestion: null, error: e.message }
  }
}
