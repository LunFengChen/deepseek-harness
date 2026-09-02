/**
 * dsh-lsp's owned branded id: {@link LspProviderId}, the opaque identity a provider reserves on
 * `ctx.lsp`. The `Branded<B>` primitive lives in `@xfcodeai/dsh-brand`; keeping the type and its
 * factory together here lets `index.ts` re-export both under one name.
 * @module @xfcodeai/dsh-lsp/brand
 */

import type { Branded } from '@xfcodeai/dsh-brand'

/** Opaque provider identity, reserved atomically with its extension mappings at registration. */
export type LspProviderId = Branded<'LspProviderId'>

/**
 * Brand a string as an {@link LspProviderId}. No validation — the registry rejects an empty id at
 * registration.
 * @param id - the provider's stable identifier.
 * @returns the same string, branded.
 */
export function LspProviderId(id: string): LspProviderId {
  return id as LspProviderId
}
