/** Native source admission preserves unknown attribution and refuses retired plugin wrappers. */

import { SessionFormatError, isSessionFormatJsonObject } from '@x1a0f3n9/dsh-session-format'
import type { SessionFormatEvent, SessionFormatJsonObject } from '@x1a0f3n9/dsh-session-format'
import { mapEventMessages, rewritePluginSource } from './sources.ts'

function jsonObject(value: object): SessionFormatJsonObject {
  return value as SessionFormatJsonObject
}

function source(message: Readonly<Record<string, unknown>>): void {
  const value = message['source']
  if (!isSessionFormatJsonObject(value) || typeof value['kind'] !== 'string' || value['kind'].length === 0 || value['kind'] === 'plugin') {
    throw new SessionFormatError('format v4 message requires a producer-owned source kind')
  }
}

function liftMessage(
  message: SessionFormatJsonObject,
  seq: number,
): SessionFormatJsonObject {
  const value = message['source']
  if (!isSessionFormatJsonObject(value) || value['kind'] !== 'plugin') return message
  return { ...message, source: rewritePluginSource(jsonObject(value), seq, message['role']) }
}

/**
 * Lift retired `{ kind: 'plugin', plugin }` wrappers to producer-owned kinds
 * before native V4 encode. Persistence encodes a turn's `step/start` in the
 * same batch as prefix `user/message` rows; refusing the wrapper drops the
 * whole batch and surfaces as a turn failure. Incomplete slots stay for
 * admission, matching {@link assertV4SourceRowAdmission}.
 * @param event - native event about to be encoded.
 * @returns the event with every complete retired plugin wrapper rewritten.
 */
export function liftRetiredPluginSources(event: SessionFormatEvent): SessionFormatEvent {
  const data = event.data
  if (!isSessionFormatJsonObject(data)) return event
  const payload = jsonObject(data)
  if (event.type === 'user/message') {
    const message = liftMessage(payload, event.seq)
    return message === payload ? event : { ...event, data: message }
  }
  if (event.type === 'developer/message' || event.type === 'system/message'
    || event.type === 'assistant/message' || event.type === 'tool/result') {
    if (!isSessionFormatJsonObject(data['message'])) return event
    const nested = jsonObject(data['message'])
    const message = liftMessage(nested, event.seq)
    return message === nested ? event : { ...event, data: { ...payload, message } }
  }
  const key = event.type === 'agent/inbox/spliced' ? 'inserted'
    : event.type === 'session/title-llm-request' ? 'messages' : undefined
  if (key === undefined || !Array.isArray(data[key])) return event
  let changed = false
  const mapped = data[key].map((item) => {
    if (!isSessionFormatJsonObject(item)) return item
    const current = jsonObject(item)
    const message = liftMessage(current, event.seq)
    if (message !== current) changed = true
    return message
  })
  return changed ? { ...event, data: { ...payload, [key]: mapped } } : event
}

/**
 * Validate producer attribution in every declared durable message slot.
 * @param event - complete native V4 event before Session adoption.
 */
export function assertV4MessageSources(event: SessionFormatEvent): void {
  mapEventMessages(event, (message) => {
    source(message)
    return message
  })
}

/**
 * Refuse retired source syntax even after a malformed recoverable row; leave incomplete messages to decoding.
 * @param row - parsed row whose incomplete values have not been classified by the scanner.
 */
export function assertV4SourceRowAdmission(row: unknown): void {
  if (!isSessionFormatJsonObject(row) || !isSessionFormatJsonObject(row['data'])) return
  const data = row['data']
  const messages = row['type'] === 'user/message' ? [data]
    : row['type'] === 'system/message' || row['type'] === 'assistant/message' || row['type'] === 'tool/result' ? [data['message']]
      : row['type'] === 'agent/inbox/spliced' ? data['inserted']
        : row['type'] === 'session/title-llm-request' ? data['messages'] : []
  if (!Array.isArray(messages)) return
  for (const message of messages) {
    if (!isSessionFormatJsonObject(message)) continue
    const value = message['source']
    if (isSessionFormatJsonObject(value) && value['kind'] === 'plugin') source(message)
  }
}
