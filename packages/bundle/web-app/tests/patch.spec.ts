/**
 * The web-app bundle's substance is its patch file and the prebundled catalog:
 * `dsh.bundle.patch` must name a parseable patch list, and `dsh.bundle.plugins`
 * must name the xfdsh prebundled cards including search-pool.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

describe('dsh-web-app bundle', () => {
  it('mounts search-pool as an xfdsh prebundled plugin and overlays the web search order', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>
      dsh?: {
        bundle?: {
          patch?: string
          plugins?: { id?: string; entryId?: string; packageName?: string }[]
        }
      }
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.dependencies).toHaveProperty('@x1a0f3n9/dsh-web-search-pool')
    expect(manifest.dsh?.bundle?.plugins).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'search-pool',
          entryId: 'web-search-pool',
          packageName: '@x1a0f3n9/dsh-web-search-pool',
        }),
      ]),
    )

    const parsed = yaml.load(
      readFileSync(resolve(root, manifest.dsh!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    )
    expect(Array.isArray(parsed)).toBe(true)
    const overlays = (parsed as { id?: string; config?: Record<string, unknown> }[])
    expect(overlays.find(row => row.id === 'web')?.config).toMatchObject({
      searchProviderOrder: ['search-pool', 'perplexity', 'exa', 'free'],
      fetchProvider: 'http',
    })
    const inserts = (parsed as { insert?: { id?: string; name?: string }[] }[]).flatMap(
      patch => patch.insert ?? [],
    )
    expect(inserts.find(row => row.id === 'web-search-pool')).toBeDefined()

    const scopedPins = [
      { id: 'dsh-market', packageName: '@x1a0f3n9/dshmarket' },
      { id: 'reasoning-effort', packageName: '@x1a0f3n9/dsh-reasoning-effort' },
      { id: 'dsh-context', packageName: '@x1a0f3n9/dsh-context' },
      { id: 'better-sidebar', packageName: '@x1a0f3n9/dsh-better-sidebar' },
      { id: 'hindsight', packageName: '@x1a0f3n9/hindsight-coding-agents', loader: '@x1a0f3n9/hindsight-coding-agents/dsh' },
    ]
    for (const pin of scopedPins) {
      expect(manifest.dependencies).toHaveProperty(pin.packageName)
      expect(manifest.dsh?.bundle?.plugins).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            packageName: pin.packageName,
          }),
        ]),
      )
      expect(inserts.find(row => row.id === pin.id)).toMatchObject({
        name: pin.loader ?? pin.packageName,
      })
    }
  })
})
