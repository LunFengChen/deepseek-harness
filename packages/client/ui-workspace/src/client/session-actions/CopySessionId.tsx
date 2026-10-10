/** The copy-session-id action: one `sidebar.workspaces.session.menu.item` row. */
import { useState } from 'react'
import {
  IconCheckOutlineRegular, IconCopyOutlineRegular, MenuItemButton, writeClipboard,
} from '@x1a0f3n9/dsh-client-ui-primitives'
import type { SessionMenuItemProps } from '../contract/slots.ts'

/**
 * Menu row (order 500): copy this Session's id. The menu stays open so the
 * copied label is visible; a later open remounts the row.
 * @param props - owner share and the menu open state.
 * @returns the row.
 */
export function CopySessionIdMenuItem({ sessionId, t }: SessionMenuItemProps) {
  const [copied, setCopied] = useState(false)
  return (
    <MenuItemButton
      icon={copied ? <IconCheckOutlineRegular /> : <IconCopyOutlineRegular />}
      onSelect={() => {
        void writeClipboard(sessionId).then((ok) => {
          if (ok) setCopied(true)
        })
      }}
    >
      {t(copied ? 'menu.copiedSessionId' : 'menu.copySessionId')}
    </MenuItemButton>
  )
}
