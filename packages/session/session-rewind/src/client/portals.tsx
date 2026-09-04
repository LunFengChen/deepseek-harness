/**
 * dsh-rewind portal half: the per-user-message ↶ rewind button, rendered as a
 * React portal inside the message's `MessageIconActions` row.
 *
 * Why portals (aligned with the copy button's own rendering): the copy button
 * is a React child of the actions row, painted in the same commit as the
 * bubble. A pure-DOM `appendChild` (the earlier approach) lands one microtask
 * later and re-runs a full-transcript scan on EVERY mutation, which can push
 * the paint of a newly sent bubble — the "occasional hiccup before the bubble
 * shows". Portals let React own the button lifecycle (mount/unmount with the
 * row, no orphaned buttons, no manual re-attach after harness re-renders),
 * and the target collection is coalesced (one refresh per mutation batch) and
 * diffed (no setState churn when nothing changed).
 *
 * Mount point: the plugin registers a session-scoped bridge into the harness's
 * `conversation.session.header.actions` list slot. The bridge renders NO
 * header UI — it only portals buttons into the user rows of the session the
 * harness mounts it for. That slot is the harness-native way to get a
 * per-session React mount without touching any source; the registration is
 * typed structurally (see `SlotsLike`) so the plugin never imports the
 * conversation UI package's types and stays attached through the published slot seam.
 *
 * @module dsh-rewind/client/portals
 */

import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  createElement,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { SessionFace } from '@x1a0f3n9/dsh-api-session-controller/client'
import type { UserMessageNode } from '@x1a0f3n9/dsh-client-ui-conversation/client'
import { hiddenSeqsOf, isExecutedRewindCommand, messageTextAt, type ChatOf, type ChatWatch, type HiddenChat } from './hidden.ts'
import type { RewindKey } from './locales.ts'
import { messagePreviewOf } from './candidates.ts'
import { knownCommandSeqs, openPopover, waitForCommand } from './popover.ts'
import { matchPendingRows, retractSpan } from './pending.ts'
import { rewindLog } from './log.ts'
import { CLASS, REWIND_ICON_SVG } from './styles.ts'

type Translate = (key: RewindKey, params?: Record<string, unknown>) => string

/** One portal target: the actions row of a user/steering seat + its durable node. */
export type PortalTarget =
  | {
    readonly kind: 'durable'
    /** The seat's chat node key (React reconciliation + diff identity). */
    readonly key: string
    /** The row's actions container (React portal target). */
    readonly container: HTMLElement
    readonly seq: number
    readonly time: number
    readonly preview: string
  }
  | {
    readonly kind: 'pending'
    /** `pending:${itemId}` — stable per inbox occurrence. */
    readonly key: string
    /** The row's actions container (React portal target). */
    readonly container: HTMLElement
    /** The host inbox occurrence the retract button addresses. */
    readonly itemId: string
    /** Complete editable text; null when the message contains non-text blocks. */
    readonly text: string | null
    readonly preview: string
  }

/** Capabilities the session-scoped bridge receives from the plugin apply(). */
export interface RewindBridgeDeps {
  readonly sessionOf: (sessionId: string) => SessionFace | undefined
  /** Reads the assembled Conversation chat view for one session. */
  readonly chatOf: ChatOf
  /** Subscribe to the assembled chat view for command settlement waits. */
  readonly watchChat: ChatWatch
  readonly currentSessionId: () => string | undefined
  readonly t: Translate
  readonly subscribeLocale: (cb: () => void) => () => void
  /** Write a restored message through the session input API. */
  readonly setComposerText: (sessionId: string, text: string) => boolean
}

/** Structural face of the runtime slot service (see the module doc). */
export interface SlotsLike {
  inject(key: string, install: () => () => void): () => void
  register<P>(
    entry: {
      readonly name: string
      readonly id?: string
      readonly order?: number
      readonly key?: string
      readonly locale?: string
      readonly inject?: () => P
    },
    component: (props: P) => ReactNode,
  ): () => void
}

/** Join the text blocks of a user message into one plain preview. */
// (shared with the `/rewind` command decoration — see `messagePreviewOf` in candidates.ts)

