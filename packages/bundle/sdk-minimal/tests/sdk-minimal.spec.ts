/** The standalone SDK-minimal bundle's complete declared Cordis tree. */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

function packageName(specifier: string): string {
  return specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]!
}

describe('dsh-sdk-minimal bundle', () => {
  it('declares one standalone allowlisted tree with every row dependency', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    const patches = yaml.load(
      readFileSync(resolve(root, manifest.dsh!.bundle!.patch!), 'utf8'),
      { schema: entryListSchema },
    ) as Array<{ insert?: Array<{ id?: string; inject?: string[]; name?: string; config?: Record<string, unknown>; disabled?: unknown }> }>
    expect(patches).toHaveLength(1)
    const rows = patches[0]?.insert ?? []
    expect(rows.map(row => [row.id, row.name])).toEqual([
      ['sdk-app-startup', '@x1a0f3n9/dsh-sdk-app'],
      ['sdk-jsonrpc-server', '@x1a0f3n9/dsh-sdk-jsonrpc-server'],
      ['deepseek-llm-api-extensions', '@x1a0f3n9/dsh-deepseek-llm-api-extensions'],
      ['session-log-deepseek', '@x1a0f3n9/dsh-session-log-deepseek'],
      ['plugin-package-inventory-deepseek', '@x1a0f3n9/dsh-plugin-package-inventory-deepseek'],
      ['llm-deepseek', '@x1a0f3n9/dsh-llm-deepseek'],
      ['sandbox', '@x1a0f3n9/dsh-sandbox-local'],
      ['session-projection', '@x1a0f3n9/dsh-session-projection'],
      ['sandbox-policy', '@x1a0f3n9/dsh-sandbox-policy'],
      ['subprocess', '@x1a0f3n9/dsh-subprocess-local'],
      ['pty', '@x1a0f3n9/dsh-terminal'],
      ['terminal-bash', '@x1a0f3n9/dsh-terminal-bash'],
      ['terminal-pwsh', '@x1a0f3n9/dsh-terminal-bash'],
      ['fs-local', '@x1a0f3n9/dsh-fs-local'],
      ['timer', '@deepseek-ai/cordis-plugin-timer'],
      ['llm', '@x1a0f3n9/dsh-llm'],
      ['session', '@x1a0f3n9/dsh-session'],
      ['session-title', '@x1a0f3n9/dsh-session-title'],
      ['system-prompt', '@x1a0f3n9/dsh-system-prompt'],
      ['tools', '@x1a0f3n9/dsh-tools'],
      ['agent', '@x1a0f3n9/dsh-agent'],
      ['llm-retry', '@x1a0f3n9/dsh-llm-retry'],
      ['jobs', '@x1a0f3n9/dsh-jobs-local'],
      ['invariants', '@x1a0f3n9/dsh-invariants'],
      ['session-invariant', '@x1a0f3n9/dsh-session/invariant'],
      ['agent-invariant', '@x1a0f3n9/dsh-agent/invariant'],
      ['scope-invariant', '@x1a0f3n9/dsh-scope/invariant'],
      ['agent-loop-invariant', '@x1a0f3n9/dsh-agent-loop/invariant'],
      ['agent-loop', '@x1a0f3n9/dsh-agent-loop'],
      ['persistent-bash', '@x1a0f3n9/dsh-tool-bash-persistent'],
      ['persistent-pwsh', '@x1a0f3n9/dsh-tool-pwsh-persistent'],
      ['str-replace-editor', '@x1a0f3n9/dsh-tool-str-replace-editor'],
      ['sessions', '@x1a0f3n9/dsh-session-persistence-jsonl'],
    ])
    expect(rows.find(row => row.id === 'sdk-app-startup')?.config).toEqual({ profile: 'sdk-minimal' })
    expect(rows.find(row => row.id === 'sdk-jsonrpc-server')).toMatchObject({
      inject: ['sdkAppStartup', 'loader'],
      config: { maxTokensAsSuccess: false },
    })
    expect(rows.find(row => row.id === 'llm-deepseek')?.config).toEqual({
      apiKeyEnv: 'DEEPSEEK_API_KEY',
      defaultContextWindow: { __jsExpr: 'Number(process.env.DSH_CONTEXT_WINDOW ?? 1000000)' },
      streamIdleTimeoutMs: 172800000,
    })
    expect(rows.find(row => row.id === 'system-prompt')?.config).toEqual({
      includeHarnessIdentity: false,
      includeRuntimeContext: false,
      persona: { __jsExpr: "process.env.DSH_SYSTEM_PROMPT ?? 'You are a helpful software engineer assistant.'" },
    })
    expect(rows.find(row => row.id === 'agent-loop')?.config).toEqual({ agents: [] })
    expect(rows.find(row => row.id === 'terminal-bash')).toMatchObject({
      disabled: { __jsExpr: "process.platform === 'win32'" },
    })
    expect(rows.find(row => row.id === 'terminal-pwsh')).toMatchObject({
      disabled: { __jsExpr: "process.platform !== 'win32'" },
      config: { shellDialect: 'pwsh', timeoutMs: 300000 },
    })
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(
      [...new Set(rows.map(row => row.name).filter((name): name is string => name !== undefined).map(packageName))].sort(),
    )
  })
})
