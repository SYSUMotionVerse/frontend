#!/usr/bin/env node
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const repoRoot = resolve(dirname(new URL(import.meta.url).pathname), '..')
const configPath = resolve(repoRoot, 'scripts/tunnel.config.json')
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const statePath = resolve(repoRoot, config.stateFile)
const logDir = resolve(repoRoot, config.logDir)
const tunnelUrlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i

function ensureRuntimeDir() {
  mkdirSync(logDir, { recursive: true })
}

function readState() {
  if (!existsSync(statePath)) {
    return { services: {} }
  }

  return JSON.parse(readFileSync(statePath, 'utf8'))
}

function writeState(state) {
  ensureRuntimeDir()
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`)
}

function isPidRunning(pid) {
  if (!pid) {
    return false
  }

  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function killPid(pid) {
  if (!isPidRunning(pid)) {
    return
  }

  process.kill(pid, 'SIGTERM')
}

async function fetchOk(url) {
  try {
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

function spawnDetached(command, args, logName, env = {}) {
  ensureRuntimeDir()
  const logPath = resolve(logDir, logName)
  const logFd = openSync(logPath, 'w')
  const child = spawn(command, args, {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, ...env }
  })
  closeSync(logFd)
  child.unref()

  return { child, logPath }
}

async function waitForLocalUrl(url, timeoutMs = 8000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await fetchOk(url)) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }

  return false
}

async function ensureLocalService(serviceName, service, previousState) {
  if (await fetchOk(service.localUrl)) {
    return { ...previousState, localOwned: false }
  }

  if (!service.startCommand) {
    console.warn(`[tunnel] ${service.label} is not reachable at ${service.localUrl}; tunnel will still start.`)
    return { ...previousState, localOwned: false }
  }

  const [command, ...args] = service.startCommand
  const { child, logPath } = spawnDetached(command, args, `${serviceName}.local.log`)
  const ready = await waitForLocalUrl(service.localUrl)

  if (!ready) {
    throw new Error(`${service.label} did not become reachable at ${service.localUrl}. See ${logPath}`)
  }

  return {
    ...previousState,
    localPid: child.pid,
    localOwned: true,
    localLog: logPath
  }
}

async function startTunnel(serviceName, service) {
  const { child, logPath } = spawnDetached(
    'cloudflared',
    ['tunnel', '--url', service.localUrl],
    `${serviceName}.cloudflared.log`
  )

  const startedAt = Date.now()

  while (Date.now() - startedAt < 30000) {
    if (!isPidRunning(child.pid)) {
      throw new Error(`cloudflared exited before creating ${serviceName} tunnel. See ${logPath}`)
    }

    const output = existsSync(logPath) ? readFileSync(logPath, 'utf8') : ''
    const matched = output.match(tunnelUrlPattern)
    if (matched) {
      return {
        tunnelPid: child.pid,
        tunnelUrl: matched[0],
        tunnelLog: logPath
      }
    }

    await new Promise(resolve => setTimeout(resolve, 500))
  }

  throw new Error(`Timed out waiting for ${serviceName} tunnel URL. See ${logPath}`)
}

function hasNamedTunnelConfig() {
  return Boolean(config.namedTunnel?.name && config.namedTunnel?.id)
}

function cloudflaredNamedTunnelConfig() {
  const tunnelConfigPath = resolve(repoRoot, config.namedTunnel.configFile)
  const credentialsFile = config.namedTunnel.credentialsFile
  const ingress = Object.values(config.services)
    .filter(service => service.hostname)
    .map(service => {
      const lines = [
        `  - hostname: ${service.hostname}`,
        `    service: ${service.localUrl}`
      ]
      if (service.originHostHeader) {
        lines.push('    originRequest:')
        lines.push(`      httpHostHeader: ${service.originHostHeader}`)
      }
      return lines.join('\n')
    })
    .join('\n')
  const content = [
    `tunnel: ${config.namedTunnel.id}`,
    credentialsFile ? `credentials-file: ${credentialsFile}` : '',
    'ingress:',
    ingress,
    '  - service: http_status:404',
    ''
  ].filter(Boolean).join('\n')

  ensureRuntimeDir()
  writeFileSync(tunnelConfigPath, content)
  return tunnelConfigPath
}

async function startNamedTunnel() {
  const tunnelConfigPath = cloudflaredNamedTunnelConfig()
  const { child, logPath } = spawnDetached(
    'cloudflared',
    ['tunnel', '--config', tunnelConfigPath, 'run', config.namedTunnel.name],
    'named.cloudflared.log'
  )

  await new Promise(resolve => setTimeout(resolve, 1500))
  if (!isPidRunning(child.pid)) {
    throw new Error(`cloudflared named tunnel exited early. See ${logPath}`)
  }

  return {
    tunnelPid: child.pid,
    tunnelLog: logPath
  }
}

async function startNamed() {
  ensureRuntimeDir()
  const state = readState()
  const namedState = state.namedTunnel
  const nextState = { services: {}, createdAt: new Date().toISOString() }

  for (const [serviceName, service] of Object.entries(config.services)) {
    const existing = state.services?.[serviceName]
    const localState = await ensureLocalService(serviceName, service, existing ?? {})
    nextState.services[serviceName] = {
      ...localState,
      localUrl: service.localUrl,
      envName: service.envName,
      apiPath: service.apiPath ?? '',
      label: service.label,
      hostname: service.hostname,
      tunnelUrl: service.hostname ? `https://${service.hostname}` : existing?.tunnelUrl
    }
  }

  if (namedState?.tunnelPid && isPidRunning(namedState.tunnelPid)) {
    nextState.namedTunnel = namedState
  } else {
    nextState.namedTunnel = await startNamedTunnel()
  }

  writeState(nextState)
  printEnv(nextState)
}

