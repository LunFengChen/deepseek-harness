/**
 * dsh-rewind client half: the `/rewind` command decoration, the locale
 * registration, and the session-scoped portal bridge that renders the
 * per-message ↶ rewind button (see
 * `portals.tsx` for the button itself).
 *
 * The button is NOT injected by hand into the DOM anymore: the plugin
 * registers a bridge into the harness's `conversation.session.header.actions`
 * list slot, and that bridge portals a React button into every user message's
 * IconActions row — the same rendering family as the copy button (a React
 * child of the actions row), without touching any harness source. The
 * registration is typed structurally (see `SlotsLike` in portals.tsx), so the
 * plugin never imports conversation UI types and survives harness version
 * drift.
 *
 * The text-driven flow is the harness's STANDARD command decoration
 * (`ctx.commandUi.decorate`): a bare `/rewind` (or its alias `/undo`) —
 * picked from the slash-menu completion, or typed in full and Entered —
 * opens the harness's own popupSelect shell (search, ↑↓/Enter, Esc) listing
 * the rewind candidates instead of executing the command. Picking one
 * continues the SAME flow as the ↶ button: the mode popover, both-impact
 * confirmation, execution, row hiding and the composer refill
 * (`runRewindAndFill`). The parameterized forms (`/rewind @<seq> chat|both`,
 * `/rewind preview …`) stay internal channels the ↶ button and the popover
 * drive through `session.command`.
 *
 * @module dsh-rewind/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionFace } from '@x1a0f3n9/dsh-api-session-controller/client'
import type { SessionId } from '@x1a0f3n9/dsh-client-connection/client'
import type { CommandDecoration, CommandUiContract } from '@x1a0f3n9/dsh-client-ui-commands/client'
import type {} from '@x1a0f3n9/dsh-client-ui-renderer/client'
// Type-only: pulls the ctx.locale merge from the locale plugin.
import type {} from '@x1a0f3n9/dsh-client-locale/client'
import {
  rewindCandidatesFromHostText,
  rewindCandidatesOfChat,
  rewindOptionsFromCandidates,
  type CandidateChat,
  type RewindCandidate,
} from './candidates.ts'
import { openPopover, knownCommandSeqs, waitForCommand } from './popover.ts'
import { createRewindBridge, runRewindAndFill, type SlotsLike } from './portals.tsx'
import { chatSnapshotOf, isCandidateCommand, type ChatOf, type ChatWatch } from './hidden.ts'
import { rewindLog } from './log.ts'
import { BUILD_HASH, PLUGIN_VERSION } from './build-info.ts'
import { en, zh } from './locales.ts'
import { STYLE } from './styles.ts'
import {
  SettingsCleanupCard,
  CLEANUP_SETTINGS_NAMESPACE,
  type CleanupCardApi,
  type CleanupPolicy,
  type CardTranslate,
} from './settings-card.tsx'

export const name = 'dsh-rewind'
/** Services required by the Web action bridge and cleanup settings card. */
export const inject = [
  'slots', 'sessions', 'locale', 'commandUi', 'uiConversation', 'conversation', 'settingsScope',
]

const NS = 'rewind'

/** The slot the session-scoped rewind bridge registers into (harness-declared). */
const HEADER_ACTIONS_SLOT = 'conversation.session.header.actions'

/** The current Web composer surface used to anchor the command picker. */
const COMPOSER_SELECTOR = '[data-composer-input]'

/**
 * Client plugin body: command decoration + parameterized guard + locale + the
 * portal bridge.
 * @param ctx - client root context carrying `slots`, `sessions`, `locale` and `commandUi`.
 */
