/** The Web provider-selection card's staged form over the `web` namespace. */

import type { SnapshotStore } from '@x1a0f3n9/dsh-client-store'
import type { SettingsScope } from '@x1a0f3n9/dsh-client-ui-settings/client'
import { CardForm, textField, type CardActions, type CardFieldState, type CardShell } from './card-form.ts'

/** Settings namespace owned by the Web runtime. */
export const WEB_PROVIDER_NS = 'web'

/** The Web runtime setting this card edits. */
export interface WebProviderSettings {
  /** Explicit search provider id; omitted means the profile fallback order. */
  searchProvider?: string
}

/** Search-provider choices exposed by the Web settings card. */
export const WEB_SEARCH_PROVIDER_OPTIONS = [
  { value: '', labelKey: 'webProviderDefault' },
  { value: 'search-pool', labelKey: 'webProviderPool' },
  { value: 'perplexity', labelKey: 'webProviderPerplexity' },
  { value: 'exa', labelKey: 'webProviderExa' },
  { value: 'free', labelKey: 'webProviderFree' },
  { value: 'deepseek-official', labelKey: 'webProviderDeepSeek' },
] as const

/** State rendered by the Web provider-selection card. */
export interface WebProviderCardState extends CardShell {
  /** Explicit search-provider selection. */
  searchProvider: CardFieldState
}

/** Registration-side face injected into the Web provider card. */
export interface WebProviderCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as useWebProviderCard. */
    webProviderCard: SnapshotStore<WebProviderCardState>
  }
}

/** Bridges the Web settings scope onto the staged provider-selection form. */
export class WebProviderCardController {
  private readonly form: CardForm<WebProviderSettings>
  private readonly store: SnapshotStore<WebProviderCardState>

  /** @param scope - the bound settings scope for the `web` namespace. */
  constructor(scope: SettingsScope<WebProviderSettings>) {
    this.form = new CardForm(scope, [textField('searchProvider')])
    this.store = this.form.bind(() => this.projection())
  }

  private projection(): WebProviderCardState {
    return { ...this.form.shell(), searchProvider: this.form.field('searchProvider') }
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject(): WebProviderCardFace {
    return { hooks: { webProviderCard: this.store }, ...this.form.actions() }
  }
}
