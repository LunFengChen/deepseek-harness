/** Static Browser tab type and guide declaration. */
import type { TranslateNS } from '@x1a0f3n9/dsh-client-locale/client'
import { IconGlobeOutline14 } from '@x1a0f3n9/dsh-client-ui-primitives'
import type { SidebarRightTabDefinition } from '@x1a0f3n9/dsh-client-ui-sidebar-right/client'
import type {} from './locales.ts'

/** Browser tab kind. */
export const BROWSER_KIND = 'browser'

/** Browser implementation identity and keyed Slot dispatch key. */
export const BROWSER_ID = '@x1a0f3n9/dsh-client-ui-sidebar-browser'

/** Build the Browser type with locale-live copy. */
export function browserDefinition(t: TranslateNS<'sidebarBrowser'>): SidebarRightTabDefinition {
  return {
    id: BROWSER_ID,
    kind: BROWSER_KIND,
    multiple: true,
    priority: 'builtin',
    title: () => t('type.label'),
    guide: [{
      id: 'new', order: 30, title: () => t('guide.title'),
      description: () => t('guide.description'), icon: IconGlobeOutline14,
    }],
  }
}
