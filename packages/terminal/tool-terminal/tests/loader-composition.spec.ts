import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { ToolCallId } from '@x1a0f3n9/dsh-llm'
import { Session, SessionId } from '@x1a0f3n9/dsh-session'
import AgentRegistry, { Inbox } from '@x1a0f3n9/dsh-agent'
import type { Agent } from '@x1a0f3n9/dsh-agent'
import SystemPrompt from '@x1a0f3n9/dsh-system-prompt'
import ToolRuntime from '@x1a0f3n9/dsh-tools'
import TerminalSessionService from '@x1a0f3n9/dsh-terminal'
import SandboxProvider from '@x1a0f3n9/dsh-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@x1a0f3n9/dsh-sandbox'
import SandboxPolicyService from '@x1a0f3n9/dsh-sandbox-policy'
import SessionProjectionRegistry from '@x1a0f3n9/dsh-session-projection'
import LocalSubprocessRuntime from '@x1a0f3n9/dsh-subprocess-local'
import * as TerminalLocal from '@x1a0f3n9/dsh-terminal-bash'
import * as ToolPty from '@x1a0f3n9/dsh-tool-terminal'

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
      "- name: '@x1a0f3n9/dsh-agent'",
      "- name: '@x1a0f3n9/dsh-system-prompt'",
      "- name: '@x1a0f3n9/dsh-tools'",
      "- name: '@x1a0f3n9/dsh-terminal'",
      "- name: '@x1a0f3n9/dsh-test-sandbox'",
      "- name: '@x1a0f3n9/dsh-session-projection'",
      "- name: '@x1a0f3n9/dsh-sandbox-policy'",
      '  config:',
      '    mode: danger-full-access',
      `    workspaceRoot: ${JSON.stringify(root)}`,
      "- name: '@x1a0f3n9/dsh-subprocess-local'",
      "- name: '@x1a0f3n9/dsh-terminal-bash'",
      '  config:',
      '    pollIntervalMs: 10',
      '    exactProbeAfterMs: 20',
      '    idleSilenceMs: 250',
      '    handoffGraceMs: 250',
      '    timeoutMs: 2000',
      '    disposeGraceMs: 500',
      "- name: '@x1a0f3n9/dsh-tool-terminal'",
      '',
    ].join('\n'))

    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    const modules = new Map<string, unknown>([
      ['@x1a0f3n9/dsh-agent', AgentRegistry],
      ['@x1a0f3n9/dsh-system-prompt', SystemPrompt],
      ['@x1a0f3n9/dsh-tools', ToolRuntime],
      ['@x1a0f3n9/dsh-terminal', TerminalSessionService],
      ['@x1a0f3n9/dsh-test-sandbox', PassthroughSandbox],
      ['@x1a0f3n9/dsh-session-projection', SessionProjectionRegistry],
      ['@x1a0f3n9/dsh-sandbox-policy', SandboxPolicyService],
      ['@x1a0f3n9/dsh-subprocess-local', LocalSubprocessRuntime],
      ['@x1a0f3n9/dsh-terminal-bash', TerminalLocal],
      ['@x1a0f3n9/dsh-tool-terminal', ToolPty],
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
