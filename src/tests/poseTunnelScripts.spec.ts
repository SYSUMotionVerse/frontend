import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('pose model tunnel pnpm scripts', () => {
  it('exposes start, stop, status, and tunnel-backed dev commands through pnpm', () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))

    expect(pkg.scripts['pose:tunnel:start']).toBe('node scripts/pose-model-tunnel.mjs start')
    expect(pkg.scripts['pose:tunnel:stop']).toBe('node scripts/pose-model-tunnel.mjs stop')
    expect(pkg.scripts['pose:tunnel:status']).toBe('node scripts/pose-model-tunnel.mjs status')
    expect(pkg.scripts['dev:tunnel']).toBe('node scripts/pose-model-tunnel.mjs dev')
    expect(pkg.scripts['build:mp-weixin-cf']).toBe('node scripts/pose-model-tunnel.mjs build')
  })

  it('manages model and backend cloudflared tunnel state from one script and config file', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts/pose-model-tunnel.mjs'), 'utf8')
    const config = readFileSync(resolve(process.cwd(), 'scripts/tunnel.config.json'), 'utf8')
    const gitignore = readFileSync(resolve(process.cwd(), '.gitignore'), 'utf8')

    expect(source).toContain('cloudflared')
    expect(source).toContain('tunnelUrlPattern')
    expect(config).toContain('models/pose')
    expect(config).toContain('.tmp/pose-model-tunnel.json')
    expect(config).toContain('"poseModels"')
    expect(config).toContain('"backendApi"')
    expect(config).toContain('"apiPath": "/api"')
    expect(config).toContain('"originHostHeader": "127.0.0.1:8000"')
    expect(config).toContain('VITE_POSE_MODEL_BASE_URL')
    expect(config).toContain('VITE_API_BASE_URL')
    expect(config).toContain('"namedTunnel"')
    expect(config).toContain('sport-snack-dev-7q9x2m')
    expect(config).toContain('pose-vault-7q9x2m.pi-dal.com')
    expect(config).toContain('api-gateway-7q9x2m.pi-dal.com')
    expect(source).toContain('cloudflaredNamedTunnelConfig')
    expect(source).toContain('httpHostHeader')
    expect(source).toContain("['tunnel', '--config', tunnelConfigPath, 'run', config.namedTunnel.name]")
    expect(source).toContain("spawn('pnpm', ['build:mp-weixin']")
    expect(gitignore).toContain('.tmp/')
  })
})
