/** Browser entry for optional translation of expanded reasoning. */
import type { Context } from '@deepseek-ai/cordis'
import remote from '@x1a0f3n9/dsh-experimental-client-ui-cot-translation/remote'
import { mountTranslation } from './mount.ts'

export { inject } from './mount.ts'
export type { CotTranslationPreferences } from '../preferences.ts'
export type { CotTranslationKey } from './locales.ts'
export type { TranslationBodyInjected, TranslationBodyProps } from './TranslationBody.tsx'
export type { TranslationFormInjected, TranslationFormState } from './preferences-form.ts'

declare module '@x1a0f3n9/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { cotTranslation: import('./locales.ts').CotTranslationKey }
}

/**
 * Mount the experimental reasoning presentation and its Remote methods.
 * @param ctx - browser plugin context.
 * @returns disposer joining UI and Remote withdrawal.
 */
export async function apply(ctx: Context): Promise<() => Promise<void>> { return await mountTranslation(ctx, remote) }
