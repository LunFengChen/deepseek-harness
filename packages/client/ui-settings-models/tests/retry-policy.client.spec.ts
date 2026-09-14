/** Provider-route retry count and delay drafts on the Models cards. */
import { describe, expect, it } from 'vitest'
import {
  defaultRetryPolicy,
  hasCustomRetryPolicy,
  parseRetryCount,
  parseRetryDelay,
  retryPolicyDraft,
  retryPolicyFromFields,
  validateRetryPolicy,
} from '../src/client/retry-policy.ts'

describe('retryPolicyDraft', () => {
  it('treats omission as adapter default and objects as custom', () => {
    expect(hasCustomRetryPolicy(undefined)).toBe(false)
    expect(hasCustomRetryPolicy(null)).toBe(false)
    expect(hasCustomRetryPolicy([])).toBe(false)
    expect(hasCustomRetryPolicy({ mode: 'normal' })).toBe(true)
    expect(retryPolicyDraft(undefined)).toBeUndefined()
    expect(retryPolicyDraft({ mode: 'normal', maxRetries: 3, backoff: { initialDelayMs: 250 } }))
      .toEqual({
        mode: 'normal',
        maxRetries: 3,
        backoff: { initialDelayMs: 250, maxDelayMs: 10_000 },
      })
    expect(defaultRetryPolicy()).toEqual({
      mode: 'normal',
      maxRetries: 5,
      backoff: { initialDelayMs: 500, maxDelayMs: 10_000 },
    })
  })
})

describe('parseRetryCount and parseRetryDelay', () => {
  it('accepts whole counts and positive delays, and refuses NaN sources', () => {
    expect(parseRetryCount(0)).toBe(0)
    expect(parseRetryCount('8')).toBe(8)
    expect(parseRetryCount('')).toBeUndefined()
    expect(parseRetryCount('1.5')).toBeUndefined()
    expect(parseRetryCount('9007199254740992')).toBeUndefined()
    expect(parseRetryCount(Number.NaN)).toBeUndefined()
    expect(parseRetryDelay(500)).toBe(500)
    expect(parseRetryDelay('250.5')).toBe(250.5)
    expect(parseRetryDelay('')).toBeUndefined()
    expect(parseRetryDelay(0)).toBeUndefined()
    expect(parseRetryDelay(Number.NaN)).toBeUndefined()
  })
})

describe('retryPolicyFromFields', () => {
  it('writes a complete policy or a marker the validator refuses', () => {
    expect(retryPolicyFromFields(3, 250)).toEqual({
      mode: 'normal',
      maxRetries: 3,
      backoff: { initialDelayMs: 250, maxDelayMs: 10_000 },
    })
    expect(retryPolicyFromFields(undefined, 250)).toEqual({ mode: 'normal' })
    expect(JSON.stringify(retryPolicyFromFields(undefined, 250))).not.toContain('null')
  })
})

describe('validateRetryPolicy', () => {
  it('accepts omission, a complete custom policy, and stored always mode', () => {
    expect(validateRetryPolicy(undefined)).toBeUndefined()
    expect(validateRetryPolicy({
      mode: 'normal',
      maxRetries: 3,
      backoff: { initialDelayMs: 250, maxDelayMs: 10_000 },
    })).toBeUndefined()
    expect(validateRetryPolicy({ mode: 'always' })).toBeUndefined()
  })

  it('refuses a custom marker that is missing count or delay', () => {
    expect(validateRetryPolicy({ mode: 'normal' })).toBe('retryCountInvalid')
    expect(validateRetryPolicy({
      mode: 'normal',
      maxRetries: 3,
    })).toBe('retryDelayInvalid')
    expect(validateRetryPolicy({
      mode: 'normal',
      maxRetries: 3,
      backoff: {},
    })).toBe('retryDelayInvalid')
    expect(validateRetryPolicy(false)).toBe('retryCountInvalid')
  })
})
