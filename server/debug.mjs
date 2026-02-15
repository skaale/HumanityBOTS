/**
 * Debug logging — set DEBUG=1 or LOG_LEVEL=debug to enable.
 * Examples: DEBUG=1 node server/index.mjs  or  set DEBUG=1 && npm run server
 */

const enabled = process.env.DEBUG === '1' || process.env.DEBUG === 'true' || (process.env.LOG_LEVEL || '').toLowerCase() === 'debug'

export function log(namespace, ...args) {
  if (enabled) console.log(`[${namespace}]`, ...args)
}

export function debugStream(...args) { log('stream', ...args) }
export function debugThinker(...args) { log('thinker', ...args) }
export function debugApi(...args) { log('api', ...args) }
export function debugRegistry(...args) { log('registry', ...args) }
export function debugLLM(...args) { log('llm', ...args) }
export function debugOpenClaw(...args) { log('openclaw', ...args) }
