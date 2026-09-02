/** Browser-safe Connection protocol and shared application value exports. */

export type {
  ClientRequest,
  RpcMessage,
  RpcRequest,
  RpcResponse,
  RpcResult,
  ServerResponse,
} from '../rpc.ts'
export { RpcId, transportError } from '../rpc.ts'
export type { SessionId, SessionEvent } from '@xfcodeai/dsh-session/types'
export type { MessageId } from '@xfcodeai/dsh-llm/brand'
export type { ContentBlock, StreamChunk } from '@xfcodeai/dsh-llm/types'

import type { RpcResponse, RpcResult } from '../rpc.ts'

/**
 * Return the business result carried by a narrow fixture response.
 * @param response - fixture response to unwrap.
 * @returns the response's business result.
 */
export function resultOf<T>(response: RpcResponse<T>): RpcResult<T> {
  return response.result
}