async function start() {
  if (hasNamedTunnelConfig()) {
    await startNamed()
    return
  }

  ensureRuntimeDir()
  const state = readState()
  const nextState = { services: {}, createdAt: new Date().toISOString() }

  for (const [serviceName, service] of Object.entries(config.services)) {
    const existing = state.services?.[serviceName]
    if (existing?.tunnelUrl && isPidRunning(existing.tunnelPid)) {
      nextState.services[serviceName] = existing
      console.log(`[tunnel] ${serviceName}: ${existing.tunnelUrl}`)
      continue
    }

    const localState = await ensureLocalService(serviceName, service, existing ?? {})
    const tunnelState = await startTunnel(serviceName, service)
    nextState.services[serviceName] = {
      ...localState,
      ...tunnelState,
      localUrl: service.localUrl,
      envName: service.envName,
      apiPath: service.apiPath ?? '',
      label: service.label
    }
    console.log(`[tunnel] ${serviceName}: ${tunnelState.tunnelUrl}`)
  }

  writeState(nextState)
  printEnv(nextState)
}

function printEnv(state = readState()) {
  for (const [serviceName, service] of Object.entries(config.services)) {
    const serviceState = state.services?.[serviceName]
    if (!serviceState?.tunnelUrl) {
      continue
    }

    const value = `${serviceState.tunnelUrl}${service.apiPath ?? ''}`
    console.log(`${service.envName}=${value}`)
  }
}

function isServiceTunnelRunning(state, serviceState) {
  if (hasNamedTunnelConfig()) {
    return isPidRunning(state.namedTunnel?.tunnelPid)
  }

  return isPidRunning(serviceState?.tunnelPid)
}

function status() {
  const state = readState()
  for (const [serviceName, service] of Object.entries(config.services)) {
    const serviceState = state.services?.[serviceName]
    const tunnelRunning = isServiceTunnelRunning(state, serviceState)
    const localRunning = serviceState?.localPid ? isPidRunning(serviceState.localPid) : undefined
    const url = serviceState?.tunnelUrl ? `${serviceState.tunnelUrl}${service.apiPath ?? ''}` : '(none)'

    console.log(`${serviceName}: tunnel=${tunnelRunning ? 'running' : 'stopped'} local=${localRunning ?? 'external'} url=${url}`)
  }
}

function stop() {
  const state = readState()

  for (const [serviceName, serviceState] of Object.entries(state.services ?? {})) {
    if (!hasNamedTunnelConfig()) {
      killPid(serviceState.tunnelPid)
    }
    if (serviceState.localOwned) {
      killPid(serviceState.localPid)
    }
    console.log(`[tunnel] stopped ${serviceName}`)
  }

  if (hasNamedTunnelConfig()) {
    killPid(state.namedTunnel?.tunnelPid)
    console.log('[tunnel] stopped namedTunnel')
  }

  if (existsSync(statePath)) {
    rmSync(statePath)
  }
}

async function dev() {
  const env = await resolveTunnelEnv()
  const child = spawn('pnpm', ['dev'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env
  })

  child.on('exit', code => {
    process.exit(code ?? 0)
  })
}

async function resolveTunnelEnv() {
  const state = readState()
  const missing = hasNamedTunnelConfig()
    ? !isPidRunning(state.namedTunnel?.tunnelPid)
      ? ['namedTunnel']
      : []
    : Object.keys(config.services).filter(serviceName => {
        const serviceState = state.services?.[serviceName]
        return !serviceState?.tunnelUrl || !isPidRunning(serviceState.tunnelPid)
      })

  if (missing.length > 0) {
    await start()
  }

  const latestState = readState()
  const env = { ...process.env }
  for (const [serviceName, service] of Object.entries(config.services)) {
    const serviceState = latestState.services?.[serviceName]
    if (serviceState?.tunnelUrl) {
      env[service.envName] = `${serviceState.tunnelUrl}${service.apiPath ?? ''}`
    }
  }

  return env
}

async function build() {
  const env = await resolveTunnelEnv()
  const child = spawn('pnpm', ['build:mp-weixin'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env
  })

  child.on('exit', code => {
    process.exit(code ?? 0)
  })
}

const command = process.argv[2] ?? 'status'

try {
  if (command === 'start') {
    await start()
  } else if (command === 'stop') {
    stop()
  } else if (command === 'status') {
    status()
  } else if (command === 'dev') {
    await dev()
  } else if (command === 'build') {
    await build()
  } else {
    throw new Error(`Unknown command: ${command}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
