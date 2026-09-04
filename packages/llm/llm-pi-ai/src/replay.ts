/**
 * Durable pi-ai replay metadata and assistant-history reconstruction.
 *
 * Harness content remains the durable source for text and tool calls. This
 * module stores only the provider-native metadata needed to reconstruct a
 * pi-ai assistant message on a later request.
 *
 * @module dsh-llm-pi-ai/replay
 */

import { LlmError } from '@deepseek-ai/dsh-llm'
import type { Message, ModelMessageSource } from '@deepseek-ai/dsh-llm'
import type { Api, AssistantMessage, Usage as PiUsage } from '@earendil-works/pi-ai'

type PiAiReplayBlock =
  | { type: 'text'; textSignature?: string }
  | { type: 'reasoning'; thinkingSignature?: string; redacted?: boolean }
  | { type: 'tool-call'; thoughtSignature?: string }

/** Versioned adapter-private projection required to replay a pi-ai response. */
export interface PiAiReplayState {
  kind: 'pi-ai'
  version: 1
  api: Api
  provider: string
  model: string
  responseModel?: string
  responseId?: string
  stopReason: AssistantMessage['stopReason']
  blocks: PiAiReplayBlock[]
}

/** Earlier web sessions persisted pi-ai replay metadata with the response
 *  identity under `response` and block metadata beside it. Keep accepting that
 *  shape so important existing sessions can continue with the native Responses
 *  response id/signatures instead of degrading to a foreign assistant message.
 */
interface WrappedPiAiReplayStateV2 {
  response: {
    kind: 'pi-ai'
    version: 2
    api: Api
    provider: string
    model: string
    responseModel?: string
    responseId?: string
    stopReason: AssistantMessage['stopReason']
  }
  blocks: PiAiReplayBlock[]
}

/** Parse tool-call argument JSON; tolerate model malformations with {}. */
function parseArguments(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fall through
  }
  return {}
}

/** Construct the zero usage value required by historical pi-ai messages. */
function emptyPiUsage(): PiUsage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  }
}

/**
 * Project a successful pi-ai response into the minimal durable replay state.
 * @param message - completed native pi-ai assistant response.
 * @returns the versioned lossless-JSON replay projection.
 */
export function toPiReplayState(message: AssistantMessage): PiAiReplayState {
  return {
    kind: 'pi-ai',
    version: 1,
    api: message.api,
    provider: message.provider,
    model: message.model,
    ...message.responseModel === undefined ? {} : { responseModel: message.responseModel },
    ...message.responseId === undefined ? {} : { responseId: message.responseId },
    stopReason: message.stopReason,
    blocks: message.content.map((block): PiAiReplayBlock => {
      switch (block.type) {
        case 'text': return {
          type: 'text',
          ...block.textSignature === undefined ? {} : { textSignature: block.textSignature },
        }
        case 'thinking': return {
          type: 'reasoning',
          ...block.thinkingSignature === undefined ? {} : { thinkingSignature: block.thinkingSignature },
          ...block.redacted === undefined ? {} : { redacted: block.redacted },
        }
        case 'toolCall': return {
          type: 'tool-call',
          ...block.thoughtSignature === undefined ? {} : { thoughtSignature: block.thoughtSignature },
        }
      }
    }),
  }
}

