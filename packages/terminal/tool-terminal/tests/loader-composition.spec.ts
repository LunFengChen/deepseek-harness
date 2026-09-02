import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { ToolCallId } from '@xfcodeai/dsh-llm'
import { Session, SessionId } from '@xfcodeai/dsh-session'
import AgentRegistry, { Inbox } from '@xfcodeai/dsh-agent'
import type { Agent } from '@xfcodeai/dsh-agent'
import SystemPrompt from '@xfcodeai/dsh-system-prompt'
import ToolRuntime from '@xfcodeai/dsh-tools'
import TerminalSessionService from '@xfcodeai/dsh-terminal'
import SandboxProvider from '@xfcodeai/dsh-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@xfcodeai/dsh-sandbox'
import SandboxPolicyService from '@xfcodeai/dsh-sandbox-policy'
import SessionProjectionRegistry from '@xfcodeai/dsh-session-projection'
import LocalSubprocessRuntime from '@xfcodeai/dsh-subprocess-local'
import * as TerminalLocal from '@xfcodeai/dsh-terminal-bash'
import * as ToolPty from '@xfcodeai/dsh-tool-terminal'

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

function agent(ctx: Context): Agent {
  const scope = ctx.plugin(() => {})
  const id = SessionId('pty-loader-agent')
  const session = Session.create(id)
  const value: Agent = {
    id, options: {}, session, inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx: scope.ctx,
    send: () => {},
    followup: () => {}, steer: () => {}, inject: () => {}, cancel() {},
    runMaintenance: job => job(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(value)
  return value
}

function resultText(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

const suite = process.platform === 'linux' || process.platform === 'darwin' ? describe : describe.skip

suite('terminal real Loader composition through cordis.yml', () => {
  it('boots cordis.yml and preserves shell state across real tool calls', async () => {
    root = await mkdtemp(join(tmpdir(), 'dsh-pty-loader-'))
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
      '    pollIntervalMs: 10',
      '    exactProbeAfterMs: 20',
      '    idleSilenceMs: 250',
      '    handoffGraceMs: 250',
      '    timeoutMs: 2000',
      '    disposeGraceMs: 500',
      "- name: '@xfcodeai/dsh-tool-terminal'",
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@xfcodeai/dsh-agent', AgentRegistry],
      ['@xfcodeai/dsh-system-prompt', SystemPrompt],
      ['@xfcodeai/dsh-tools', ToolRuntime],
      ['@xfcodeai/dsh-terminal', TerminalSessionService],
      ['@xfcodeai/dsh-test-sandbox', PassthroughSandbox],
      ['@xfcodeai/dsh-session-projection', SessionProjectionRegistry],
      ['@xfcodeai/dsh-sandbox-policy', SandboxPolicyService],
      ['@xfcodeai/dsh-subprocess-local', LocalSubprocessRuntime],
      ['@xfcodeai/dsh-terminal-bash', TerminalLocal],
      ['@xfcodeai/dsh-tool-terminal', ToolPty],
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

    const owner = agent(context)
    const signal = new AbortController().signal
    const spawn = await context.tools.execute({
      signal, callId: ToolCallId('spawn'), name: 'terminal_open', arguments: { type: 'shell', name: 'main', cwd: root }, agent: owner,
    })
    expect(resultText(spawn)).toContain('started terminal session pty-1 (main)')

    await context.tools.execute({
      signal, callId: ToolCallId('state'), name: 'terminal_send', arguments: { sessionId: 'pty-1', text: 'export KEEP=loader; cd /' }, agent: owner,
    })
    const read = await context.tools.execute({
      signal, callId: ToolCallId('read'), name: 'terminal_send', arguments: { sessionId: 'pty-1', text: 'printf "cwd=%s keep=%s\\n" "$PWD" "$KEEP"' }, agent: owner,
    })
    expect(resultText(read)).toContain('cwd=/ keep=loader')
    expect(context.terminals.list(owner)).toHaveLength(1)
  }, 15_000)
})
