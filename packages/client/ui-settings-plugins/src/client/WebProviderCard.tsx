/**
 * The Web provider-selection page: which search backend this deployment uses.
 */

import type {} from '@x1a0f3n9/dsh-client-ui-plugin-manager/client'
import type { InjectFace, PropsLocale, PropsRuntime } from '@x1a0f3n9/dsh-client-ui-slots'
import { SelectField } from './fields.tsx'
import { PluginConfigForm } from './PluginConfigForm.tsx'
import {
  WEB_SEARCH_PROVIDER_OPTIONS,
  type WebProviderCardFace,
} from './web-provider-card-controller.ts'
import type { PluginsSettingsLocaleKey } from './locales.ts'

/** Props the renderer binds for the Web provider page. */
export type WebProviderCardProps =
  PropsRuntime<'plugins.item'>
  & PropsLocale<'settings.plugins'>
  & InjectFace<WebProviderCardFace>

/**
 * Render the Web provider one-liner or its configuration form, as the Plugins page asks.
 * @param props - the view asked for, locale copy, the form snapshot, and its actions.
 * @returns the one-liner, or the form.
 */
export function WebProviderCard(props: WebProviderCardProps) {
  const { t } = props
  const state = props.useWebProviderCard(snapshot => snapshot)
  if (props.view === 'summary') return t('webProviderDescription')
  const disabled = !state.writable
  return (
    <PluginConfigForm
      t={t}
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
    </PluginConfigForm>
  )
}
