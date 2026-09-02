import { describe, expect, it } from 'vitest'
import type { NpmPackageLock, RegistryIndex } from './benchmark-npm-resolution.ts'
import {
  assertDualDshInstallLayout,
  buildDualDshRegistry,
} from './verify-npm-install-layout.ts'

function validLayout(): NpmPackageLock {
  return {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { '@xfcodeai/dsh': '0.2.0', 'dsh-previous': 'npm:@xfcodeai/dsh@0.1.0' } },
      'node_modules/@deepseek-ai/cordis': { version: '4.0.1' },
      'node_modules/@xfcodeai/dsh': {
        version: '0.2.0',
        dependencies: { '@xfcodeai/dsh-child': '^0.2.0' },
        peerDependencies: { '@deepseek-ai/cordis': '^4.0.1' },
      },
      'node_modules/@xfcodeai/dsh-child': {
        version: '0.2.0',
        dependencies: { '@xfcodeai/dsh-leaf': '^0.2.0' },
      },
      'node_modules/@xfcodeai/dsh-leaf': { version: '0.2.0' },
      'node_modules/dsh-previous': {
        name: '@xfcodeai/dsh',
        version: '0.1.0',
        dependencies: { '@xfcodeai/dsh-child': '^0.1.0' },
        peerDependencies: { '@deepseek-ai/cordis': '^4.0.1' },
      },
      'node_modules/dsh-previous/node_modules/@xfcodeai/dsh-child': {
        version: '0.1.0',
        dependencies: { '@xfcodeai/dsh-leaf': '^0.1.0' },
      },
      'node_modules/dsh-previous/node_modules/@xfcodeai/dsh-leaf': { version: '0.1.0' },
    },
  }
}

describe('npm install layout verifier', () => {
  it('creates two incompatible versions of every DSH package', () => {
    const index: RegistryIndex = new Map([
      ['@xfcodeai/dsh', new Map([['0.1.1-rc.2', {
        name: '@xfcodeai/dsh',
        version: '0.1.1-rc.2',
        dependencies: { '@xfcodeai/dsh-child': '^0.1.1-rc.2' },
        peerDependencies: { '@deepseek-ai/cordis': '^4.0.1' },
      }]])],
      ['@xfcodeai/dsh-child', new Map([['0.1.1-rc.2', {
        name: '@xfcodeai/dsh-child',
        version: '0.1.1-rc.2',
      }]])],
      ['@deepseek-ai/cordis', new Map([['4.0.1', {
        name: '@deepseek-ai/cordis',
        version: '4.0.1',
      }]])],
    ])

    const dual = buildDualDshRegistry(index, '0.1.1-rc.2')

    expect([...dual.get('@xfcodeai/dsh')?.keys() ?? []]).toEqual(['0.1.0', '0.2.0'])
    expect(dual.get('@xfcodeai/dsh')?.get('0.1.0')).toMatchObject({
      version: '0.1.0',
      dependencies: { '@xfcodeai/dsh-child': '^0.1.0' },
      peerDependencies: { '@deepseek-ai/cordis': '^4.0.1' },
    })
    expect(dual.get('@xfcodeai/dsh')?.get('0.2.0')).toMatchObject({
      version: '0.2.0',
      dependencies: { '@xfcodeai/dsh-child': '^0.2.0' },
    })
    expect(dual.get('@deepseek-ai/cordis')).toBe(index.get('@deepseek-ai/cordis'))
  })

  it('accepts isolated DSH releases with one shared Cordis installation', () => {
    expect(assertDualDshInstallLayout(validLayout())).toEqual({
      dshPackagesPerVersion: 3,
      checkedDshEdges: 4,
    })
  })

  it('rejects an internal edge that crosses release versions', () => {
    const layout = validLayout()
    const packages = { ...layout.packages }
    Reflect.deleteProperty(packages, 'node_modules/dsh-previous/node_modules/@xfcodeai/dsh-leaf')

    expect(() => assertDualDshInstallLayout({ ...layout, packages })).toThrow(
      'node_modules/dsh-previous/node_modules/@xfcodeai/dsh-child: dependencies '
      + '@xfcodeai/dsh-leaf resolves to node_modules/@xfcodeai/dsh-leaf@0.2.0, expected 0.1.0',
    )
  })

  it('rejects a second Cordis installation', () => {
    const layout = validLayout()
    const packages = {
      ...layout.packages,
      'node_modules/dsh-previous/node_modules/@deepseek-ai/cordis': { version: '4.0.1' },
    }

    expect(() => assertDualDshInstallLayout({ ...layout, packages })).toThrow(
      'expected one shared @deepseek-ai/cordis',
    )
  })
})
