/**
 * pi-ai assistant event translation into the Harness streaming protocol.
 *
 * pi-ai tool-call arguments are parsed objects while the Harness keeps their
 * raw JSON representation. pi-ai also reports failures as terminal stream
 * events, which this module maps into Harness finish chunks.
 *
 * @module dsh-llm-pi-ai/stream
 */

import { brandString } from '@x1a0f3n9/dsh-brand'
import { CONTEXT_WINDOW_EXCEEDED_CODE, EMPTY_RESPONSE_CODE, isContextWindowExceededError, isQuotaExceededError, LlmError, ProviderRequestId, QUOTA_EXCEEDED_CODE } from '@x1a0f3n9/dsh-llm'
import type { FinishReason, StreamChunk, TokenUsage, ToolCallId } from '@x1a0f3n9/dsh-llm'
import { isContextOverflow } from '@earendil-works/pi-ai'
import type { AssistantMessage, AssistantMessageEvent, Usage as PiUsage } from '@earendil-works/pi-ai'
import { toPiReplayState } from './replay.ts'


/** Mutable, request-scoped facts captured beside a pi-ai stream for user-visible diagnostics. */
export interface PiAiStreamDiagnostics {
  /** Harness provider route selected for the request. */
  provider?: string
  /** Model id selected for the request. */
  model?: string
  /** pi-ai wire protocol selected for the request. */
  api?: string
  /** Provider endpoint selected for the request. */
  baseURL?: string
  /** HTTP status captured before the response body stream was consumed. */
  status?: number
  /** Provider/gateway request id captured from response headers, when available. */
  requestId?: string
  /** Last pi-ai event translated before a terminal failure. */
  lastEventType?: AssistantMessageEvent['type']
  /** Whether any user-visible text/reasoning/tool-call content was observed. */
  sawContent?: boolean
  /** Counts of pi-ai events observed before a terminal failure. */
  eventCounts?: Partial<Record<AssistantMessageEvent['type'], number>>
}

/**
 * Map pi-ai usage (reasoning folded into output by pi-ai).
 * @param usage - cumulative usage from the terminal pi-ai event.
 * @returns harness counts; cache fields appear only when non-zero (pi-ai reports zeros, not absence).
 */
export function mapUsage(usage: PiUsage): TokenUsage {
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    totalTokens: usage.totalTokens,
    ...usage.cacheRead > 0 ? { cacheReadTokens: usage.cacheRead } : {},
    ...usage.cacheWrite > 0 ? { cacheWriteTokens: usage.cacheWrite } : {},
  }
}

// XXX(pi-ai upstream): pi-ai flattens the caught error to `error.message`
// (api/anthropic-messages.js: `errorMessage = error instanceof Error ?
// error.message : JSON.stringify(error)`), discarding the original Error and its
// `cause` chain before it reaches us. undici carries the actionable transport
// detail on `cause` (e.g. `SocketError: other side closed`) but hands the fetch
// wrapper a bare `terminated`, so we are left pattern-matching terse words here.
// If pi-ai ever forwards the original Error (or a fetch/dispatcher hook that lets
// us capture the cause ourselves), classify on `code`/`cause` instead of text.
function classifyPiAiError(message: string): string {
  // This wording is thrown by pi-ai's OpenAI Chat Completions parser after the
  // HTTP/SSE body ends without a protocol finish marker. It used to be treated
  // as a terminal protocol bug; providers that truncate mid-stream under load
  // also throw it, so the default retry policy now retries PI_AI_ERROR as well.
  if (/^Stream ended without finish_reason$/i.test(message.trim())) return 'PI_AI_ERROR'
  if (/\b(?:401|403)\b/.test(message)) return 'AUTH'
  if (isQuotaExceededError(message)) return QUOTA_EXCEEDED_CODE
  if (/\b429\b|rate.?limit/i.test(message)) return 'RATE_LIMIT'
  if (/\b413\b|failed to buffer the request body:\s*length limit exceeded|payload too large|request body too large/i.test(message)) return 'INVALID_REQUEST'
  if (/\b400\b|invalid.?request/i.test(message)) return 'INVALID_REQUEST'
  // Gateway 5xx failures surface either as a numeric status (`500`) or as
  // OpenAI-style error codes (`internal_server_error`, `server_error`); both
  // are transient server faults and belong to the retryable SERVER class.
  if (/\b(?:internal_)?server_error\b|\b5\d\d\b/i.test(message)) return 'SERVER'
  if (/\btime(?:d)?\s*out\b|timeout/i.test(message)) return 'TIMEOUT'
  // A stream truncated before the provider's terminal event: most pi-ai providers
  // throw their own wording when the wire closes mid-response without a terminal
  // event (`… stream ended before message_stop`, `… before a terminal response
  // event`, `… ended without a terminal event`). The OpenAI Chat Completions
  // `finish_reason` invariant above is intentionally handled before this broad
  // wording so a gateway protocol bug does not get retried as a socket drop.
  if (/stream ended (?:before|without)\b/i.test(message)) return 'TRANSPORT'
  if (/\b(?:network|connection|socket|fetch)\b|\bECONN[A-Z]+\b/i.test(message)
    || /\b(?:other side closed|HTTP2 request did not get a response|WebSocket closed unexpectedly)\b/i.test(message)
    // undici renders a mid-stream socket drop as a bare `terminated` (its
    // `cause` — the real SocketError — was flattened away upstream); Node's
    // stream layer says `Premature close`.
    || /\bterminated\b|premature close/i.test(message)) {
    return 'TRANSPORT'
  }
  return 'PI_AI_ERROR'
}


