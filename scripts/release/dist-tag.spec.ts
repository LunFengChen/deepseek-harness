/** Dist-tag move judgements for already-published family members. */

import { describe, expect, it } from 'vitest'
import { distTagAction, distTagAddArgs, parseDistTags } from './dist-tag.ts'

describe('release dist-tag', () => {
  it('skips a tag that already names the target version', () => {
    expect(distTagAction('0.1.5-rc.4', '0.1.5-rc.4')).toBe('skip')
    expect(distTagAction('0.1.5-rc.2', '0.1.5-rc.4')).toBe('add')
    expect(distTagAction(undefined, '0.1.5-rc.4')).toBe('add')
  })

  it('builds npm dist-tag add argv', () => {
    expect(distTagAddArgs('@x1a0f3n9/dsh', '0.1.5-rc.4', 'latest')).toEqual([
      'dist-tag',
      'add',
      '@x1a0f3n9/dsh@0.1.5-rc.4',
      'latest',
    ])
  })

  it('parses a dist-tag object and rejects a non-object payload', () => {
    expect(parseDistTags('{"latest":"0.1.5-rc.2","next":"0.1.5-rc.4"}')).toEqual({
      latest: '0.1.5-rc.2',
      next: '0.1.5-rc.4',
    })
    expect(() => { parseDistTags('[]') }).toThrow(/not a JSON object/)
    expect(() => { parseDistTags('{"latest":1}') }).toThrow(/not a version/)
  })
})
