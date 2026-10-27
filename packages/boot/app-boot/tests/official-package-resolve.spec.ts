import { describe, expect, it, vi } from 'vitest'

const registerHooks = vi.hoisted(() => vi.fn())

vi.mock('node:module', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:module')>()
  return { ...actual, registerHooks }
})

import {
  remapOfficialDshSpecifier,
  resolveOfficialDshPackage,
  registerOfficialDshPackageResolve,
} from '../src/official-package-resolve.ts'

describe('official dsh package resolve', () => {
  it('remaps official dsh specifiers including subpaths', () => {
    expect(remapOfficialDshSpecifier('@deepseek-ai/dsh')).toBeUndefined()
    expect(remapOfficialDshSpecifier('@deepseek-ai/dsh/package.json')).toBeUndefined()
    expect(remapOfficialDshSpecifier('@deepseek-ai/dsh-session')).toBe('@x1a0f3n9/dsh-session')
    expect(remapOfficialDshSpecifier('@deepseek-ai/dsh-session/types')).toBe('@x1a0f3n9/dsh-session/types')
    expect(remapOfficialDshSpecifier('@deepseek-ai/cordis')).toBeUndefined()
    expect(remapOfficialDshSpecifier('@x1a0f3n9/dsh-session')).toBeUndefined()
  })

  it('forwards remapped specifiers to the next resolver', () => {
    const nextResolve = vi.fn((specifier: string) => ({ url: `resolved:${specifier}` }))
    expect(resolveOfficialDshPackage(
      '@deepseek-ai/dsh-settings',
      { parentURL: 'file:///plugin.js' } as never,
      nextResolve as never,
    )).toEqual({ url: 'resolved:@x1a0f3n9/dsh-settings' })
    expect(resolveOfficialDshPackage(
      'zod',
      { parentURL: 'file:///plugin.js' } as never,
      nextResolve as never,
    )).toEqual({ url: 'resolved:zod' })
  })

  it('installs the hook once', () => {
    registerOfficialDshPackageResolve()
    registerOfficialDshPackageResolve()
    expect(registerHooks).toHaveBeenCalledOnce()
    expect(registerHooks).toHaveBeenCalledWith({ resolve: resolveOfficialDshPackage })
  })
})
