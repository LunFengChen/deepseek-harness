/**
 * The archive action: a `sidebar.workspaces.session.menu.item` row and a
 * `sidebar.workspaces.session.row.action` button over one injected behavior,
 * plus the `shell.overlay` dialog that confirms an archive, and that upgrades
 * to stopping a Session's running work when the Host names it. The same
 * entries restore an archived row; the notice a successful archive raises
 * and the diagnostics for Host rejections live in the injected callbacks,
 * not here.
 */
import { useState } from 'react'
import type { SessionActivity } from '@x1a0f3n9/dsh-api-workspace-controller/client'
// Type-only: the family keys each provider merges; a key this program did not compile takes the generic line.
import type {} from '@x1a0f3n9/dsh-agent/types'
import type {} from '@x1a0f3n9/dsh-jobs/view'
import type {} from '@x1a0f3n9/dsh-schedule/client'
import type {} from '@x1a0f3n9/dsh-subagent/client'
import {
  Button, IconArchiveOutlineRegular, IconUnarchiveOutlineRegular, MenuItemButton, Modal, Tooltip,
} from '@x1a0f3n9/dsh-client-ui-primitives'
import type {
  ArchiveSessionInjected, SessionArchiveConfirmInjected, SessionArchiveConfirmProps, SessionArchiveConfirmRequest,
  SessionMenuItemProps, SessionRowActionProps,
} from '../contract/slots.ts'
import css from '../rows/Rows.module.css'
import browserCss from '../rows/WorkspaceBrowser.module.css'

/**
 * Menu row (order 400): archive, or restore an archived row.
 * @param props - owner share, the archive share, and the menu open state.
 * @returns the row.
 */
export function ArchiveSessionMenuItem({
  sessionId, useArchived, useMenuOpenState, useShortcuts, archiveSession, unarchiveSession, t,
}: SessionMenuItemProps<ArchiveSessionInjected>) {
  const [, setMenuOpen] = useMenuOpenState()
  const shortcut = useShortcuts(rows => rows.find(row => row.id === 'session.archive'))
  const archived = useArchived(set => set.has(sessionId))
  return (
    <MenuItemButton
      shortcut={archived ? undefined : shortcut}
      icon={archived ? <IconUnarchiveOutlineRegular size={14} /> : <IconArchiveOutlineRegular size={14} />}
      onSelect={() => {
        setMenuOpen(false)
        ;(archived ? unarchiveSession : archiveSession)(sessionId)
      }}
    >
      {t(archived ? 'menu.unarchiveSession' : 'menu.archiveSession')}
    </MenuItemButton>
  )
}

/**
 * Hover button (order 100): archive, or restore an archived row.
 * @param props - owner share and the archive share.
 * @returns the button.
 */
export function ArchiveSessionRowButton({
  sessionId, useArchived, archiveSession, unarchiveSession, t,
}: SessionRowActionProps<ArchiveSessionInjected>) {
  const archived = useArchived(set => set.has(sessionId))
  return (
    <Tooltip label={t(archived ? 'actions.unarchive' : 'actions.archive')} side="bottom" align="end" delayMs={500}>
      <button
        type="button"
        className={css.iconButton}
        aria-label={t(archived ? 'menu.unarchiveSession' : 'menu.archiveSession')}
        onClick={() => { (archived ? unarchiveSession : archiveSession)(sessionId) }}
      >
        {archived ? <IconUnarchiveOutlineRegular size={14} /> : <IconArchiveOutlineRegular size={14} />}
      </button>
    </Tooltip>
  )
}

/**
 * The `shell.overlay` entry: nothing while no confirmation is pending,
 * otherwise one dialog per request (keyed by the Session). A quiet request
 * confirms archive; a request that names running work confirms
 * stop-and-archive. Cancelling leaves the Session as it was.
 * @param props - the request hook, its settlement, the archive hops, and the locale seat.
 * @returns the open dialog, or null.
 */
