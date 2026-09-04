import { describe, expect, it, vi } from 'vitest'
import { chatSnapshotOf, messageTextAt, resolveChatWatch, type HiddenChat } from '../src/client/hidden.ts'

function chat(): HiddenChat {
  return {
    order: ['user-1', 'assistant-1'],
    nodes: {
      get: key => key === 'user-1'
        ? {
          kind: 'user',
          data: { seq: 3, content: [{ type: 'text', text: 'question' }] },
        } as never
        : undefined,
    },
  }
}

describe('client chat view helpers', () => {
  it('reads the assembled chat snapshot without adapting legacy faces', () => {
    const snapshot = chat()
    expect(chatSnapshotOf({ getSnapshot: () => snapshot })).toBe(snapshot)
    expect(chatSnapshotOf(undefined)).toBeUndefined()
    expect(messageTextAt(snapshot, 3)).toBe('question')
  })

  it('subscribes to the current view and returns a no-op when it is absent', () => {
    const dispose = vi.fn()
    const subscribe = vi.fn(() => dispose)
    const callback = vi.fn()
    expect(resolveChatWatch(() => ({ subscribe }), 'session-1', callback)).toBe(dispose)
    expect(subscribe).toHaveBeenCalledWith(callback)
    expect(resolveChatWatch(() => undefined, 'session-1', callback)).not.toBe(dispose)
  })
})