export function apply(ctx: ClientContext): void {
  // Startup identity line (behind the existing `dsh-rewind.debug` switch, never
  // a new key): lets a reporter confirm the running bundle matches a fix,
  // ruling out stale cache / an un-restarted host — the cheapest, most likely
  // root cause. One line per load, not per event.
  rewindLog.info('boot', `loaded v${PLUGIN_VERSION} (build ${BUILD_HASH})`)

  ctx.effect(function* () {
    yield ctx.locale.register(NS, { zh, en })
    const t = ctx.locale.bind(NS)

    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-rewind'
    style.textContent = STYLE
    document.head.appendChild(style)

    // ---- rewind portals: session-scoped React mount ----
    // Capabilities handed to the portal bridge. `sessionOf` resolves a
    // session id to its live face; `currentSessionId` is the session switch
    // check the composer refill needs (fill only the session the rewind
    // actually happened in).
    const sessionOf = (sessionId: string): SessionFace | undefined =>
      ctx.sessions.binding(sessionId as SessionId)?.session
    const currentSessionId = (): string | undefined => ctx.sessions.list.getSnapshot().current
    const subscribeLocale = (cb: () => void): (() => void) => ctx.locale.subscribe(cb)

    /** Resolve the assembled chat view for one session. */
    const chatViewOf = (sessionId: SessionId) =>
      ctx.uiConversation.binding(sessionId).target('chat')

    /** Read the live chat snapshot owned by ui-conversation/ui-chat. */
    const chatOf: ChatOf = (session) => {
      if (session === undefined) return undefined
      try {
        return chatSnapshotOf(chatViewOf(session.sessionId as SessionId))
      } catch {
        return undefined
      }
    }

    /** Replace the current session's draft through the Conversation input API. */
    const setComposerText = (sessionId: string, text: string): boolean => {
      try {
        const scope = ctx.sessions.scope(sessionId as SessionId)
        if (scope === undefined) return false
        const input = ctx.conversation.input.for(scope)
        input.setDraft(text)
        return true
      } catch (error) {
        rewindLog.warn('refill', 'composer write threw', error)
        return false
      }
    }

    /** Subscribe to the current session's assembled chat view. */
    const watchChat: ChatWatch = (sessionId, cb) => {
      try {
        return chatViewOf(sessionId as SessionId).subscribe(cb)
      } catch {
        return () => {}
      }
    }

    const slots = (ctx as unknown as { slots: SlotsLike }).slots
    yield slots.inject(HEADER_ACTIONS_SLOT, () => slots.register(
      {
        name: HEADER_ACTIONS_SLOT,
        // A distinct list-entry id keeps the bridge from shadowing any other
        // header action; the entry renders portals only, never header UI.
        id: 'dsh-rewind-portals',
        order: 1000,
      },
      createRewindBridge({ sessionOf, chatOf, currentSessionId, watchChat, setComposerText, t, subscribeLocale }),
    ))

    // ---- snapshot-cleanup settings card (Settings > Plugins > Plugin config) ----
    const cleanupScope = ctx.settingsScope.bind<CleanupPolicy>({
      namespace: CLEANUP_SETTINGS_NAMESPACE,
    })
    const cardApi: CleanupCardApi = {
      read: () => {
        const value = cleanupScope.getSnapshot().value
        return value === undefined ? undefined : { enabled: value.enabled, maxAgeDays: value.maxAgeDays }
      },
      writable: () => cleanupScope.getSnapshot().writable,
      save: async (next: CleanupPolicy) => {
        await cleanupScope.set('enabled', next.enabled)
        await cleanupScope.set('maxAgeDays', next.maxAgeDays)
      },
      subscribe: cb => cleanupScope.subscribe(cb),
    }
    yield ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register(
      {
        name: 'settings.plugins.tab',
        id: 'rewind',
        order: 100,
        locale: NS,
        label: () => t('settings.tab'),
        inject: () => ({ t: t as unknown as CardTranslate, api: cardApi }),
      },
      SettingsCleanupCard,
    ))

    // ---- /rewind command decoration (the standard text-driven flow) ----
    // A bare `/rewind` — picked from the slash-menu completion, or typed in
    // full and Entered — opens the harness's own popupSelect shell instead of
    // executing the command: the harness-native "bare invocation opens a
    // picker" mechanism (CommandDecoration, see the ui-commands contract).
    // The plugin never re-implements a menu; picking a candidate continues
    // the SAME flow as the ↶ button (the mode popover below).
    const commandUi = ctx.get('commandUi') as CommandUiContract

    /** True when the surface has at least one reachable rewind target. */
    const hasCandidates = (sessionId: string | undefined): boolean => {
      const face = sessionId === undefined ? undefined : sessionOf(sessionId)
      const chat = chatOf(face)
      return chat !== undefined && rewindCandidatesOfChat(chat as unknown as CandidateChat).length > 0
    }

    /**
     * Fetch the FULL candidate list from the host through the internal
     * `__candidates` command. The host derives it from its complete surface +
     * event log, so it lists every reachable rewind target — not just the
     * already-loaded history window. Returns undefined when the command was
     * not matched or never settled.
     */
    const fetchHostCandidates = async (face: SessionFace, chatOf: ChatOf): Promise<readonly RewindCandidate[] | undefined> => {
      const known = knownCommandSeqs(face, chatOf, node => isCandidateCommand(node))
      const result = await face.command('/rewind __candidates')
      if (!result.ok || result.value?.matched !== true) return undefined
      const outcome = await waitForCommand(
        face,
        chatOf,
        node => isCandidateCommand(node) && !known.has(node.seq),
        8000,
        cb => watchChat(face.sessionId, cb),
      )
      if (outcome === null || outcome.kind !== 'success' || outcome.text === undefined) return undefined
      return rewindCandidatesFromHostText(outcome.text)
    }

    // Cache the last-fetched candidate list per session: `options` fills it,
    // `onSelect` reads it to resolve the picked seq's time/preview without a
    // second host round-trip.
    const hostCandidatesCache = new Map<string, readonly RewindCandidate[]>()

    /** The composer card the mode popover anchors to (the text flow has no button). */
    const composerAnchor = (): HTMLElement => {
      const surface = composerSurface()
      const card = surface?.closest<HTMLElement>('[data-composer-card]')
      return card ?? surface ?? document.body
    }

    // The decoration shared by `/rewind` and its alias `/undo`.
    const rewindPopupSpec: Omit<CommandDecoration, 'name'> = {
      // The picker exists exactly while the surface has a reachable user
      // message: a fresh session (no candidates) falls through to the host
      // command, which fails with "no user messages" — matching the harness's
      // own decoration convention (see ui-permission-presets).
      available: session => hasCandidates(session.sessionId),
      ui: {
        kind: 'popupSelect',
        options: async (session) => {
          const face = sessionOf(session.sessionId)
          if (face === undefined) return []
          const candidates = await fetchHostCandidates(face, chatOf)
          if (candidates !== undefined) hostCandidatesCache.set(session.sessionId, candidates)
          return candidates === undefined ? [] : rewindOptionsFromCandidates(candidates, t)
        },
        onSelect: (option, session) => {
          const face = sessionOf(session.sessionId)
          if (face === undefined) return
          const candidate = hostCandidatesCache.get(session.sessionId)?.find(
            candidate => candidate.seq === Number(option.id),
          )
          if (candidate === undefined) return
          openPopover({
            session: face,
            chatOf,
            watchChat,
            seq: candidate.seq,
            time: candidate.time,
            preview: candidate.preview,
            anchor: composerAnchor(),
            t,
            onRewind: (mode) => { void runRewindAndFill(face, candidate.seq, mode, currentSessionId, chatOf, watchChat, setComposerText) },
          })
        },
      },
    }
    for (const name of ['rewind', 'undo'] as const) {
      yield commandUi.decorate({ name, ...rewindPopupSpec })
    }

    /** The composer's text-holding element used to anchor the picker. */
    const composerSurface = (): HTMLElement | null =>
      document.querySelector<HTMLElement>(COMPOSER_SELECTOR)

    yield () => {
      style.remove()
    }
  }, 'dsh-rewind client lifecycle')
}

/**
 * Public contract — rewind visibility. Stable, semver-protected; the rest of
 * this module is internal; the exported surface is limited to the named helpers.
 */
export { hiddenSeqsOf, targetSeqOfArgs, type HiddenChat } from './hidden.ts'
