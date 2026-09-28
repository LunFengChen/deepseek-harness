/** Live Browser tab title from the Browser store. */
import type { ReactNode } from 'react'
import { IconGlobeOutline14 } from '@x1a0f3n9/dsh-client-ui-primitives'
import type { PropsRuntime, PropsStore } from '@x1a0f3n9/dsh-client-ui-slots'
import { BrowserNavigation } from '../browser/BrowserNavigation.ts'
import type { BrowserStore } from '../browser/store.ts'
import css from './Browser.module.css'

/** Browser title props assembled by the Sidebar title seat. */
export type BrowserTitleProps = PropsRuntime<'sidebar.right.pane.tab.title'> & PropsStore<BrowserStore>

/** Browser icon and current host name. */
export function BrowserTitle({ useTabInfo, useStore }: BrowserTitleProps): ReactNode {
  const { tab } = useTabInfo()
  const entry = useStore(state => BrowserNavigation.current(state.byTab[tab.id]))
  return <><IconGlobeOutline14 className={css.titleIcon} />{entry?.title ?? tab.title}</>
}
