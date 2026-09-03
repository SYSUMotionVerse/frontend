import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

function resolveKnownHostsFile() {
  const configuredPath = process.env.GUIDANCE_TTS_KNOWN_HOSTS?.trim()
  if (!configuredPath) {
    throw new Error(
      'Set GUIDANCE_TTS_KNOWN_HOSTS to a reviewed known_hosts file before connecting to production.'
    )
  }

  const knownHostsFile = resolve(configuredPath)
  if (!existsSync(knownHostsFile)) {
    throw new Error(`GUIDANCE_TTS_KNOWN_HOSTS does not exist: ${knownHostsFile}`)
  }
  return knownHostsFile
}

function run(command, argumentsList) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, argumentsList, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', value => {
      stdout += value
    })
    child.stderr.on('data', value => {
      stderr += value
    })
    child.on('error', rejectPromise)
    child.on('close', code => {
      if (code === 0) {
        resolvePromise(stdout)
        return
      }
      rejectPromise(new Error(`${command} exited with ${code}: ${stderr.trim()}`))
    })
  })
}

export function runVerifiedSsh({ host, user, remoteCommand }) {
  const knownHostsFile = resolveKnownHostsFile()
  const hasPassword = Boolean(process.env.SSHPASS?.trim())
  const command = hasPassword ? 'sshpass' : 'ssh'
  const prefix = hasPassword
    ? ['-e', 'ssh', '-o', 'PreferredAuthentications=password', '-o', 'PubkeyAuthentication=no']
    : ['-o', 'BatchMode=yes']
  return run(command, [
    ...prefix,
    '-o', 'StrictHostKeyChecking=yes',
    '-o', `UserKnownHostsFile=${knownHostsFile}`,
    `${user}@${host}`,
    remoteCommand
  ])
}
