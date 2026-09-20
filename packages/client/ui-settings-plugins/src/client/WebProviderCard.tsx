/** The Web provider-selection card. */

import type { InjectFace, PropsLocale, PropsRuntime } from '@x1a0f3n9/dsh-client-ui-slots'
import { PluginCard } from './PluginCard.tsx'
import { SelectField } from './fields.tsx'
import {
  WEB_SEARCH_PROVIDER_OPTIONS,
  type WebProviderCardFace,
} from './web-provider-card-controller.ts'
import type { PluginsSettingsLocaleKey } from './locales.ts'
import type {} from './slot-contract.ts'

/** Props the renderer binds for the Web provider card. */
export type WebProviderCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<WebProviderCardFace>

/**
 * Render the Web provider-selection card.
 * @param props - slot-provided locale, settings state, and staged form actions.
 * @returns the provider-selection settings card.
 */
export function WebProviderCard(props: WebProviderCardProps) {
  const { t } = props
  const state = props.useWebProviderCard(snapshot => snapshot)
  const disabled = !state.writable
  return (
    <PluginCard
      t={t}
      titleKey="webProviderTitle"
      descriptionKey="webProviderDescription"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      <SelectField
        id="plugin-config-web-provider"
        label={t('webProviderLabel')}
        hint={t('webProviderHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        disabled={disabled}
        {...state.searchProvider}
        options={WEB_SEARCH_PROVIDER_OPTIONS.map(option => ({
          value: option.value,
          label: t(option.labelKey as PluginsSettingsLocaleKey),
        }))}
        onEdit={(value) => { props.edit('searchProvider', value) }}
        onReset={() => { props.resetField('searchProvider') }}
      />
    </PluginCard>
  )
}