/** The durable user/steering node behind a seat key via the runtime snapshot. */
function userNodeOf(chat: HiddenChat | undefined, key: string): UserMessageNode | undefined {
  const node = chat?.nodes.get(key)
  if (node === undefined || (node.kind !== 'user' && node.kind !== 'steering')) return undefined
  // SteeringMessageNode carries the same seq/time/content/source fields.
  return node.data as UserMessageNode
}

/**
 * Execute one rewind from the popover and, when it settles successfully,
 * put the withdrawn target message's text back into the composer so the
 * user can edit and re-send.
 *
 * THE COMPOSER FILL IS EVENT-DRIVEN: it runs only when THIS page performed
 * the rewind (the user clicked confirm moments ago). It must NEVER scan
 * loaded history for rewind commands: a session window opens with only
 * the tail page and grows via loadOlder, so a "command already in the
 * snapshot" cannot be told apart from "command executed in this page" —
 * the old baseline heuristic refilled withdrawn text into the composer
 * after switching sessions or restarting dsh.
 */
export async function runRewindAndFill(
  session: SessionFace,
  seq: number,
  mode: 'chat' | 'both',
  currentSessionId: () => string | undefined,
  chatOf: ChatOf,
  watchChat: ChatWatch,
  setComposerText: (sessionId: string, text: string) => boolean,
): Promise<void> {
  // Exclude already-present executed-rewind nodes for this target BEFORE
  // issuing the command: a repeated rewind of the same message must wait
  // for THIS command's node, not settle on the previous one.
  const known = knownCommandSeqs(session, chatOf, node => isExecutedRewindCommand(node, seq))
  let result: Awaited<ReturnType<SessionFace['command']>>
  try {
    result = await session.command(`/rewind @${seq} ${mode}`)
  } catch (error) {
    // A command/teardown throw must never become a silent unhandled rejection
    // on the `void runRewindAndFill(...)` call site.
    rewindLog.warn('refill', `rewind command threw, skipping refill @${seq}`, error)
    return
  }
  if (!result.ok || result.value?.matched !== true) {
    return
  }
  // The executed rewind lands as a CommandNode with a marker-carrying
  // success outcome; wait for exactly that (longer than the preview wait:
  // a running turn is cancelled first, which can take seconds).
  let outcome: Awaited<ReturnType<typeof waitForCommand>>
  try {
    outcome = await waitForCommand(
      session,
      chatOf,
      node => isExecutedRewindCommand(node, seq) && !known.has(node.seq),
      20_000,
      cb => watchChat(session.sessionId, cb),
    )
  } catch (error) {
    rewindLog.warn('refill', `waiting for rewind @${seq} outcome threw`, error)
    return
  }
  if (outcome === null) {
    rewindLog.warn('refill', `rewind @${seq} never settled within timeout, no refill`)
    return
  }
  if (outcome.kind !== 'success') {
    // The host rejected the rewind (e.g. the target was shadowed by
    // compaction and is no longer in the model context). The refusal is the
    // correct behavior, but it must not fail silently — surface the host's
    // reason instead.
    showHint(outcome.text ?? 'rewind failed')
    return
  }
  // The user may have switched sessions while the rewind ran — fill only
  // the composer of the session the rewind actually happened in.
  if (currentSessionId() !== session.sessionId) {
    return
  }
  let text: string | undefined
  try {
    text = messageTextAt(chatOf(session), seq)
  } catch (error) {
    rewindLog.warn('refill', `reading target text for @${seq} threw`, error)
    return
  }
  if (text === undefined || text === '') {
    return
  }
  // Empty-composer guard (Claude Code parity, matches retractPending): never
  // clobber a draft the user is already editing.
  if (composerText().trim() !== '') {
    return
  }
  try {
    setComposerText(session.sessionId, text)
  } catch (error) {
    rewindLog.warn('refill', `composer refill @${seq} threw`, error)
    return
  }
}

/** The current Web composer surface. */
function composerSurface(): HTMLElement | null {
  return document.querySelector<HTMLElement>(COMPOSER_SELECTOR)
}

