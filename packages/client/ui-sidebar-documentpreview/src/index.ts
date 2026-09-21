/** Host configuration for browser document previews. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@x1a0f3n9/dsh-host-webserver'
import type { Config } from './config.ts'

export { Config } from './config.ts'

/**
 * Embed validated preview settings in browser pages.
 * @param ctx - Host context serving browser pages.
 * @param config - Cache limits adopted when the page loads.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: '__DSH_DOCUMENT_PREVIEW_CONFIG__', value: config })
  })
}