export function SessionArchiveConfirmDialog({
  useArchiveRequest, settleSessionArchive, archiveSession, stopAndArchiveSession, t,
}: SessionArchiveConfirmProps) {
  const request = useArchiveRequest(pending => pending)
  if (request === null) return null
  return (
    <ArchiveConfirmForm
      key={request.sessionId}
      request={request}
      archiveSession={archiveSession}
      stopAndArchiveSession={stopAndArchiveSession}
      onSettle={settleSessionArchive}
      t={t}
    />
  )
}

/** One request's dialog: in-flight and error state die with it. */
function ArchiveConfirmForm({ request, archiveSession, stopAndArchiveSession, onSettle, t }: {
  request: SessionArchiveConfirmRequest
  archiveSession: SessionArchiveConfirmInjected['archiveSession']
  stopAndArchiveSession: SessionArchiveConfirmInjected['stopAndArchiveSession']
  onSettle: () => void
  t: SessionArchiveConfirmProps['t']
}) {
  const [archiving, setArchiving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopping = request.activity.length > 0
  const close = () => {
    if (archiving) return
    onSettle()
  }
  const confirm = () => {
    setArchiving(true)
    setError(null)
    const hop = stopping
      ? stopAndArchiveSession(request.sessionId).then(() => 'archived' as const)
      : archiveSession(request.sessionId)
    hop.then((result) => {
      setArchiving(false)
      if (result === 'needs-stop') return
      onSettle()
    }).catch((reason: unknown) => {
      setArchiving(false)
      setError(reason instanceof Error ? reason.message : String(reason))
    })
  }
  return (
    <Modal
      open
      onClose={close}
      closeLabel={t('close')}
      title={t(stopping ? 'archive.confirm.title' : 'archive.ask.title')}
      description={t(stopping ? 'archive.confirm.desc' : 'archive.ask.desc', { title: request.displayTitle })}
      footer={(
        <>
          <Button variant="outline" disabled={archiving} onClick={close}>{t('cancel')}</Button>
          <Button
            variant={stopping ? 'outline' : 'primary'}
            className={stopping ? browserCss.deleteAction : undefined}
            disabled={archiving}
            onClick={confirm}
          >
            {t(stopping ? 'archive.confirm.action' : 'archive.ask.action')}
          </Button>
        </>
      )}
    >
      {stopping && (
        <ul className={browserCss.archiveActivity} aria-label={t('archive.confirm.activity')}>
          {request.activity.map((entry, index) => (
            <li key={`${entry.kind}-${String(index)}`}>{activityLine(entry, t)}</li>
          ))}
        </ul>
      )}
      {archiving && (
        <div className={browserCss.deleteStatus} role="status">
          {t(stopping ? 'archive.confirm.pending' : 'archive.ask.pending')}
        </div>
      )}
      {error !== null && <div className={browserCss.renameError} role="alert">{error}</div>}
    </Modal>
  )
}

/**
 * One family's line: its count and the items' labels (ids when a family
 * carries no label). A family this dictionary does not know — a provider
 * merged into the kind map — falls through to the generic line.
 */
function activityLine(entry: SessionActivity, t: SessionArchiveConfirmProps['t']): string {
  const items = entry.items ?? []
  const n = items.length
  const names = items.map(item => item.label ?? item.id).join(t('archive.confirm.listSeparator'))
  const plural = n === 1 ? 'one' : 'other'
  switch (entry.kind) {
    case 'turn': return t('archive.confirm.turn')
    case 'subagent': return t(`archive.confirm.subagents.${plural}`, { n, names })
    case 'job': return t(`archive.confirm.jobs.${plural}`, { n, names })
    case 'schedule': return t(`archive.confirm.schedules.${plural}`, { n, names })
    default: return t(`archive.confirm.other.${plural}`, { kind: entry.kind, n })
  }
}
