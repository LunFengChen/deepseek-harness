/** Turns on the official endpoint report credential failures on the model request, after the prompt is recorded. */
import { afterEach, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage } from '@x1a0f3n9/dsh-llm'
import AgentRegistry from '@x1a0f3n9/dsh-agent'
import AgentLoop from '@x1a0f3n9/dsh-agent-loop'
import SessionStore, { SessionId } from '@x1a0f3n9/dsh-session'
import SessionProjectionRegistry from '@x1a0f3n9/dsh-session-projection'
import SystemPrompt from '@x1a0f3n9/dsh-system-prompt'
import ToolRuntime from '@x1a0f3n9/dsh-tools'
import * as DeepSeek from '@x1a0f3n9/dsh-llm-deepseek-api-key'

const contexts: Context[] = []
afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

it('records the prompt and fails the request when the official endpoint has a malformed key', async () => {
  vi.stubEnv('DEEPSEEK_API_KEY', 'invalid\nheader')
  const fetch = vi.spyOn(globalThis, 'fetch')
  const ctx = new Context()
  contexts.push(ctx)
  for (const plugin of [LlmRuntime, SessionStore, SessionProjectionRegistry, SystemPrompt, ToolRuntime, AgentRegistry]) {
    await ctx.plugin(plugin)
  }
  await ctx.plugin(AgentLoop, { agents: [] })
  await ctx.plugin(DeepSeek, {})
  const agent = await ctx.agentLoop.create(SessionId('malformed-official-key'), { provider: 'deepseek-official', model: 'deepseek-flash' })
  agent.followup(createUserMessage({ content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' } }))
  await agent.whenIdle()
  const events = agent.session.snapshotEvents()
  expect(events.map(event => event.type)).toContain('user/message')
  expect(events.find(event => event.type === 'assistant/attempt')?.data).toMatchObject({
    stream: [{ chunk: { type: 'finish', reason: { kind: 'error', failure: { code: 'INVALID_CREDENTIAL' } } } }],
  })
  expect(fetch).not.toHaveBeenCalled()
})
