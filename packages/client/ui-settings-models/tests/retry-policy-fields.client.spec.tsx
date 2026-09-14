// @vitest-environment jsdom
/** Retry field rendering for stored custom objects that omit or null the numbers. */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { RetryPolicyFields } from '../src/client/retry-policy-fields.tsx'
import { en } from '../src/client/locales.ts'

afterEach(cleanup)

const t = (key: keyof typeof en): string => en[key]

describe('RetryPolicyFields', () => {
  it('shows empty count and delay when stored custom numbers are null', () => {
    render(
      <RetryPolicyFields
        value={{ mode: 'normal', maxRetries: null, backoff: { initialDelayMs: null } }}
        onChange={() => {}}
        t={t}
        disabled={false}
        name="retry-null"
      />,
    )
    expect(screen.getByLabelText<HTMLInputElement>(en.retryMaxRetries).value).toBe('')
    expect(screen.getByLabelText<HTMLInputElement>(en.retryInitialDelay).value).toBe('')
  })

  it('fills adapter delay when custom backoff omits initialDelayMs', () => {
    render(
      <RetryPolicyFields
        value={{ mode: 'normal', maxRetries: 3, backoff: {} }}
        onChange={() => {}}
        t={t}
        disabled={false}
        name="retry-backoff"
      />,
    )
    expect(screen.getByLabelText<HTMLInputElement>(en.retryInitialDelay).value).toBe('500')
  })

  it('fills adapter delay when custom backoff is not an object', () => {
    render(
      <RetryPolicyFields
        value={{ mode: 'normal', maxRetries: 3, backoff: 1 }}
        onChange={() => {}}
        t={t}
        disabled={false}
        name="retry-backoff-scalar"
      />,
    )
    expect(screen.getByLabelText<HTMLInputElement>(en.retryInitialDelay).value).toBe('500')
  })
})
