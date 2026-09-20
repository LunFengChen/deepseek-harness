import { describe, expect, it } from 'vitest'
import { splitKeys } from '@x1a0f3n9/dsh-web-search-pool'

describe('splitKeys', () => {
  it('returns an empty list for blank input', () => {
    expect(splitKeys('')).toEqual([])
    expect(splitKeys('   ')).toEqual([])
    expect(splitKeys(',,\n')).toEqual([])
  })

  it('splits on commas, spaces, and newlines and drops duplicates', () => {
    expect(splitKeys('a, b\nc a,d')).toEqual(['a', 'b', 'c', 'd'])
  })
})
