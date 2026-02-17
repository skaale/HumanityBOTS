/**
 * 24/7 Thinker — reasons about the current topic and code with an LLM,
 * then posts messages and code so the session keeps thinking together.
 * Set THINKER_ENABLED=1 and one of: OLLAMA_BASE_URL (free), GROQ_API_KEY (free), ANTHROPIC_API_KEY.
 */

import { callLLM, hasLLM } from './llm.mjs'
import { debugThinker } from './debug.mjs'

const THINKER_ID = 'humanity-thinker'
const THINKER_NAME = 'Thinker'
const DEFAULT_INTERVAL_MS = 4 * 60 * 1000

function buildThinkPrompt(memory) {
  const { currentTopic, codeBuffer, codeEdits, recentMessages, topics, agentsOnline, thinkerMemoryLog, memuContext } = memory || {}
  const topicBlock = currentTopic
    ? `Current topic: ${currentTopic.title}\nProblem: ${currentTopic.problem || ''}\n${currentTopic.body || ''}`
    : 'No topic yet. We need to propose one.'
  const codeBlock = codeBuffer
    ? `Current code:\n\`\`\`\n${codeBuffer.slice(-6000)}\n\`\`\``
    : 'No code yet.'
  const discussion = (recentMessages && recentMessages.length)
    ? `Recent discussion:\n${recentMessages.slice(-25).map((m) => `${m.fromName}: ${m.text}`).join('\n')}`
    : 'No discussion yet.'
  const memuBlock = (memuContext && memuContext.length)
    ? `MemU long-term context:\n${memuContext.slice(0, 25).join('\n')}`
    : ''
  const memoryBlock = (thinkerMemoryLog && thinkerMemoryLog.length)
    ? `Growing memory (chronological — from Clawbots and you):\n${thinkerMemoryLog.slice(-40).join('\n')}`
    : 'No memory yet.'
  const others = (agentsOnline && agentsOnline.length)
    ? agentsOnline.filter((a) => a.id !== THINKER_ID).map((a) => a.name || a.id)
    : []
  const team = others.length ? `Teammates: ${others.join(', ')}.` : 'You are the first. Start the conversation and code.'

  const lastSpeaker = (recentMessages && recentMessages.length) ? recentMessages[recentMessages.length - 1] : null
  const replyHint = lastSpeaker && lastSpeaker.fromId !== THINKER_ID
    ? `A teammate (${lastSpeaker.fromName}) just spoke. Acknowledge or reply to them by name, then add your thought or next step.`
    : ''

  return {
    system: `You are the Thinker, a Clawbot in a 24/7 HumanityBOTS session. You have a growing memory of what Clawbots and you said and did — use it to stay consistent and build on the conversation. Your job is to think step by step about solving the current humanity problem and to collaborate on code. Be concise. When a teammate just spoke, reply to them by name when relevant.
Output exactly two parts on separate lines:
MESSAGE: (one short message — reply to the team or a specific Clawbot by name, ask a question, or propose the next step; 1-2 sentences)
CODE: (1-8 lines of Python that fit the current code and topic — prefer adding at least a stub, import, or function when the buffer is small or empty; only write CODE: none when you truly have nothing to add)
If there is no current topic, output only: MESSAGE: (suggest one concrete problem we could code) and CODE: none`,
    user: `${topicBlock}\n\n${codeBlock}\n\n${memuBlock ? memuBlock + '\n\n' : ''}${memoryBlock}\n\n${discussion}\n\n${team}${replyHint ? '\n\n' + replyHint : ''}\n\nThink step by step, then output MESSAGE: and CODE: as above.`
  }
}

function buildTopicPrompt(memory) {
  const { topics, recentMessages, thinkerMemoryLog } = memory || {}
  const existing = (topics || []).map((t) => t.title).slice(0, 8).join(', ')
  const memHint = (thinkerMemoryLog && thinkerMemoryLog.length) ? `Memory so far: ${thinkerMemoryLog.slice(-15).join('; ')}. ` : ''
  return {
    system: 'You are a Clawbot proposing a humanity problem to code on. Output a single line: TITLE: (short title) then on next line BODY: (one paragraph describing the problem and why code would help). Focus: environment, health, education, infrastructure, or equity.',
    user: `${memHint}Existing topics: ${existing || 'none'}. Recent: ${(recentMessages || []).slice(-5).map((m) => m.text).join(' ')}. Propose one new concrete problem we could build code for. Output TITLE: ... and BODY: ...`
  }
}

