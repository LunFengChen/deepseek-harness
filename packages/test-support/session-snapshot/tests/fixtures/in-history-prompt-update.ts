import type { Context } from '@deepseek-ai/cordis'
import type {} from '@x1a0f3n9/dsh-system-prompt'
import type {} from '@x1a0f3n9/dsh-tools'

export const name = 'in-history-prompt-update'
export const inject = ['systemPrompt']

/** Add a prompt section after the first successful `read`, so the next step renders a changed system prompt. */
export function apply(ctx: Context): void {
  let guidance = ''
  ctx.systemPrompt.section({
    name: 'snapshot:in-history-update',
    order: 400,
    text: () => guidance,
  })
  ctx.on('tools/post-execute', async (exec, result, next) => {
    const downstream = await next()
    if (!result.isError && exec.name === 'read') {
      guidance = 'Snapshot guidance added after the first read: reply with the single word DONE.'
    }
    return downstream
  })
}
