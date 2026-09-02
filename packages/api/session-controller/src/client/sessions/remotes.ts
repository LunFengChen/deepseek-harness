/**
 * Remote namespaces the Session cluster calls. One parameter for one concept:
 * the generated surface a Session and its manager reach the Host through.
 *
 * @module @xfcodeai/dsh-api-session-controller/client/sessions/remotes
 */

import type { EncodedImageAttachment } from '@xfcodeai/dsh-attachment/types'
import type { ClientRemote } from '@xfcodeai/dsh-api-gateway/client'
import type { SessionId } from '@xfcodeai/dsh-session/types'
import type {
  SubagentCatalog, SubagentInterruptReceipt, SubagentPromptReceipt, SubagentPromptRequest,
} from '@xfcodeai/dsh-subagent/client'
import type { RemoteResult } from '@xfcodeai/dsh-typert-protocol'
import type { SessionRemote } from '../transport.ts'

/** Narrow Commands namespace consumed by a Client Session. */
export interface SessionCommandsRemote {
  execute(
    agentId: SessionId,
    line: string,
    images: readonly EncodedImageAttachment[],
    signal?: AbortSignal,
  ): Promise<RemoteResult<object | undefined>>
}

/** Narrow subagent namespace consumed by a Client Session and its manager. */
export interface SessionSubagentsRemote {
  list(parentSessionId: SessionId, signal?: AbortSignal): Promise<RemoteResult<SubagentCatalog>>
  prompt(
    request: SubagentPromptRequest,
    signal?: AbortSignal,
  ): Promise<RemoteResult<SubagentPromptReceipt>>
  interruptByParent(
    childSessionId: SessionId,
    parentSessionId: SessionId,
    mode: 'continuable',
  ): Promise<RemoteResult<SubagentInterruptReceipt>>
}

/** Generated Remote namespaces consumed by the Client Session object layer. */
export interface SessionRemotes {
  readonly $stream: ClientRemote['$stream']
  readonly commands: SessionCommandsRemote
  readonly session: SessionRemote
  readonly subagents: SessionSubagentsRemote
}