/** Transient status toast above the composer (rewind-failure notification). */
function showHint(text: string): void {
  const surface = composerSurface()
  const hint = document.createElement('div')
  hint.className = CLASS.guardHint
  hint.setAttribute('role', 'status')
  hint.textContent = text
  document.body.appendChild(hint)
  if (surface !== null) {
    const card = surface.closest('[data-composer-card]')
    const rect = card instanceof HTMLElement ? card.getBoundingClientRect() : surface.getBoundingClientRect()
    hint.style.left = `${Math.round(rect.left)}px`
    hint.style.bottom = `${Math.round(window.innerHeight - rect.top + 8)}px`
  }
  window.setTimeout(() => hint.remove(), 3200)
}

/** The current Web composer surface selector. */
const COMPOSER_SELECTOR = '[data-composer-input]'

/** Both durable user messages and durable steering inputs render user-style rows. */
const USER_SEAT_SELECTOR = '[data-chat-flow-kind="user"][data-chat-anchor-key], [data-chat-flow-kind="steering"][data-chat-anchor-key]'

/** Every conversation seat row (hidden rows included). */
const CHAT_SEAT_SELECTOR = '[data-chat-anchor-key]'

/** Pending steering bubble rows (Host-authoritative pre-admission projection). */
const PENDING_SEAT_SELECTOR = '[data-pending-steering]'

/**
 * Locate the action-button container for a user or steering row.
 *
 * Media can contain buttons of its own, so the last button in the row anchors
 * the action group. The plugin button is excluded to keep refreshes from
 * selecting its own portal target.
 * @param row - Rendered conversation row.
 * @returns The action container, when the row exposes one.
 */
export function actionsContainerOf(row: HTMLElement | undefined): HTMLElement | undefined {
  const buttons = Array.from(row?.querySelectorAll<HTMLButtonElement>('button') ?? [])
  const lastButton = buttons.filter(button => !button.classList.contains(CLASS.button)).at(-1)
  const container = lastButton?.parentElement
  return container instanceof HTMLElement && container.querySelector('button') !== null
    ? container
    : undefined
}

/**
 * Collect the portal targets of one session: user rows × snapshot nodes.
 * Exported as a test seam — the DOM→targets pairing that drives the ↶ button
 * is otherwise only reachable through a full React portal render.
 */
export function collectTargets(chat: HiddenChat, hiddenSeqs: ReadonlySet<number>): readonly PortalTarget[] {
  const rows = new Map<string, HTMLElement>()
  for (const element of document.querySelectorAll<HTMLElement>(USER_SEAT_SELECTOR)) {
    const key = element.dataset.chatAnchorKey
    if (key !== undefined) rows.set(key, element)
  }
  const targets: PortalTarget[] = []
  for (const key of chat.order) {
    const node = chat.nodes.get(key)
    if (node === undefined || (node.kind !== 'user' && node.kind !== 'steering')) continue
    const user = node.data as UserMessageNode
    // A withdrawn row must not get a button (it is not part of the surface).
    if (hiddenSeqs.has(node.anchorSeq ?? user.seq)) continue
    const row = rows.get(key)
    const actions = actionsContainerOf(row)
    // The actions row is the last child of the user row and holds the
    // copy/branch IconActions; refuse to portal when the DOM does not match
    // (a layout change must not break the conversation).
    if (actions === undefined) continue
    targets.push({ kind: 'durable', key, container: actions, seq: user.seq, time: user.time, preview: messagePreviewOf(user) })
  }
  return targets
}

/** The session snapshot slice the pending collector reads (structural subset). */
interface QueueLike {
  readonly queue: readonly {
    readonly id: string
    readonly placement: string
    readonly preview: string
    readonly text: string | null
  }[]
  readonly subagent: unknown
}

/**
 * The pending bubble row's message text EXCLUDING its trailing actions
 * container. The harness copy button inside that container wraps its label in
 * a Tooltip whose bubble mounts (hover, delayMs=0) as a DOM node inside the
 * row — so the full row `textContent` flips between "message" and
 * "message+Copy" with the mouse. Reading the bubble text from a CLONE (the
 * live row is never touched) keeps the strict equality in `matchPendingRows`
 * stable while the user hovers the action buttons.
 */