function safeBaseURL(value: string | undefined): string | undefined {
  if (value === undefined || value.length === 0) return undefined
  try {
    const url = new URL(value)
    url.username = ''
    url.password = ''
    url.search = ''
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch (_invalidUrl) {
    return value.split(/[?#]/, 1)[0]
  }
}

function eventCountSummary(counts: PiAiStreamDiagnostics['eventCounts']): string | undefined {
  const entries = Object.entries(counts ?? {}).filter(([, count]) => count !== undefined && count > 0)
  if (entries.length === 0) return undefined
  return entries.map(([type, count]) => `${type}:${count}`).join('|')
}

function appendDiagnostics(text: string, diagnostics: PiAiStreamDiagnostics | undefined): string {
  if (diagnostics === undefined) return text
  const detail: string[] = []
  const provider = diagnostics.provider
  const model = diagnostics.model
  const api = diagnostics.api
  const baseURL = safeBaseURL(diagnostics.baseURL)
  if (provider !== undefined && provider.length > 0) detail.push(`provider=${provider}`)
  if (model !== undefined && model.length > 0) detail.push(`model=${model}`)
  if (api !== undefined && api.length > 0) detail.push(`api=${api}`)
  if (baseURL !== undefined) detail.push(`baseURL=${baseURL}`)
  if (diagnostics.status !== undefined) detail.push(`status=${diagnostics.status}`)
  if (diagnostics.requestId !== undefined && diagnostics.requestId.length > 0) detail.push(`requestId=${diagnostics.requestId}`)
  if (diagnostics.lastEventType !== undefined) detail.push(`lastEvent=${diagnostics.lastEventType}`)
  if (diagnostics.sawContent !== undefined) detail.push(`sawContent=${diagnostics.sawContent ? 'yes' : 'no'}`)
  const counts = eventCountSummary(diagnostics.eventCounts)
  if (counts !== undefined) detail.push(`events=${counts}`)
  return detail.length === 0 ? text : `${text} (${detail.join(', ')})`
}

function diagnosticFailureFacts(diagnostics: PiAiStreamDiagnostics | undefined): {
  status?: number
  requestId?: ReturnType<typeof ProviderRequestId>
} {
  const status = diagnostics?.status
  const requestId = diagnostics?.requestId
  return {
    ...status !== undefined && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {},
    ...requestId !== undefined && requestId.length > 0 ? { requestId: ProviderRequestId(requestId) } : {},
  }
}

function recordDiagnosticEvent(
  diagnostics: PiAiStreamDiagnostics | undefined,
  event: AssistantMessageEvent,
): void {
  if (diagnostics === undefined) return
  diagnostics.lastEventType = event.type
  diagnostics.eventCounts ??= {}
  diagnostics.eventCounts[event.type] = (diagnostics.eventCounts[event.type] ?? 0) + 1
  if (event.type === 'text_delta'
    || event.type === 'thinking_delta'
    || event.type === 'toolcall_delta'
    || event.type === 'text_end'
    || event.type === 'thinking_end'
    || event.type === 'toolcall_end') {
    diagnostics.sawContent = true
  } else {
    diagnostics.sawContent ??= false
  }
}

/**
 * Map a terminal pi-ai event to the harness finish reason.
 * @param message - the assistant message carried by the `done` or `error` event.
 * @param contextWindow - resolved catalog capacity for usage-based overflow detection.
 * @param diagnostics - optional per-stream facts used to classify provider failures.
 * @returns the mapped harness reason. Recognized error text, `stop` usage above
 *   `contextWindow`, and zero-output `length` usage that fills the window map
 *   to `CONTEXT_WINDOW_EXCEEDED`; a `stop` with no content blocks maps to an
 *   `EMPTY_RESPONSE` error.
 */
export function mapStopReason(
  message: AssistantMessage,
  contextWindow?: number,
  diagnostics?: PiAiStreamDiagnostics,
): FinishReason {
  const piAiOverflow = isContextOverflow(message, contextWindow)
  const harnessOverflow = message.stopReason === 'error'
    && message.errorMessage !== undefined
    && isContextWindowExceededError(message.errorMessage)
  if (piAiOverflow || harnessOverflow) {
    return {
      kind: 'error',
      failure: {
        message: message.errorMessage ?? `pi-ai detected context overflow for model "${message.model}"`,
        code: CONTEXT_WINDOW_EXCEEDED_CODE,
      },
    }
  }

  switch (message.stopReason) {
    case 'stop':
      // A terminal stop that produced no content blocks is a degenerate
      // provider completion, not a successful (empty) assistant message.
      if (message.content.length === 0) {
        return {
          kind: 'error',
          failure: {
            message: `model "${message.model}" returned a completed response with no content`,
            code: EMPTY_RESPONSE_CODE,
          },
        }
      }
      return { kind: 'stop' }
    case 'length': return { kind: 'max-tokens' }
    case 'toolUse': return { kind: 'tool-calls' }
    case 'pending': return {
      kind: 'error',
      failure: { message: `pi-ai stream for model "${message.model}" ended pending`, code: 'PI_AI_ERROR' },
    }
    case 'deferred': return {
      kind: 'error',
      failure: { message: `pi-ai deferred response for model "${message.model}" is not supported`, code: 'PI_AI_ERROR' },
    }
    case 'aborted': return {
      kind: 'aborted',
      failure: { message: message.errorMessage ?? 'pi-ai stream aborted', code: 'ABORTED' },
    }
    case 'error': {
      const text = message.errorMessage ?? 'pi-ai stream error'
      return {
        kind: 'error',
        failure: {
          message: appendDiagnostics(text, diagnostics),
          code: classifyPiAiError(text),
          ...diagnosticFailureFacts(diagnostics),
        },
      }
    }
    /* v8 ignore next -- pi-ai's closed stop-reason union is exhaustive. */
    default: throw new LlmError(`pi-ai returned an unknown stop reason: ${String(message.stopReason)}`, 'PI_AI_ERROR')
  }
}

/**
 * Translate the pi-ai event stream into StreamChunks. pi-ai never throws
 * mid-stream — failures arrive as `error` events, which become error/aborted
 * `finish` chunks (the harness protocol's other error-delivery style).
 * @param events - one assistant turn's pi-ai event stream.
 * @param contextWindow - resolved catalog capacity for usage-based overflow detection.
 * @param diagnostics - optional per-stream facts used to classify provider failures.
 * @param callerSignal - caller cancellation state; an aborted caller makes any in-band terminal error an aborted finish.
 * @returns the harness chunks, ending with `usage` then `finish`; throws
 *   `LlmError` (`STREAM_CLOSED`) if the source ends without a terminal event.
 */
export async function* toStreamChunks(
  events: AsyncIterable<AssistantMessageEvent>,
  contextWindow?: number,
  diagnostics?: PiAiStreamDiagnostics,
  callerSignal?: AbortSignal,
): AsyncGenerator<StreamChunk> {
  // pi-ai contentIndex ↔ our block index map 1:1 (both count blocks from 0
  // in stream order), but we track ids per index for tool calls.
  const toolIds = new Map<number, { id: string; name: string }>()

  for await (const event of events) {
    recordDiagnosticEvent(diagnostics, event)
    switch (event.type) {
      case 'start':
        break
      case 'text_start':
        yield { type: 'block-start', index: event.contentIndex, blockType: 'text' }
        break
      case 'text_delta':
        yield { type: 'text-delta', index: event.contentIndex, text: event.delta }
        break
      case 'text_end':
        yield { type: 'block-end', index: event.contentIndex, block: { type: 'text', text: event.content } }
        break
      case 'thinking_start':
        yield { type: 'block-start', index: event.contentIndex, blockType: 'reasoning' }
        break
      case 'thinking_delta':
        yield { type: 'reasoning-delta', index: event.contentIndex, text: event.delta }
        break
      case 'thinking_end':
        yield { type: 'block-end', index: event.contentIndex, block: { type: 'reasoning', text: event.content } }
        break
      case 'toolcall_start': {
        // The id/name live on the partial's content at this index.
        const partial = event.partial.content[event.contentIndex]
        const id = partial?.type === 'toolCall' ? partial.id : ''
        const name = partial?.type === 'toolCall' ? partial.name : ''
        toolIds.set(event.contentIndex, { id, name })
        yield { type: 'block-start', index: event.contentIndex, blockType: 'tool-call' }
        break
      }
      case 'toolcall_delta': {
        const known = toolIds.get(event.contentIndex)
        yield {
          type: 'tool-call-delta',
          index: event.contentIndex,
          id: brandString<ToolCallId>(known?.id ?? ''),
          ...known?.name !== undefined && known.name.length > 0 ? { name: known.name } : {},
          argumentsDelta: event.delta,
        }
        break
      }
      case 'toolcall_end':
        yield {
          type: 'block-end',
          index: event.contentIndex,
          block: {
            type: 'tool-call',
            id: brandString<ToolCallId>(event.toolCall.id),
            name: event.toolCall.name,
            // pi-ai hands back the PARSED arguments; the harness vocabulary
            // keeps the raw string.
            arguments: JSON.stringify(event.toolCall.arguments),
          },
        }
        break
      case 'done':
        yield { type: 'usage', usage: mapUsage(event.message.usage) }
        yield {
          type: 'finish',
          reason: mapStopReason(event.message, contextWindow, diagnostics),
          replayState: toPiReplayState(event.message),
        }
        return
      case 'error':
        // In-stream error delivery (pi-ai's style) → error finish chunk
        // (the harness's other sanctioned error path besides throwing).
        yield { type: 'usage', usage: mapUsage(event.error.usage) }
        yield {
          type: 'finish',
          reason: mapStopReason(
            callerSignal?.aborted ? { ...event.error, stopReason: 'aborted' } : event.error,
            contextWindow,
            diagnostics,
          ),
        }
        return
      // no default: AssistantMessageEvent is pi-ai's closed union; a new
      // event type should fail compilation here via tsc's exhaustiveness
      // when one is added (switch covers all current variants).
    }
  }
  // The generator's own closure failure: no terminal pi-ai event arrived. The
  // request facts this generator observed still belong on the error.
  const failure = {
    ...diagnostics === undefined
      ? { message: 'pi-ai event stream ended without done/error' }
      : { message: appendDiagnostics('pi-ai event stream ended without done/error', diagnostics) },
    ...diagnosticFailureFacts(diagnostics),
  }
  throw new LlmError(failure.message, 'STREAM_CLOSED', failure.status !== undefined || failure.requestId !== undefined
    ? {
      ...failure.status !== undefined ? { status: failure.status } : {},
      ...failure.requestId !== undefined ? { requestId: failure.requestId } : {},
    }
    : undefined)
}
