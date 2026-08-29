import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import {
  validateGeneratedProjectConfig,
  validateProductionManifest,
  validateReleaseConfig,
} from './release-config.mjs'
import {
  assertMainPackageSize,
  assertSubpackageSizes,
  formatPackageMeasurement,
  measureMiniProgramPackage,
} from './check-mini-program-package-size.mjs'

const useDirectUni = process.argv.includes('--direct-uni')
const root = useDirectUni
  ? resolve(dirname(fileURLToPath(import.meta.url)), '..')
  : resolve(process.cwd())
const fileEnvironment = loadEnv('production', root, '')
const releaseEnvironment = {
  ...fileEnvironment,
  ...process.env,
}
const manifest = await readJson(resolve(root, 'src/manifest.json'))
const errors = [
  ...validateReleaseConfig(releaseEnvironment),
  ...validateProductionManifest(manifest),
]
if (errors.length > 0) {
  console.error('Production build configuration is invalid:')
  for (const error of errors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

if (process.argv.includes('--check-config')) {
  console.log('Production build configuration is valid.')
  process.exit(0)
}

const command = useDirectUni
  ? process.execPath
  : process.platform === 'win32'
    ? 'pnpm.cmd'
    : 'pnpm'
const commandArguments = useDirectUni
  ? [
      resolve(root, 'node_modules/@dcloudio/vite-plugin-uni/bin/uni.js'),
      'build',
      '-p',
      'mp-weixin',
    ]
  : ['exec', 'uni', 'build', '-p', 'mp-weixin']
const child = spawn(command, commandArguments, {
  cwd: root,
  env: releaseEnvironment,
  stdio: 'inherit',
})

const exitCode = await new Promise((resolveExitCode, reject) => {
  child.on('error', reject)
  child.on('exit', (code) => resolveExitCode(code ?? 1))
})

if (exitCode !== 0) {
  process.exit(exitCode)
}

const generatedConfig = await readJson(
  resolve(root, 'dist/build/mp-weixin/project.config.json'),
)
const generatedErrors = validateGeneratedProjectConfig(generatedConfig)
if (generatedErrors.length > 0) {
  console.error('Generated production bundle is invalid:')
  for (const error of generatedErrors) {
    console.error(`- ${error}`)
  }
  process.exit(1)
}

const packageMeasurement = await measureMiniProgramPackage(
  resolve(root, 'dist/build/mp-weixin'),
)
console.log(formatPackageMeasurement(packageMeasurement))
try {
  assertMainPackageSize(packageMeasurement)
  assertSubpackageSizes(packageMeasurement)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

console.log('Generated production bundle passed release configuration and package size checks.')

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    throw new Error(`Unable to read required JSON file at ${path}`, {
      cause: error,
    })
  }
}