function bubbleTextOf(row: HTMLElement): string {
  const clone = row.cloneNode(true) as HTMLElement
  // The actions container is the last child of the pending bubble row. If the
  // harness structure ever changes, the clone keeps the extra text and the
  // strict match degrades to no button (never a wrong attachment).
  clone.lastElementChild?.remove()
  return clone.textContent ?? ''
}

/**
 * Collect the portal targets of one session's pending steering bubbles. The
 * retract button is the pre-sent window's counterpart of the durable rewind
 * button: it exists whenever the Host holds the message in its next-step
 * inbox (running or paused), and it retracts through the session's own
 * `updateQueue` channel — no DSH behavior changes.
 */
function collectPendingTargets(snapshot: QueueLike): readonly PortalTarget[] {
  // Subagent sessions reject queue mutations host-side; mirror the harness's
  // own QueueDock gate (queueMutable = subagent === null).
  if (snapshot.subagent !== null) return []
  const steering = snapshot.queue.filter(item => item.placement === 'steering')
  if (steering.length === 0) return []
  const rows = Array.from(document.querySelectorAll<HTMLElement>(PENDING_SEAT_SELECTOR))
  const matched = matchPendingRows(
    rows.map(row => ({ text: bubbleTextOf(row) })),
    steering.map(item => ({ id: item.id, text: item.text })),
  )
  const targets: PortalTarget[] = []
  for (let i = 0; i < matched.length; i++) {
    const itemId = matched[i]
    if (itemId === undefined || itemId === null) continue
    const row = rows[i]
    if (row === undefined) continue
    // Pending rows expose the same action group as durable rows.
    const actions = actionsContainerOf(row)
    if (actions === undefined) continue
    const item = steering[i]
    if (item === undefined) continue
    targets.push({
      kind: 'pending',
      key: `pending:${itemId}`,
      container: actions,
      itemId,
      text: item.text,
      preview: item.preview,
    })
  }
  return targets
}

/** Whether two target lists describe the same portals (order-sensitive). */
function sameTargets(left: readonly PortalTarget[], right: readonly PortalTarget[]): boolean {
  return left.length === right.length && left.every((target, index) => {
    const other = right[index]
    if (other === undefined || target.key !== other.key || target.container !== other.container) return false
    if (target.kind === 'durable') return other.kind === 'durable' && target.seq === other.seq
    return other.kind === 'pending' && target.itemId === other.itemId
  })
}

interface RewindPortalsProps extends RewindBridgeDeps {
  readonly sessionId: string
}

/**
 * Session-scoped portal bridge: renders the ↶ button of every user message
 * row of the session the harness mounts it for. The refresh is coalesced
 * (one pass per mutation batch via queueMicrotask) and diffed (setState is
 * skipped when the target set is unchanged), so the plugin never runs a
 * synchronous full-transcript scan inside a commit microtask.
 */
