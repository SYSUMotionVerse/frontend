import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { validateReleaseConfig } from './release-config.mjs'

const root = resolve(process.cwd())
const fileEnvironment = loadEnv('production', root, '')
const releaseEnvironment = {
  ...fileEnvironment,
  ...process.env,
}
const errors = validateReleaseConfig(releaseEnvironment)
if (errors.length > 0) {
  console.error('Production build configuration is invalid:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const child = spawn(command, ['exec', 'uni', 'build', '-p', 'mp-weixin'], {
  env: releaseEnvironment,
  stdio: 'inherit',
})

child.on('exit', (code) => process.exit(code ?? 1))
