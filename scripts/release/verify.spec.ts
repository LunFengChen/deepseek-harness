/** Publication ref gates for tagged releases and branch allow-refs. */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { releaseFamily, type ReleaseMember } from './families.ts'
import { verifyPublishRef } from './verify.ts'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('release verify refs', () => {
  const family = releaseFamily('dsh')
  const members: ReleaseMember[] = [{
    directory: 'apps/cli',
    name: '@x1a0f3n9/dsh',
    version: '0.1.5-alpha.2',
    manifest: {},
  }]

  it('accepts the family version tag', () => {
    expect(() => {
      verifyPublishRef(family, members, 'refs/tags/xfdsh-v0.1.5-alpha.2')
    }).not.toThrow()
  })

  it('rejects a branch when no allow-ref is set', () => {
    expect(() => {
      verifyPublishRef(family, members, 'refs/heads/dev-x1a0f3n9')
    }).toThrow(/xfdsh-v\*/)
  })

  it('accepts the configured branch allow-ref', () => {
    vi.stubEnv('RELEASE_PUBLISH_ALLOW_REF', 'refs/heads/dev-x1a0f3n9')
    expect(() => {
      verifyPublishRef(family, members, 'refs/heads/dev-x1a0f3n9')
    }).not.toThrow()
  })

  it('accepts the master allow-ref', () => {
    vi.stubEnv('RELEASE_PUBLISH_ALLOW_REF', 'refs/heads/master')
    expect(() => {
      verifyPublishRef(family, members, 'refs/heads/master')
    }).not.toThrow()
  })

  it('rejects a different ref than the allow-ref', () => {
    vi.stubEnv('RELEASE_PUBLISH_ALLOW_REF', 'refs/heads/dev-x1a0f3n9')
    expect(() => {
      verifyPublishRef(family, members, 'refs/heads/master')
    }).toThrow(/refs\/heads\/dev-x1a0f3n9/)
  })
})
