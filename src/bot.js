import fs from 'node:fs'
import mineflayer from 'mineflayer'

const env = process.env
const healthFile = env.HEALTH_FILE || '/tmp/mineflayer-healthy'
const levels = { debug: 10, info: 20, warn: 30, error: 40 }
const configuredLevel = levels[(env.LOG_LEVEL || 'info').toLowerCase()] ?? levels.info

function log(level, message, extra = undefined) {
  if ((levels[level] ?? levels.info) < configuredLevel) return
  const entry = { time: new Date().toISOString(), level, message }
  if (extra !== undefined) entry.extra = extra
  console.log(JSON.stringify(entry))
}

function integer(name, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`)
  }
  return value
}

function number(name, fallback, min = 0) {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min) throw new Error(`${name} must be a number >= ${min}`)
  return value
}

function boolean(name, fallback) {
  const raw = env[name]
  if (raw === undefined || raw === '') return fallback
  if (/^(1|true|yes|on)$/i.test(raw)) return true
  if (/^(0|false|no|off)$/i.test(raw)) return false
  throw new Error(`${name} must be true or false`)
}

const config = {
  host: env.MC_HOST || 'minecraft',
  port: integer('MC_PORT', 25565, 1, 65535),
  username: env.MC_USERNAME || 'MineflayerBot',
  auth: (env.MC_AUTH || 'offline').toLowerCase(),
  version: env.MC_VERSION || false,
  password: env.MC_PASSWORD || undefined,
  reconnect: boolean('RECONNECT', true),
  initialDelay: integer('RECONNECT_INITIAL_MS', 2000, 100),
  maxDelay: integer('RECONNECT_MAX_MS', 30000, 100),
  factor: number('RECONNECT_FACTOR', 2, 1)
}

if (!['offline', 'microsoft'].includes(config.auth)) throw new Error('MC_AUTH must be offline or microsoft')
if (config.maxDelay < config.initialDelay) throw new Error('RECONNECT_MAX_MS must be >= RECONNECT_INITIAL_MS')

let bot
let stopping = false
let reconnectTimer
let attempts = 0

function healthy(value) {
  try {
    if (value) fs.writeFileSync(healthFile, `${Date.now()}\n`, { mode: 0o600 })
    else fs.rmSync(healthFile, { force: true })
  } catch (error) {
    log('warn', 'Unable to update health marker', error.message)
  }
}

function scheduleReconnect(reason) {
  healthy(false)
  if (stopping || !config.reconnect || reconnectTimer) return
  const delay = Math.min(config.maxDelay, Math.round(config.initialDelay * config.factor ** attempts))
  attempts += 1
  log('warn', `Disconnected (${reason}); reconnecting in ${delay} ms`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined
    connect()
  }, delay)
}

function connect() {
  if (stopping) return
  healthy(false)
  log('info', `Connecting to ${config.host}:${config.port}`, { username: config.username, auth: config.auth })

  const options = {
    host: config.host,
    port: config.port,
    username: config.username,
    auth: config.auth,
    version: config.version,
    profilesFolder: '/data'
  }
  if (config.password) options.password = config.password

  bot = mineflayer.createBot(options)
  let sessionEnded = false

  bot.once('login', () => {
    attempts = 0
    healthy(true)
    log('info', 'Logged in to Minecraft server')
  })

  bot.on('kicked', reason => log('warn', 'Kicked by server', reason))
  bot.on('error', error => log('error', 'Mineflayer error', error.message))
  bot.once('end', reason => {
    if (sessionEnded) return
    sessionEnded = true
    scheduleReconnect(reason || 'connection ended')
  })
}

function shutdown(signal) {
  if (stopping) return
  stopping = true
  healthy(false)
  if (reconnectTimer) clearTimeout(reconnectTimer)
  log('info', `Received ${signal}; shutting down`)
  try { bot?.quit('Container shutting down') } catch {}
  const timer = setTimeout(() => process.exit(0), 1500)
  timer.unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', error => {
  healthy(false)
  log('error', 'Uncaught exception', error.stack || error.message)
  process.exit(1)
})
process.on('unhandledRejection', error => {
  healthy(false)
  log('error', 'Unhandled rejection', error instanceof Error ? error.stack : String(error))
  process.exit(1)
})

connect()
