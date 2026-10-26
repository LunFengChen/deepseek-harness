import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@x1a0f3n9/dsh-agent'
import AgentLoop from '@x1a0f3n9/dsh-agent-loop'
import LocalFileSystem from '@x1a0f3n9/dsh-fs-local'
import LlmRuntime, { ToolCallId } from '@x1a0f3n9/dsh-llm'
import LocalSandbox from '@x1a0f3n9/dsh-sandbox-local'
import SandboxPolicyService from '@x1a0f3n9/dsh-sandbox-policy'
import SessionStore, { SessionId } from '@x1a0f3n9/dsh-session'
import SessionProjectionRegistry from '@x1a0f3n9/dsh-session-projection'
import LocalSubprocessRuntime from '@x1a0f3n9/dsh-subprocess-local'
import SystemPrompt from '@x1a0f3n9/dsh-system-prompt'
import ToolRuntime from '@x1a0f3n9/dsh-tools'
import WorkingDirectoryService from '@x1a0f3n9/dsh-working-directory'
import WorktreeService from '@x1a0f3n9/dsh-experimental-worktree'
import * as ToolWorktree from '../src/index.ts'

const exec = promisify(execFile)
let context: Context | undefined
let root: string | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

describe('worktree tool through real Loader composition', () => {
  it('creates and enters a new checkout, reports canonical fields, and unregisters on disposal', async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'dsh-worktree-loader-')))
    const repository = join(root, 'repo')
    await mkdir(repository)
    const git = (...args: string[]) => exec('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
      cwd: repository,
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '', GIT_CONFIG_PARAMETERS: '', GIT_CONFIG_COUNT: '0', GIT_DIR: undefined, GIT_WORK_TREE: undefined, GIT_INDEX_FILE: undefined },
    })
    await git('init', '-b', 'main')
    await git('config', 'core.autocrlf', 'false')
    await writeFile(join(repository, 'file.txt'), 'committed\n')
    await git('add', 'file.txt')
    await git('-c', 'user.name=Worktree fixture', '-c', 'user.email=worktree@example.invalid', '-c', 'commit.gpgSign=false', 'commit', '-m', 'initial')
    const baseCommit = (await git('rev-parse', 'HEAD')).stdout.trim()

    const modules = new Map<string, unknown>([
      ['@x1a0f3n9/dsh-agent', AgentRegistry],
      ['@x1a0f3n9/dsh-session', SessionStore],
      ['@x1a0f3n9/dsh-session-projection', SessionProjectionRegistry],
      ['@x1a0f3n9/dsh-system-prompt', SystemPrompt],
      ['@x1a0f3n9/dsh-llm', LlmRuntime],
      ['@x1a0f3n9/dsh-tools', ToolRuntime],
      ['@x1a0f3n9/dsh-fs-local', LocalFileSystem],
      ['@x1a0f3n9/dsh-subprocess-local', LocalSubprocessRuntime],
      ['@x1a0f3n9/dsh-sandbox-local', LocalSandbox],
      ['@x1a0f3n9/dsh-sandbox-policy', SandboxPolicyService],
      ['@x1a0f3n9/dsh-working-directory', WorkingDirectoryService],
      ['@x1a0f3n9/dsh-experimental-worktree', WorktreeService],
      ['@x1a0f3n9/dsh-experimental-tool-worktree', ToolWorktree],
      ['@x1a0f3n9/dsh-agent-loop', AgentLoop],
    ])
    const config = [...modules.keys()].flatMap(name => [
      `- name: 'cordis:${name}'`,
      ...name === '@x1a0f3n9/dsh-sandbox-policy' ? ['  config:', '    mode: danger-full-access'] : [],
      ...name === '@x1a0f3n9/dsh-agent-loop' ? ['  config:', '    agents: []'] : [],
    ]).join('\n') + '\n'
    const configPath = join(root, 'cordis.yml')
    await writeFile(configPath, config)
    context = new Context()
    context.baseUrl = pathToFileURL(root).href + '/'
    await context.plugin(Loader)
    context.loader.builtins.include = Include
    for (const [specifier, plugin] of modules) context.loader.builtins[specifier] = plugin
    await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
    await context.loader.await()

    const agent = await context.agentLoop.create(SessionId('worktree-loader'), {}, { cwd: repository })
    const invoke = (name: string, agentValue = agent) => context!.tools.execute({
      name: 'create_worktree', callId: ToolCallId(name), arguments: { name }, agent: agentValue, signal: new AbortController().signal,
    })
    const result = await invoke('new-checkout')
    const path = join(repository, '.agents/worktrees/new-checkout')
    expect(result.isError).not.toBe(true)
    expect(result.value).toEqual({ path, branch: 'new-checkout', baseCommit, repositoryRoot: repository })
    expect(result.content).toEqual([{ type: 'text', text: JSON.stringify(result.value) }])
    expect(context.workingDirectory.get(agent.session)).toBe(path)
    expect(await readFile(join(path, 'file.txt'), 'utf8')).toBe('committed\n')

    const failure = await context.tools.execute({
      name: 'create_worktree', callId: ToolCallId('no-agent'), arguments: {}, signal: new AbortController().signal,
    })
    expect(failure.isError).toBe(true)
    expect(failure.content.flatMap(block => block.type === 'text' ? [block.text] : []).join('\n')).toContain('requires a calling agent')
    expect(context.tools.get('create_worktree')!.presentCall!({ name: 'named' })).toEqual({ card: 'generic', title: 'create_worktree', rawInput: { name: 'named' } })
    const entry = [...context.loader.entries()].find(candidate => candidate.options.name === 'cordis:@x1a0f3n9/dsh-experimental-tool-worktree')
    await entry!.fiber!.dispose()
    expect(context.tools.schemas().some(tool => tool.name === 'create_worktree')).toBe(false)
  })
})
