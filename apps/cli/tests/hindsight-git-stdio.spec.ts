import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const patchPath = fileURLToPath(
  new URL('../../../patches/@vectorize-io__hindsight-coding-agents@0.5.2.patch', import.meta.url),
)

describe('Hindsight git stderr patch', () => {
  it('pipes git stderr so a non-repository session cwd does not inherit fatals', () => {
    const patch = readFileSync(patchPath, 'utf8')
    expect(patch).toContain('function git(repo, ...args)')
    expect(patch.match(/stdio: \["ignore", "pipe", "pipe"\]/g)).toEqual([
      'stdio: ["ignore", "pipe", "pipe"]',
      'stdio: ["ignore", "pipe", "pipe"]',
      'stdio: ["ignore", "pipe", "pipe"]',
    ])
  })
})
