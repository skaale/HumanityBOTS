#!/usr/bin/env node
/**
 * HumanityBOTS — API + SSE server
 * Serves snapshot/stream for agents, humanity topics, and live code buffer.
 * Run: node server/index.mjs (port 3101) or use npm run server.
 */

import http from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { fileURLToPath } from 'url'
import { HumanStream } from './human-stream.mjs'
import { suggestCode } from './coding-assistant.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PORT = parseInt(process.env.PORT || '3101', 10)
const DIR = join(__dirname, '..')
const DIST = join(DIR, 'dist')
const STATIC_DIR = existsSync(join(DIST, 'index.html')) ? DIST : DIR

const humanStream = new HumanStream()

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json',
  '.js': 'application/javascript',
  '.ts': 'application/javascript',
  '.vue': 'application/javascript',
  '.css': 'text/css',
  '.ico': 'image/x-icon'
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)
  const pathname = url.pathname

  if (pathname === '/api/stream') {
    humanStream.handleSSE(req, res)
    return
  }

  if (pathname === '/api/snapshot') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(humanStream.getSnapshot()))
    return
  }

  if (pathname === '/api/memory') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(humanStream.getMemoryForBots()))
    return
  }

  if (req.method === 'GET' && pathname === '/api/code') {
    const snap = humanStream.getSnapshot()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ buffer: snap.codeBuffer, edits: snap.codeEdits, currentTopicId: snap.currentTopicId }))
    return
  }

  if (req.method === 'POST' && pathname === '/api/assistant/suggest') {
    readJsonBody(req).then(async (body) => {
      const memory = humanStream.getMemoryForBots()
      const out = await suggestCode(memory, body?.request)
      const apply = url.searchParams.get('apply') === '1' && out.suggestion && body?.agentId
      if (apply) {
        humanStream.appendCodeFromBot({
          agentId: body.agentId,
          agentName: body.agentName || body.agentId,
          text: out.suggestion
        })
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ...out, applied: !!apply }))
    }).catch((e) => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Bad request' }))
    })
    return
  }

  if (req.method === 'POST' && pathname === '/api/agent') {
    readJsonBody(req).then((body) => {
      const ok = humanStream.registerAgent(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok }))
    }).catch((e) => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Bad request' }))
    })
    return
  }

  if (req.method === 'POST' && pathname === '/api/topic') {
    readJsonBody(req).then((body) => {
      const ok = humanStream.addTopicFromBot(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok }))
    }).catch((e) => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Bad request' }))
    })
    return
  }

  if (req.method === 'POST' && pathname === '/api/code') {
    readJsonBody(req).then((body) => {
      const ok = humanStream.appendCodeFromBot(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok }))
    }).catch((e) => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Bad request' }))
    })
    return
  }

  if (req.method === 'POST' && pathname === '/api/message') {
    readJsonBody(req).then((body) => {
      const ok = humanStream.addBotMessageFromBot(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok }))
    }).catch((e) => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Bad request' }))
    })
    return
  }

  if (req.method === 'POST' && pathname === '/api/hardware') {
    readJsonBody(req).then((body) => {
      const ok = humanStream.addHardwareFromBot(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok }))
    }).catch((e) => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Bad request' }))
    })
    return
  }

  const topicVoteMatch = pathname.match(/^\/api\/topic\/([^/]+)\/vote$/)
  if (req.method === 'POST' && topicVoteMatch) {
    readJsonBody(req).then((body) => {
      const ok = humanStream.voteTopic(topicVoteMatch[1], body?.agentId)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok }))
    }).catch((e) => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Bad request' }))
    })
    return
  }

  const topicCommitMatch = pathname.match(/^\/api\/topic\/([^/]+)\/commit$/)
  if (req.method === 'POST' && topicCommitMatch) {
    readJsonBody(req).then((body) => {
      const ok = humanStream.commitToTopic(topicCommitMatch[1], body?.agentId)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok }))
    }).catch((e) => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Bad request' }))
    })
    return
  }

  if (req.method === 'POST' && pathname === '/api/topic/current') {
    readJsonBody(req).then((body) => {
      const ok = humanStream.setCurrentTopicById(body?.topicId)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok }))
    }).catch((e) => {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Bad request' }))
    })
    return
  }

  if (pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, ts: Date.now() }))
    return
  }

  if (pathname === '/api/myip') {
    const forwarded = req.headers['x-forwarded-for']
    const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null) || req.socket?.remoteAddress || ''
    const cleanIp = ip.replace(/^::ffff:/, '')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    if (!cleanIp || cleanIp === '::1' || cleanIp.startsWith('127.')) {
      res.end(JSON.stringify({ ip: cleanIp || '127.0.0.1', country: 'Local', region: '', city: '' }))
      return
    }
    fetch(`http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=country,countryCode,regionName,city,query`)
      .then((r) => r.json())
      .then((data) => {
        res.end(JSON.stringify({
          ip: data.query || cleanIp,
          country: data.country || '',
          countryCode: data.countryCode || '',
          region: data.regionName || '',
          city: data.city || ''
        }))
      })
      .catch(() => {
        res.end(JSON.stringify({ ip: cleanIp, country: '', region: '', city: '' }))
      })
    return
  }

  if (pathname.startsWith('/api/') && pathname !== '/api/stream') {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  const filePath = pathname === '/' ? join(STATIC_DIR, 'index.html') : join(STATIC_DIR, pathname.slice(1))
  if (existsSync(filePath)) {
    const ext = extname(filePath)
    const type = MIME[ext] || 'application/octet-stream'
    res.writeHead(200, { 'Content-Type': type })
    res.end(readFileSync(filePath))
    return
  }
  if (STATIC_DIR === DIST) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(readFileSync(join(STATIC_DIR, 'index.html')))
    return
  }
  res.writeHead(404)
  res.end('Not found')
})

humanStream.start()
server.listen(PORT, '0.0.0.0', () => {
  console.log(`HumanityBOTS listening on port ${PORT} (static: ${STATIC_DIR === DIST ? 'dist' : 'root'})`)
})

function shutdown() {
  humanStream.stop()
  server.close(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
