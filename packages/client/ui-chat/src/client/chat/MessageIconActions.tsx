// Shared IconActions chrome for user and assistant messages: copy
// live, optional branch wiring, and an optional date-aware clock.

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import {
  IconBranchOutline16, IconCheckOutline16, IconCopyOutline16, IconRefreshOutline16, IconTrashOutline16,
  RiskConfirmation, Tooltip, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import { formatMessageClock } from './message-chrome.ts'
import { useCalendarDay } from './use-calendar-day.ts'
import css from './MessageIconActions.module.css'

export interface MessageIconActionsProps {
  /** Plain text the copy action writes. */
  text: string
  /** Unix epoch ms for the clock label; omitted for transient messages. */
  time?: number | undefined
  /** Clock before icons (user) or after (assistant). */
  clock: 'start' | 'end'
  /** Fork the session at this message; omission hides the branch action. */
  onBranch?: (() => void) | undefined
  /** The message is not a completed transcript tail, so branch stays visible but unavailable. */
  branchUnavailable?: boolean | undefined
  /** Permanently remove this turn and all later history. */
  onDelete?: (() => void) | undefined
  /** Remove this turn and submit the same prompt again. */
  onRegenerate?: (() => void) | undefined
  /** Parent layout class composed onto the actions row. */
  className?: string | undefined
  /**
   * Slot-rendered actions owned by independent plugins, placed between the
   * built-in copy and branch controls.
   */
  extraActions?: ReactNode
  /**
   * Icon-row Turn-usage trigger (the TurnUsagePanel pill), seated after the
   * branch control at the end of the icon cluster.
   */
  usageAction?: ReactNode
  /** The owning view's locale seat, passed down as a plain prop. */
  t: ChatViewSlotProps['t']
}

/**
 * Copy / branch (/ clock) IconActions row shared by user and assistant chrome.
 * @param props - Copy text, event time, clock side, branch callback, className.
 * @returns The actions row element.
 */
export function MessageIconActions({
  text, time, clock, onBranch, branchUnavailable = false, onDelete, onRegenerate, className,
  extraActions, usageAction, t,
}: MessageIconActionsProps) {
  const day = useCalendarDay()
  const reasonId = useId()
  // Same success chrome as CodeBlock: a short check swap after the write,
  // gated so re-clicks during the window neither re-copy nor stack timers.
  const [copied, setCopied] = useState(false)
  const [destructiveAction, setDestructiveAction] = useState<'delete' | 'regenerate' | null>(null)
  const [deleteAcknowledged, setDeleteAcknowledged] = useState(false)
  const copyPending = useRef(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyEpoch = useRef(0)
  useEffect(() => () => {
    copyEpoch.current += 1
    copyPending.current = false
    if (copyTimer.current !== null) clearTimeout(copyTimer.current)
  }, [])
  const onCopy = useCallback(() => {
    if (copied || copyPending.current) return
    const epoch = copyEpoch.current
    copyPending.current = true
    void writeClipboard(text).then((ok) => {
      if (epoch !== copyEpoch.current) return
      copyPending.current = false
      if (!ok) return
      setCopied(true)
      copyTimer.current = window.setTimeout(() => {
        copyTimer.current = null
        setCopied(false)
      }, 1000)
    })
  }, [copied, text])
  const openDestructive = useCallback((action: 'delete' | 'regenerate') => {
    setDeleteAcknowledged(false)
    setDestructiveAction(action)
  }, [])
  const cancelDelete = useCallback(() => {
    setDestructiveAction(null)
    setDeleteAcknowledged(false)
  }, [])
  const confirmDestructive = useCallback(() => {
    const action = destructiveAction
    setDestructiveAction(null)
    setDeleteAcknowledged(false)
    if (action === 'delete') onDelete?.()
    else if (action === 'regenerate') onRegenerate?.()
  }, [destructiveAction, onDelete, onRegenerate])
  const clockEl = time === undefined ? null : (
    <span className={clock === 'start' ? css.timeStart : css.timeEnd}>
      {formatMessageClock(time, t, day)}
    </span>
  )
  return (
    <div className={className === undefined ? css.actions : `${css.actions} ${className}`}>
      {clock === 'start' ? clockEl : null}
      <Tooltip label={copied ? t('copied') : t('copy')} side="bottom">
        <button type="button" className={css.action} aria-label={copied ? t('copied') : t('copy')} onClick={onCopy}>
          {copied ? <IconCheckOutline16 /> : <IconCopyOutline16 />}
        </button>
      </Tooltip>
      {extraActions}
      {onRegenerate !== undefined && (
        <Tooltip label={t('message.regenerate')} side="bottom">
          <button type="button" className={css.action} aria-label={t('message.regenerate')} onClick={() => { openDestructive('regenerate') }}>
            <IconRefreshOutline16 />
          </button>
        </Tooltip>
      )}
      {onDelete !== undefined && (
        <Tooltip label={t('message.delete')} side="bottom">
          <button type="button" className={css.action} aria-label={t('message.delete')} onClick={() => { openDestructive('delete') }}>
            <IconTrashOutline16 />
          </button>
        </Tooltip>
      )}
      {onBranch !== undefined && (
        <Tooltip label={branchUnavailable ? t('message.branchUnavailable') : t('message.branch')} side="bottom">
          {/* Native disabled buttons do not deliver the hover/focus events Tooltip needs. */}
          <button
            type="button"
            className={css.action}
            aria-label={t('message.branch')}
            aria-disabled={branchUnavailable || undefined}
            aria-describedby={branchUnavailable ? reasonId : undefined}
            data-unavailable={branchUnavailable || undefined}
            onClick={branchUnavailable ? undefined : onBranch}
          >
            <IconBranchOutline16 />
          </button>
        </Tooltip>
      )}
      {onBranch !== undefined && branchUnavailable && (
        <span id={reasonId} className={css.visuallyHidden}>{t('message.branchUnavailable')}</span>
      )}
      {usageAction}
      {clock === 'end' ? clockEl : null}
      {(onDelete !== undefined || onRegenerate !== undefined) && (
        <RiskConfirmation
          open={destructiveAction !== null}
          title={destructiveAction === 'regenerate' ? t('message.regenerate.title') : t('message.delete.title')}
          description={destructiveAction === 'regenerate' ? t('message.regenerate.description') : t('message.delete.description')}
          acknowledgeLabel={t('message.delete.acknowledge')}
          cancelLabel={t('message.delete.cancel')}
          closeLabel={t('message.delete.close')}
          confirmLabel={destructiveAction === 'regenerate' ? t('message.regenerate.confirm') : t('message.delete.confirm')}
          acknowledged={deleteAcknowledged}
          onAcknowledgedChange={setDeleteAcknowledged}
          onCancel={cancelDelete}
          onConfirm={confirmDestructive}
        />
      )}
    </div>
  )
}
