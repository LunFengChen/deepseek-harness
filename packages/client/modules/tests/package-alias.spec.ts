import { describe, expect, it } from 'vitest'
import { aliasedKey, alternateDshPackageName, lookupAliased } from '../src/package-alias.ts'

describe('dsh package name aliases', () => {
  it('maps official product packages onto the fork spelling and back', () => {
    expect(alternateDshPackageName('@x1a0f3n9/dsh-client-locale')).toBe('@x1a0f3n9/dsh-client-locale')
    expect(alternateDshPackageName('@x1a0f3n9/dsh-client-locale/client')).toBe('@x1a0f3n9/dsh-client-locale/client')
    expect(alternateDshPackageName('@deepseek-ai/cordis')).toBeUndefined()
    expect(alternateDshPackageName('dshmarket')).toBeUndefined()
  })

  it('resolves a table keyed by the fork name when the official name is requested', () => {
    const table = new Map<string, string>([[ '@x1a0f3n9/dsh-client-locale', 'locale' ]])
    expect(aliasedKey(table, '@x1a0f3n9/dsh-client-locale')).toBe('@x1a0f3n9/dsh-client-locale')
    expect(lookupAliased(table, '@x1a0f3n9/dsh-client-locale')).toBe('locale')
    expect(lookupAliased(table, '@x1a0f3n9/dsh-client-locale')).toBe('locale')
    expect(lookupAliased(table, '@x1a0f3n9/dsh-missing')).toBeUndefined()
  })
})