async function thinkLLM(system, user, maxTokens = 600) {
  const { text } = await callLLM(system, user, { maxTokens })
  return text
}

function parseThinkResponse(text) {
  let message = ''
  let code = null
  if (!text) return { message, code }
  const msgMatch = text.match(/MESSAGE:\s*([\s\S]*?)(?=CODE:|$)/i)
  if (msgMatch) message = msgMatch[1].replace(/^[\s\n]+|[\s\n]+$/g, '').slice(0, 500)
  const codeMatch = text.match(/CODE:\s*([\s\S]*?)$/im)
  if (codeMatch) {
    const raw = codeMatch[1].replace(/^[\s\n]+|[\s\n]+$/g, '').replace(/^```\w*\n?|\n?```$/g, '')
    if (raw && raw.toLowerCase() !== 'none') code = raw.slice(0, 2000)
  }
  return { message, code }
}

function parseTopicResponse(text) {
  let title = ''
  let body = ''
  if (!text) return { title, body }
  const titleMatch = text.match(/TITLE:\s*(.+?)(?=\n|BODY:|$)/is)
  if (titleMatch) title = titleMatch[1].trim().slice(0, 200)
  const bodyMatch = text.match(/BODY:\s*([\s\S]*?)$/im)
  if (bodyMatch) body = bodyMatch[1].trim().slice(0, 1500)
  return { title, body }
}

export function startThinker(humanStream, options = {}) {
  const enabled = options.enabled ?? (process.env.THINKER_ENABLED !== '0')
  const intervalMs = Number(options.intervalMs ?? process.env.THINKER_INTERVAL_MS ?? DEFAULT_INTERVAL_MS)
  const agentId = options.agentId ?? THINKER_ID
  const agentName = options.agentName ?? THINKER_NAME

  if (!enabled) return { stop: () => {}, runOnce: () => {} }

  humanStream.registerAgent({
    id: agentId,
    name: agentName,
    emoji: '🧠',
    focus: 'Reasoning about topics and code',
    intro: `${agentName} here — I'll think through the problem and code with the team 24/7.`,
    source: 'openclaw'
  })

  let timer = null
  let running = false

  const memuClient = options.memuClient || null

  async function tick() {
    if (running || !hasLLM()) return
    running = true
    debugThinker('tick start')
    try {
      let memory = humanStream.getMemoryForBots()
      if (memuClient?.enabled) {
        try {
          const query = memory.currentTopic
            ? `Current humanity topic: ${memory.currentTopic.title}. Recent decisions and code context.`
            : 'HumanityBOTS session: topics, agent intents, and code so far.'
          const out = await memuClient.retrieve([{ role: 'user', content: { text: query } }], { method: 'rag' })
          const items = (out.items || []).map((i) => (typeof i === 'string' ? i : i?.content ?? i?.text ?? '')).filter(Boolean)
          if (items.length) memory = { ...memory, memuContext: items }
        } catch (_) {}
      }
      const hasTopic = !!memory.currentTopicId && !!memory.currentTopic
      debugThinker('hasTopic', hasTopic, 'currentTopicId', memory.currentTopicId)

      if (hasTopic) {
        const { system, user } = buildThinkPrompt(memory)
        const text = await thinkLLM(system, user)
        const { message, code } = parseThinkResponse(text)
        debugThinker('LLM response', message ? message.slice(0, 60) : null, 'code', code ? code.slice(0, 40) : null)
        if (message) {
          humanStream.addBotMessageFromBot({
            fromId: agentId,
            fromName: agentName,
            text: message
          })
        }
        if (code) {
          humanStream.appendCodeFromBot({
            agentId,
            agentName,
            text: code
          })
        }
      } else {
        const { system, user } = buildTopicPrompt(memory)
        const text = await thinkLLM(system, user, 400)
        const { title, body } = parseTopicResponse(text)
        debugThinker('propose topic', title || '(none)')
        if (title) {
          humanStream.addTopicFromBot({
            agentId,
            agentName,
            title,
            body,
            problem: title,
            committedBots: [agentId]
          })
        }
      }
    } catch (e) {
      debugThinker('tick error', e.message)
    }
    running = false
  }

  timer = setInterval(tick, intervalMs)
  setTimeout(tick, 15000)

  function runOnce() {
    tick()
  }

  function stop() {
    if (timer) clearInterval(timer)
    timer = null
  }

  return { stop, runOnce }
}

export const THINKER_AGENT_ID = 'humanity-thinker'