function invalidReplay(message: string): never {
  throw new LlmError(`invalid pi-ai replay state: ${message}`, 'INVALID_REPLAY_STATE')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validateReplayCore(state: Record<string, unknown>): void {
  for (const key of ['api', 'provider', 'model'] as const) {
    if (typeof state[key] !== 'string' || state[key].length === 0) return invalidReplay(`${key} must be a non-empty string`)
  }
  if (!['stop', 'length', 'toolUse', 'error', 'aborted'].includes(String(state['stopReason']))) {
    return invalidReplay('unknown stopReason')
  }
  if (state['responseModel'] !== undefined && typeof state['responseModel'] !== 'string') return invalidReplay('responseModel must be a string')
  if (state['responseId'] !== undefined && typeof state['responseId'] !== 'string') return invalidReplay('responseId must be a string')
}

function validateReplayBlocks(blocks: unknown): void {
  if (!Array.isArray(blocks)) return invalidReplay('blocks must be an array')
  for (const [index, value] of blocks.entries()) {
    if (!isRecord(value)) return invalidReplay(`block ${index} must be an object`)
    const block = value
    if (!['text', 'reasoning', 'tool-call'].includes(String(block['type']))) return invalidReplay(`block ${index} has an unknown type`)
    for (const signature of ['textSignature', 'thinkingSignature', 'thoughtSignature'] as const) {
      if (block[signature] !== undefined && typeof block[signature] !== 'string') return invalidReplay(`block ${index} ${signature} must be a string`)
    }
    if (block['redacted'] !== undefined && typeof block['redacted'] !== 'boolean') return invalidReplay(`block ${index} redacted must be boolean`)
  }
}

function normalizeWrappedReplayState(state: Record<string, unknown>): PiAiReplayState | undefined {
  if (!isRecord(state['response'])) return undefined
  const response = state['response']
  // Replay metadata is adapter-private: if another adapter's wrapped state
  // reaches pi-ai, treat it as absent instead of crashing the whole chat replay
  // path.
  if (response['kind'] !== 'pi-ai') return undefined
  if (response['version'] !== 2) return invalidReplay(`unsupported wrapped version ${String(response['version'])}`)
  validateReplayCore(response)
  validateReplayBlocks(state['blocks'])
  const wrapped = state as unknown as WrappedPiAiReplayStateV2
  return {
    kind: 'pi-ai',
    version: 1,
    api: wrapped.response.api,
    provider: wrapped.response.provider,
    model: wrapped.response.model,
    ...wrapped.response.responseModel === undefined ? {} : { responseModel: wrapped.response.responseModel },
    ...wrapped.response.responseId === undefined ? {} : { responseId: wrapped.response.responseId },
    stopReason: wrapped.response.stopReason,
    blocks: wrapped.blocks,
  }
}

/** Validate the adapter-private state before it reaches pi-ai. */
function readReplayState(value: unknown): PiAiReplayState | undefined {
  if (!isRecord(value)) return invalidReplay('expected an object')
  const state = value
  // Replay metadata is adapter-private: if another adapter's state reaches pi-ai,
  // treat it as absent instead of crashing the whole chat replay path.
  const wrapped = normalizeWrappedReplayState(state)
  if (wrapped !== undefined) return wrapped
  if (state['kind'] !== 'pi-ai') return undefined
  if (state['version'] !== 1) return invalidReplay(`unsupported version ${String(state['version'])}`)
  validateReplayCore(state)
  validateReplayBlocks(state['blocks'])
  return state as unknown as PiAiReplayState
}

/** Convert provider-neutral blocks without trusting them as same-model replay. */
function foreignAssistant(message: Message): AssistantMessage {
  const source = message.source.kind === 'model' ? message.source : undefined
  const content: AssistantMessage['content'] = []
  for (const block of message.content) {
    switch (block.type) {
      case 'text': content.push({ type: 'text', text: block.text }); break
      case 'reasoning': content.push({ type: 'thinking', thinking: block.text }); break
      case 'tool-call': content.push({
        type: 'toolCall',
        id: block.id,
        name: block.name,
        arguments: parseArguments(block.arguments),
      }); break
      case 'image':
        throw new LlmError('pi-ai chat history cannot represent structured assistant image output', 'UNSUPPORTED_CONTENT')
      default:
        // plugin-added block types are not representable in pi-ai.
        break
    }
  }
  return {
    role: 'assistant',
    content,
    // Deliberately never equals a catalog API: absent replay state is foreign
    // even if source names the same provider/model as this request.
    api: 'dsh-foreign',
    provider: source?.provider ?? 'dsh-foreign',
    model: source?.model ?? 'dsh-foreign',
    usage: emptyPiUsage(),
    stopReason: content.some(piece => piece.type === 'toolCall') ? 'toolUse' : 'stop',
    timestamp: 0,
  }
}

/** Recombine durable Harness content with validated pi-ai replay metadata. */
function replayedAssistant(message: Message, source: ModelMessageSource, rawState: unknown): AssistantMessage {
  const state = readReplayState(rawState)
  if (state === undefined) return foreignAssistant(message)
  if (state.provider !== source.provider) return invalidReplay('provider does not match assistant source')
  if (state.model !== source.model) return invalidReplay('model does not match assistant source')
  if (state.blocks.length !== message.content.length) return invalidReplay('block count does not match assistant content')
  const content: AssistantMessage['content'] = message.content.map((block, index) => {
    const replay = state.blocks[index]
    if (replay === undefined || replay.type !== block.type) return invalidReplay(`block ${index} does not match assistant content`)
    switch (block.type) {
      case 'text': return {
        type: 'text',
        text: block.text,
        ...replay.type === 'text' && replay.textSignature !== undefined ? { textSignature: replay.textSignature } : {},
      }
      case 'reasoning': return {
        type: 'thinking',
        thinking: block.text,
        ...replay.type === 'reasoning' && replay.thinkingSignature !== undefined ? { thinkingSignature: replay.thinkingSignature } : {},
        ...replay.type === 'reasoning' && replay.redacted !== undefined ? { redacted: replay.redacted } : {},
      }
      case 'tool-call': return {
        type: 'toolCall',
        id: block.id,
        name: block.name,
        arguments: parseArguments(block.arguments),
        ...replay.type === 'tool-call' && replay.thoughtSignature !== undefined ? { thoughtSignature: replay.thoughtSignature } : {},
      }
      /* v8 ignore next -- readReplayState rejects unknown replay tags, so an equal plugin-added Harness tag cannot reach this switch */
      default: return invalidReplay(`block ${index} has an unsupported Harness type`)
    }
  })
  return {
    role: 'assistant',
    content,
    api: state.api,
    provider: state.provider,
    model: state.model,
    ...state.responseModel === undefined ? {} : { responseModel: state.responseModel },
    ...state.responseId === undefined ? {} : { responseId: state.responseId },
    usage: emptyPiUsage(),
    stopReason: state.stopReason,
    timestamp: 0,
  }
}

/**
 * Convert one durable Harness assistant message into pi-ai history.
 * @param message - assistant content with required source and optional adapter-owned replay metadata.
 * @returns a native pi-ai assistant message reconstructed from durable content.
 */
export function toPiAssistant(message: Message, onDegrade?: (reason: string) => void): AssistantMessage {
  const source = message.source
  if (source.kind !== 'model' || source.replayState === undefined) return foreignAssistant(message)
  try {
    return replayedAssistant(message, source, source.replayState)
  } catch (error: unknown) {
    /* v8 ignore next -- replayedAssistant throws only INVALID_REPLAY_STATE LlmErrors; the
       guard keeps a future non-replay failure loud instead of silently degrading it */
    if (!(error instanceof LlmError) || error.code !== 'INVALID_REPLAY_STATE') throw error
    onDegrade?.(error.message)
    return foreignAssistant(message)
  }
}