export function RewindPortals({
  sessionId,
  sessionOf,
  chatOf,
  currentSessionId,
  watchChat,
  t,
  subscribeLocale,
  setComposerText,
}: RewindPortalsProps): ReactNode {
  const [targets, setTargets] = useState<readonly PortalTarget[]>([])
  // Rows we have hidden; re-shown when they leave the withdrawn span.
  const hidden = useRef(new WeakSet<HTMLElement>())
  // Re-render when the active locale switches so injected button labels
  // keep following the dsh language preference (the popover and guard hint
  // are created fresh each time and already read the current locale).
  const [, forceRender] = useReducer((count: number) => count + 1, 0)
  useEffect(() => subscribeLocale(() => { forceRender() }), [subscribeLocale])

  useLayoutEffect(() => {
    let active = true
    let queued = false

    const refresh = (): void => {
      if (!active) return
      const session = sessionOf(sessionId)
      if (session === undefined) {
        // Session binding gone (teardown window): drop every portal.
        setTargets([])
        return
      }
      const snapshot = session.getSnapshot()
      // The durable path waits for the assembled chat view; pending targets
      // remain available while that view is not ready.
      const chat = chatOf(session)
      const hiddenSeqs = chat === undefined ? new Set<number>() : hiddenSeqsOf(chat)
      // Hide withdrawn rows (rewind markers, /rewind command rows, and every
      // message inside the executed rewinds' [earliest target, latest marker]
      // span) so the rendered transcript matches the agent's context. React
      // re-renders recreate rows, so this runs on every refresh.
      //
      // Each hidden row also carries a semantic marker (`data-dsh-rewind-hidden`)
      // so DevTools, other DOM plugins and tests can tell a rewind-hide apart
      // from any collapse/filter hide. Purely observational: the marker is
      // kept in sync with the hide/show state on both branches (a recreated
      // row has no marker and is re-marked when it re-enters a hidden span).
      for (const seat of chat === undefined ? [] : document.querySelectorAll<HTMLElement>(CHAT_SEAT_SELECTOR)) {
        const key = seat.dataset.chatAnchorKey
        // `chat` is defined whenever the loop body runs (see the loop guard).
        const anchor = key !== undefined ? chat?.nodes.get(key)?.anchorSeq : undefined
        if (anchor !== undefined && hiddenSeqs.has(anchor)) {
          seat.style.display = 'none'
          seat.dataset.dshRewindHidden = 'true'
          hidden.current.add(seat)
        } else if (hidden.current.has(seat)) {
          seat.style.display = ''
          delete seat.dataset.dshRewindHidden
          hidden.current.delete(seat)
        }
      }
      // Hiding diagnostics are event-level: logged once where a rewind
      // settles (runRewindAndFill), not per mutation batch — printing them
      // here would flood the console during streaming, and the rewind event
      // already carries the hide set. Nothing is logged in this per-batch scan.
      const durable = chat === undefined ? [] : collectTargets(chat, hiddenSeqs)
      const next = [...durable, ...collectPendingTargets(snapshot)]
      // Diff: no change → no re-render (the observer fires on every mutation;
      // only an actual target-set change should touch React).
      setTargets(current => (sameTargets(current, next) ? current : next))
    }

    // Coalesce: any number of mutations in a batch collapse into ONE refresh
    // (microtask), instead of one synchronous full scan per mutation — this
    // is what keeps the plugin off the critical path of the frame that paints
    // a newly sent bubble.
    const queueRefresh = (): void => {
      if (queued || !active) return
      queued = true
      queueMicrotask(() => {
        queued = false
        refresh()
      })
    }

    refresh()
    const observer = new MutationObserver(queueRefresh)
    // attributes: watch style so a harness re-render that resets display is
    // re-hidden on the next refresh instead of flickering back.
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
    return () => {
      active = false
      observer.disconnect()
    }
  }, [sessionId, sessionOf])

  return targets.map(target => createPortal(
    target.kind === 'pending'
      ? (
        <RetractButton
          key={target.key}
          target={target}
          sessionId={sessionId}
          sessionOf={sessionOf}
          chatOf={chatOf}
          watchChat={watchChat}
          setComposerText={setComposerText}
          t={t}
        />
      )
      : (
        <RewindButton
          key={target.key}
          target={target}
          sessionId={sessionId}
          sessionOf={sessionOf}
          chatOf={chatOf}
          watchChat={watchChat}
          currentSessionId={currentSessionId}
          setComposerText={setComposerText}
          t={t}
        />
      ),
    target.container,
    target.key,
  ))
}

interface RewindButtonProps {
  readonly target: Extract<PortalTarget, { kind: 'durable' }>
  readonly sessionId: string
  readonly sessionOf: (sessionId: string) => SessionFace | undefined
  readonly chatOf: ChatOf
  readonly watchChat: ChatWatch
  readonly currentSessionId: () => string | undefined
  readonly setComposerText: (sessionId: string, text: string) => boolean
  readonly t: Translate
}

/** The per-message ↶ button (28px, matching the harness IconActions). */
function RewindButton({
  target,
  sessionId,
  sessionOf,
  chatOf,
  watchChat,
  currentSessionId,
  setComposerText,
  t,
}: RewindButtonProps): ReactNode {
  const onClick = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    const session = sessionOf(sessionId)
    if (session === undefined) {
      // No session binding (transition): nothing to rewind, say so instead
      // of failing silently.
      rewindLog.warn('portals', 'rewind button clicked with no session binding')
      return
    }
    const node = userNodeOf(chatOf(session), target.key)
    if (node === undefined) return
    openPopover({
      session,
      chatOf,
      watchChat,
      seq: node.seq,
      time: node.time,
      preview: messagePreviewOf(node),
      anchor: event.currentTarget,
      t,
      onRewind: (mode) => { void runRewindAndFill(session, node.seq, mode, currentSessionId, chatOf, watchChat, setComposerText) },
    })
  }

  return (
    <button
      type="button"
      className={CLASS.button}
      aria-label={t('button.aria')}
      title={t('button.title')}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: REWIND_ICON_SVG }}
    />
  )
}

