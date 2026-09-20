/** Transient npm publish failures and the retry backoff they select. */

import { describe, expect, it } from 'vitest'
import {
  PUBLISH_SPACING_MS,
  RATE_LIMIT_ATTEMPTS,
  REGISTRY_PROBE_SPACING_MS,
  existingPublishedVersionAction,
  isRateLimited,
  isTransientFailure,
  partitionPublishPasses,
  rateLimitedPublishAction,
  retryBackoffMs,
} from './publish.ts'

const packumentRace = 'npm error code E409\nnpm error Failed to save packument'
const rateLimited = [
  'npm error code E429',
  'npm error 429 Too Many Requests - PUT https://registry.npmjs.org/@x1a0f3n9%2fdsh-command-goal',
  'Could not publish, as user undefined: rate limited exceeded',
].join('\n')
const rejected = 'npm error code E403\nnpm error You cannot publish over an existing version'

describe('release publish retries', () => {
  it('retries packument races and rate limits, and refuses a rejected payload', () => {
    expect(isTransientFailure(packumentRace)).toBe(true)
    expect(isTransientFailure(rateLimited)).toBe(true)
    expect(isTransientFailure(rejected)).toBe(false)
    expect(isRateLimited(rateLimited)).toBe(true)
    expect(isRateLimited(packumentRace)).toBe(false)
  })

  it('backs off packument races from the publish spacing', () => {
    expect(retryBackoffMs(packumentRace, 1)).toBe(PUBLISH_SPACING_MS)
    expect(retryBackoffMs(packumentRace, 2)).toBe(PUBLISH_SPACING_MS * 2)
    expect(retryBackoffMs(packumentRace, 3)).toBe(PUBLISH_SPACING_MS * 4)
  })

  it('spaces registry probes and fails on the first rate limit', () => {
    expect(REGISTRY_PROBE_SPACING_MS).toBe(1_000)
    expect(PUBLISH_SPACING_MS).toBe(5_000)
    expect(RATE_LIMIT_ATTEMPTS).toBe(1)
  })
})

describe('release publish existing versions', () => {
  it('skips an identical tarball', () => {
    expect(existingPublishedVersionAction('sha512-a', 'sha512-a', '')).toBe('skip')
    expect(existingPublishedVersionAction('sha512-a', 'sha512-a', 'refs/heads/dev-x1a0f3n9')).toBe('skip')
  })

  it('fails a tagged mismatch and skips a branch-publish mismatch', () => {
    expect(existingPublishedVersionAction('sha512-a', 'sha512-b', '')).toBe('fail')
    expect(existingPublishedVersionAction('sha512-a', 'sha512-b', 'refs/heads/dev-x1a0f3n9')).toBe('skip')
  })

  it('fails a tagged rate limit and pauses a branch-publish rate limit', () => {
    expect(rateLimitedPublishAction('')).toBe('fail')
    expect(rateLimitedPublishAction('refs/heads/dev-x1a0f3n9')).toBe('pause')
  })
})

describe('release publish pass order', () => {
  it('keeps original order inside an absent pass that precedes present members', () => {
    const members = [
      { name: 'already-a', kind: 'present' as const },
      { name: 'missing-b', kind: 'absent' as const },
      { name: 'already-c', kind: 'present' as const },
      { name: 'missing-d', kind: 'absent' as const },
    ]
    const passes = partitionPublishPasses(members)
    expect(passes.absent.map(member => member.name)).toEqual(['missing-b', 'missing-d'])
    expect(passes.present.map(member => member.name)).toEqual(['already-a', 'already-c'])
  })
})
