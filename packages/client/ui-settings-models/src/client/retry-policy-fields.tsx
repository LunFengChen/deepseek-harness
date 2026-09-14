/**
 * Default / Custom retry count and delay on a Models provider card.
 *
 * Retry is a provider-route policy, unlike reasoning effort which is per model.
 * Default omits `retryPolicy`; Custom writes normal mode with a count and delay.
 */

import type { ReactNode } from 'react'
import type { en } from './locales.ts'
import {
  DEFAULT_RETRY_INITIAL_DELAY_MS,
  DEFAULT_RETRY_MAX_RETRIES,
  defaultRetryPolicy,
  hasCustomRetryPolicy,
  parseRetryCount,
  parseRetryDelay,
  retryPolicyDraft,
  retryPolicyFromFields,
  validateRetryPolicy,
} from './retry-policy.ts'
import styles from './ModelsSection.module.css'

/** Props of {@link RetryPolicyFields}. */
export interface RetryPolicyFieldsProps {
  /** Stored `retryPolicy`, or `undefined` for adapter defaults. */
  value: unknown
  /** Write a custom draft, or `undefined` to restore adapter defaults. */
  onChange: (next: unknown) => void
  /** Section copy. */
  t: (key: keyof typeof en) => string
  /** Disable the radios and fields. */
  disabled: boolean
  /** Radio `name` unique to this provider card. */
  name: string
}

/**
 * Render the provider-level retry radios and, when Custom is selected, the
 * count and delay fields.
 * @param props - stored policy, writer, copy, and disabled state.
 * @returns the fieldset.
 */
export function RetryPolicyFields(props: RetryPolicyFieldsProps): ReactNode {
  const { value, onChange, t, disabled, name } = props
  const custom = hasCustomRetryPolicy(value)
  const draft = retryPolicyDraft(value) ?? defaultRetryPolicy()
  const failure = validateRetryPolicy(value)
  const countText = custom && isObject(value) && 'maxRetries' in value
    ? String(value['maxRetries'] ?? '')
    : String(draft.maxRetries)
  const delayText = custom && isObject(value)
    ? delayFieldText(value)
    : String(draft.backoff.initialDelayMs)

  const edit = (count: string, delay: string): void => {
    onChange(retryPolicyFromFields(parseRetryCount(count), parseRetryDelay(delay)))
  }

  return (
    <fieldset className={styles['retryPolicy']}>
      <legend className={styles['fieldLabel']}>{t('retryPolicy')}</legend>
      <div className={styles['retryPolicyModes']} role="radiogroup" aria-label={t('retryPolicy')}>
        <label className={styles['retryPolicyMode']}>
          <input
            type="radio"
            name={name}
            checked={!custom}
            disabled={disabled}
            onChange={() => { onChange(undefined) }}
          />
          {t('retryPolicyNone')}
        </label>
        <label className={styles['retryPolicyMode']}>
          <input
            type="radio"
            name={name}
            checked={custom}
            disabled={disabled}
            onChange={() => { onChange(retryPolicyDraft(value) ?? defaultRetryPolicy()) }}
          />
          {t('retryPolicyCustom')}
        </label>
      </div>
      {custom
        ? (
          <div className={styles['retryPolicyFields']}>
            <label className={styles['field']}>
              <span className={styles['fieldLabel']}>{t('retryMaxRetries')}</span>
              <input
                className={styles['input']}
                type="text"
                inputMode="numeric"
                value={countText}
                placeholder={String(DEFAULT_RETRY_MAX_RETRIES)}
                aria-label={t('retryMaxRetries')}
                aria-invalid={failure === 'retryCountInvalid' || undefined}
                disabled={disabled}
                onChange={(event) => { edit(event.target.value, delayText) }}
              />
            </label>
            <label className={styles['field']}>
              <span className={styles['fieldLabel']}>{t('retryInitialDelay')}</span>
              <input
                className={styles['input']}
                type="text"
                inputMode="numeric"
                value={delayText}
                placeholder={String(DEFAULT_RETRY_INITIAL_DELAY_MS)}
                aria-label={t('retryInitialDelay')}
                aria-invalid={failure === 'retryDelayInvalid' || undefined}
                disabled={disabled}
                onChange={(event) => { edit(countText, event.target.value) }}
              />
            </label>
          </div>
        )
        : null}
      {failure === undefined ? null : <p className={styles['error']}>{t(failure)}</p>}
    </fieldset>
  )
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function delayFieldText(value: Record<string, unknown>): string {
  const backoff = value['backoff']
  if (!isObject(backoff) || !('initialDelayMs' in backoff)) {
    return String(DEFAULT_RETRY_INITIAL_DELAY_MS)
  }
  const delay = backoff['initialDelayMs']
  return delay === undefined || delay === null ? '' : String(delay)
}