/**
 * Read the current composer draft.
 * @returns The composer text, or an empty string when the composer is absent.
 */
export function composerText(): string {
  return composerSurface()?.textContent ?? ''
}

/**
 * Rewind to one pre-sent (pending steering) message, with the same semantics
 * as a durable rewind — "pause first, then roll back to before the target":
 *
 * 1. Pause the running turn (Claude Code's rewind-always-stops-first rule; a
 *    no-op when the agent is already idle). Queued (next-turn) messages are
 *    untouched — the harness QueueDock already offers per-item edit/remove.
 * 2. Retract the target steering message and every steering message after it
 *    (the rollback point's "future"), oldest first, via the session's own
 *    `updateQueue` channel.
 * 3. Put the target's text back in the composer (only when it is empty —
 *    Claude Code's auto-restore guard, so a draft the user is typing is never
 *    clobbered).
 *
 * A removal failure is silently ignored: the realistic failure is
 * `queue-item-not-found` — the message was claimed by the running turn a
 * moment ago, in which case the durable row's regular rewind button takes
 * over with no gap.
 */
async function retractPending(
  session: SessionFace,
  itemId: string,
  text: string | null,
  setComposerText: (sessionId: string, text: string) => boolean,
): Promise<void> {
  // 1. Pause first (Claude Code parity). Idempotent when already idle.
  await session.cancel()
  // 2. Retract the target and its future (steering only; queued stays).
  // The item id comes from the queue mirror's `id` field, which the harness
  // brands as MessageId; cast at this single boundary to avoid a new type
  // dependency on the branding package.
  const queue = session.getSnapshot().queue
  const steering = queue.filter(item => item.placement === 'steering')
  for (const id of retractSpan(steering, itemId)) {
    await session.updateQueue(id as Parameters<SessionFace['updateQueue']>[0], { kind: 'remove' })
  }
  // 3. Refill the composer (empty-composer guard).
  if (text !== null && text !== '' && composerText().trim() === '') {
    setComposerText(session.sessionId, text)
  }
}

interface RetractButtonProps {
  readonly target: Extract<PortalTarget, { kind: 'pending' }>
  readonly sessionId: string
  readonly sessionOf: (sessionId: string) => SessionFace | undefined
  /** Passed through to openPopover (the shared PopoverOptions shape). */
  readonly chatOf: ChatOf
  readonly watchChat: ChatWatch
  readonly setComposerText: (sessionId: string, text: string) => boolean
  readonly t: Translate
}

/** The per-pending-message ↶ button (same visual family as the durable button). */
function RetractButton({ target, sessionId, sessionOf, chatOf, watchChat, setComposerText, t }: RetractButtonProps): ReactNode {
  const onClick = (event: ReactMouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    const session = sessionOf(sessionId)
    if (session === undefined) return
    openPopover({
      session,
      chatOf,
      watchChat,
      preview: target.preview,
      anchor: event.currentTarget,
      t,
      retract: { itemId: target.itemId, text: target.text },
      onRetract: () => { void retractPending(session, target.itemId, target.text, setComposerText) },
    })
  }

  return (
    <button
      type="button"
      className={CLASS.button}
      aria-label={t('button.retract.aria')}
      title={t('button.retract.title')}
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: REWIND_ICON_SVG }}
    />
  )
}

/**
 * Build the slot-entry component for the plugin apply(): a tiny bridge that
 * injects the apply-time capabilities (session resolution, locale, rewind
 * runner) into the module-level `RewindPortals`.
 */
export function createRewindBridge(deps: RewindBridgeDeps): (props: { readonly sessionId: string }) => ReactNode {
  return function RewindBridge({ sessionId }): ReactNode {
    return createElement(RewindPortals, { sessionId, ...deps })
  }
}
