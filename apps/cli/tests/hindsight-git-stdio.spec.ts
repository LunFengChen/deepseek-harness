import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const require = createRequire(
  fileURLToPath(new URL('../../../packages/bundle/web-app/package.json', import.meta.url)),
)

describe('Hindsight git stderr', () => {
  it('pipes git stderr so a non-repository session cwd does not inherit fatals', () => {
    const source = readFileSync(require.resolve('@vectorize-io/hindsight-coding-agents/dsh'), 'utf8')
    expect(source.match(/stdio: \["ignore", "pipe", "pipe"\]/g)).toEqual([
      'stdio: ["ignore", "pipe", "pipe"]',
      'stdio: ["ignore", "pipe", "pipe"]',
      'stdio: ["ignore", "pipe", "pipe"]',
    ])
  })
})
