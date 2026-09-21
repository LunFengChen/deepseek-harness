/** A real Loader and AgentLoop exercise independently configured browser inference and durable screenshots. */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@x1a0f3n9/dsh-agent'
import AgentLoop from '@x1a0f3n9/dsh-agent-loop'
import BrowserUseRegistry from '@x1a0f3n9/dsh-browser-use'
import LocalAttachmentStore from '@x1a0f3n9/dsh-attachment-local'
import LlmRuntime, { LlmAdapter, ToolCallId, createUserMessage } from '@x1a0f3n9/dsh-llm'
import type { GenerateOptions, LlmResolvedModelInfo, StreamChunk } from '@x1a0f3n9/dsh-llm'
import SessionStore, { SessionId } from '@x1a0f3n9/dsh-session'
import SessionProjectionRegistry from '@x1a0f3n9/dsh-session-projection'
import SystemPrompt from '@x1a0f3n9/dsh-system-prompt'
import ToolRuntime from '@x1a0f3n9/dsh-tools'
import * as Provider from '../src/index.ts'
import { resetFixture, screenshotBase64 } from './fixtures/stagehand.ts'

vi.mock('@browserbasehq/stagehand', async importActual => ({
  ...await import('./fixtures/stagehand.ts'),
  StagehandClientCreateConfigSchema: (await importActual<typeof import('@browserbasehq/stagehand')>()).StagehandClientCreateConfigSchema,
}))
vi.mock('@puppeteer/browsers', async () => import('./fixtures/chromium.ts'))
vi.mock('node:worker_threads', async (importActual) => {
  const actual = await importActual<typeof import('node:worker_threads')>()
  return {
    ...actual,
    Worker: class extends actual.Worker {
      constructor(entry: string | URL, options: import('node:worker_threads').WorkerOptions) {
        const hooks = new URL('../../../../snapshots/session/browser-use-stagehand-native/native-fixture.mjs', import.meta.url)
        const bootstrap = `import { installExternalBrowserHooks } from ${JSON.stringify(hooks.href)}; installExternalBrowserHooks(); await import(${JSON.stringify(String(entry))});`
        super(new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`), options)
      }
    },
  }
})

class BrowserModel extends LlmAdapter {
  mainRequests: GenerateOptions[] = []
  override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    return Promise.resolve({ provider, id: model, name: model, inputModalities: ['text', 'image'] })
  }
  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    this.mainRequests.push(options)
    if (this.mainRequests.length <= 2) {
      const first = this.mainRequests.length === 1
      yield { type: 'block-end', index: 0, block: {
        type: 'tool-call', id: ToolCallId(first ? 'extract-heading' : 'screenshot'),
        name: first ? 'stagehand_extract' : 'stagehand_screenshot',
        arguments: first ? '{"instruction":"Extract the heading"}' : '{}',
      } }
      yield { type: 'finish', reason: { kind: 'tool-calls' } }
      return
    }
    yield { type: 'block-end', index: 0, block: { type: 'text', text: 'Observed the fixture heading.' } }
    yield { type: 'finish', reason: { kind: 'stop' } }
  }
}

let ctx: Context | undefined
let root: string | undefined
afterEach(async () => {
  await ctx?.fiber.dispose()
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  ctx = undefined
  root = undefined
})

it('loads browser tools from cordis.yml, logs browser results, and admits the screenshot', async () => {
  resetFixture()
  root = await mkdtemp(join(tmpdir(), 'dsh-stagehand-composition-'))
  const modules = new Map<string, unknown>([
    ['@x1a0f3n9/dsh-llm', LlmRuntime],
    ['@x1a0f3n9/dsh-session', SessionStore],
    ['@x1a0f3n9/dsh-session-projection', SessionProjectionRegistry],
    ['@x1a0f3n9/dsh-system-prompt', SystemPrompt],
    ['@x1a0f3n9/dsh-tools', ToolRuntime],
    ['@x1a0f3n9/dsh-agent', AgentRegistry],
    ['@x1a0f3n9/dsh-agent-loop', AgentLoop],
    ['@x1a0f3n9/dsh-attachment-local', LocalAttachmentStore],
    ['@x1a0f3n9/dsh-browser-use', BrowserUseRegistry],
    ['@x1a0f3n9/dsh-experimental-browser-use-stagehand-native', Provider],
  ])
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [...modules.keys()].flatMap(name => [
    `- name: '${name}'`,
    ...name === '@x1a0f3n9/dsh-attachment-local' ? ['  config:', `    dshHome: ${JSON.stringify(root)}`] : [],
    ...name === '@x1a0f3n9/dsh-experimental-browser-use-stagehand-native' ? ['  config:', '    mode: launch', '    model:', '      modelName: openai/gpt-5.4-mini', '      apiKey: fixture-model-key'] : [],
  ]).join('\n') + '\n')
  const context = ctx = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`Unexpected fixture module: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({ name: 'cordis:include', config: { path: pathToFileURL(configPath).href } })
  await context.loader.await()
  for (const entry of context.loader.entries()) await entry.fiber?.await()
  const model = new BrowserModel()
  context.llm.registerAdapter(['fixture'], model)
  const agent = await context.agentLoop.create(SessionId('stagehand-loader'), { provider: 'fixture', model: 'vision' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'Extract the heading and take a screenshot.' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  expect(model.mainRequests).toHaveLength(3)
  const events = agent.session.snapshotEvents()
  expect(events.some(event => event.type.startsWith('browser-use/'))).toBe(false)
  expect(JSON.stringify(model.mainRequests)).not.toContain('fixture-model-key')
  const extraction = events.find(event => event.type === 'tool/result' && event.data.message.source.callId === 'extract-heading')
  expect(JSON.stringify(extraction)).toContain('Fixture heading')
  const result = events.find(event => event.type === 'tool/result' && event.data.message.source.callId === 'screenshot')
  if (result?.type !== 'tool/result') throw new Error('Missing screenshot result')
  const tool = result.data.message.content[0]
  if (tool?.type !== 'tool-result') throw new Error('Missing tool result content')
  const image = tool.content.find(block => block.type === 'image')
  if (image?.type !== 'image') throw new Error('Missing durable screenshot')
  const stored = await context.attachments.readImage(image.attachment)
  expect(Buffer.from(stored.data).toString('base64')).toBe(screenshotBase64)
  expect(JSON.stringify(model.mainRequests.at(-1)?.messages)).toContain(JSON.stringify(image.attachment))
  expect(JSON.stringify(model.mainRequests.at(-1)?.messages)).not.toContain(screenshotBase64)
})
