import { spawnSync } from 'node:child_process'
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { ToolCallId } from '@xfcodeai/dsh-llm'
import { Session, SessionId } from '@xfcodeai/dsh-session'
import SessionProjectionRegistry from '@xfcodeai/dsh-session-projection'
import AgentRegistry, { Inbox } from '@xfcodeai/dsh-agent'
import type { Agent } from '@xfcodeai/dsh-agent'
import TerminalSessionService from '@xfcodeai/dsh-terminal'
import * as TerminalBash from '@xfcodeai/dsh-terminal-bash'
import SandboxProvider from '@xfcodeai/dsh-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@xfcodeai/dsh-sandbox'
import SandboxPolicyService from '@xfcodeai/dsh-sandbox-policy'
import LocalSubprocessService from '@xfcodeai/dsh-subprocess-local'
import { resolvePwshPath } from '@xfcodeai/dsh-pwsh-local/src/resolve.ts'
import SystemPrompt from '@xfcodeai/dsh-system-prompt'
import ToolRegistry from '@xfcodeai/dsh-tools'
import * as ToolPwshPersistent from '@xfcodeai/dsh-tool-pwsh-persistent'

const hasPwsh = spawnSync(
  resolvePwshPath(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$true'],
  { encoding: 'utf8' },
).status === 0

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

class PassthroughSandbox extends SandboxProvider {
  confine(argv: readonly string[], _policy: SandboxPolicy): ConfinedArgv {
    return { argv: [...argv], enforcement: 'full', denialSignatures: [], runnerFailureRules: [] }
  }
}

function agent(ctx: Context, cwd: string): Agent {
  const id = SessionId('persistent-pwsh-loader-agent')
  const scope = ctx.plugin(() => {})
  const session = Session.create(id, [], { version: 0, id, createdAt: 0, cwd, isSeeded: false })
  const value: Agent = {
    id,
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx: scope.ctx,
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

function text(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

describe.skipIf(!hasPwsh)('persistent pwsh through a real cordis.yml Loader composition', () => {
  it('preserves cwd and environment across calls', async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-persistent-pwsh-loader-')))
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, [
      "- name: '@xfcodeai/dsh-agent'",
      "- name: '@xfcodeai/dsh-system-prompt'",
      "- name: '@xfcodeai/dsh-tools'",
      "- name: '@xfcodeai/dsh-terminal'",
      "- name: '@xfcodeai/dsh-test-sandbox'",
      "- name: '@xfcodeai/dsh-session-projection'",
      "- name: '@xfcodeai/dsh-sandbox-policy'",
      '  config:',
      '    mode: danger-full-access',
      `    workspaceRoot: ${JSON.stringify(root)}`,
      "- name: '@xfcodeai/dsh-subprocess-local'",
      "- name: '@xfcodeai/dsh-terminal-bash'",
      '  config:',
      '    shellDialect: pwsh',
      '    pollIntervalMs: 10',
      '    exactProbeAfterMs: 20',
      '    idleSilenceMs: 300',
      '    handoffGraceMs: 300',
      '    scrollbackLines: 20000',
      '    timeoutMs: 60000',
      '    disposeGraceMs: 500',
      "- name: '@xfcodeai/dsh-tool-pwsh-persistent'",
      '  config:',
      '    timeoutMs: 60000',
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@xfcodeai/dsh-agent', AgentRegistry],
      ['@xfcodeai/dsh-system-prompt', SystemPrompt],
      ['@xfcodeai/dsh-tools', ToolRegistry],
      ['@xfcodeai/dsh-terminal', TerminalSessionService],
      ['@xfcodeai/dsh-test-sandbox', PassthroughSandbox],
      ['@xfcodeai/dsh-session-projection', SessionProjectionRegistry],
      ['@xfcodeai/dsh-sandbox-policy', SandboxPolicyService],
      ['@xfcodeai/dsh-subprocess-local', LocalSubprocessService],
      ['@xfcodeai/dsh-terminal-bash', TerminalBash],
      ['@xfcodeai/dsh-tool-pwsh-persistent', ToolPwshPersistent],
    ])
    context.loader.internal = {
      version: 'v2',
      async import(specifier: string) {
        if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
        return modules.get(specifier)
      },
    } as unknown as NonNullable<typeof context.loader.internal>
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    const owner = agent(context, root)
    const signal = new AbortController().signal
    const execute = (id: string, command: string) => context!.tools.execute({
      signal,
      callId: ToolCallId(id),
      name: 'pwsh',
      arguments: { command },
      agent: owner,
    })

    expect(context.tools.schemas().map(schema => schema.name)).toEqual(['pwsh'])
    await execute('state', '$env:KEEP = "loader"; New-Item -ItemType Directory -Force -Path nested | Out-Null; Set-Location nested')
    const observed = text(await execute('observe', 'Write-Output "cwd=$PWD keep=$env:KEEP"'))
    expect(observed).toContain(`cwd=${join(root, 'nested')} keep=loader`)
    expect(observed).not.toContain('DSH_PERSISTENT_PWSH')

    const multiline = text(await execute(
      'multiline',
      '$value = "line one"\nWrite-Output "${value}:it\'s fine"',
    ))
    expect(multiline).toBe("line one:it's fine")
    expect(multiline).not.toContain('DSH_PERSISTENT_PWSH')

    const hereString = text(await execute(
      'here-string',
      "$h = @'\nalpha\nbeta\n'@\nWrite-Output $h",
    ))
    expect(hereString).toBe('alpha\nbeta')

    const large = text(await execute('large-output', '1..12050 | ForEach-Object { $_ }'))
    expect(large.startsWith('1\n2\n3\n')).toBe(true)
    expect(large).toContain('<response clipped>')
    expect(large).not.toContain('beginning of this command output was dropped')

    const exited = text(await execute('exit', 'exit'))
    expect(exited).toContain('next pwsh call starts from the workspace')
    expect(text(await execute('after-exit', 'Write-Output "$PWD"'))).toBe(root)
  }, 120_000)
})
