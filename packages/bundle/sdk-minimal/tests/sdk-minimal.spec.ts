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
      ['sdk-app-startup', '@xfcodeai/dsh-sdk-app'],
      ['sdk-jsonrpc-server', '@xfcodeai/dsh-sdk-jsonrpc-server'],
      ['deepseek-llm-api-extensions', '@xfcodeai/dsh-deepseek-llm-api-extensions'],
      ['session-log-deepseek', '@xfcodeai/dsh-session-log-deepseek'],
      ['plugin-package-inventory-deepseek', '@xfcodeai/dsh-plugin-package-inventory-deepseek'],
      ['llm-deepseek', '@xfcodeai/dsh-llm-deepseek'],
      ['sandbox', '@xfcodeai/dsh-sandbox-local'],
      ['session-projection', '@xfcodeai/dsh-session-projection'],
      ['sandbox-policy', '@xfcodeai/dsh-sandbox-policy'],
      ['subprocess', '@xfcodeai/dsh-subprocess-local'],
      ['pty', '@xfcodeai/dsh-terminal'],
      ['terminal-bash', '@xfcodeai/dsh-terminal-bash'],
      ['terminal-pwsh', '@xfcodeai/dsh-terminal-bash'],
      ['fs-local', '@xfcodeai/dsh-fs-local'],
      ['timer', '@deepseek-ai/cordis-plugin-timer'],
      ['llm', '@xfcodeai/dsh-llm'],
      ['session', '@xfcodeai/dsh-session'],
      ['session-title', '@xfcodeai/dsh-session-title'],
      ['system-prompt', '@xfcodeai/dsh-system-prompt'],
      ['tools', '@xfcodeai/dsh-tools'],
      ['agent', '@xfcodeai/dsh-agent'],
      ['llm-retry', '@xfcodeai/dsh-llm-retry'],
      ['jobs', '@xfcodeai/dsh-jobs-local'],
      ['invariants', '@xfcodeai/dsh-invariants'],
      ['session-invariant', '@xfcodeai/dsh-session/invariant'],
      ['agent-invariant', '@xfcodeai/dsh-agent/invariant'],
      ['scope-invariant', '@xfcodeai/dsh-scope/invariant'],
      ['agent-loop-invariant', '@xfcodeai/dsh-agent-loop/invariant'],
      ['agent-loop', '@xfcodeai/dsh-agent-loop'],
      ['persistent-bash', '@xfcodeai/dsh-tool-bash-persistent'],
      ['persistent-pwsh', '@xfcodeai/dsh-tool-pwsh-persistent'],
      ['str-replace-editor', '@xfcodeai/dsh-tool-str-replace-editor'],
      ['sessions', '@xfcodeai/dsh-session-persistence-jsonl'],
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
