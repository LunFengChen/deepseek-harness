/** Computer-use provider identities. @module @x1a0f3n9/dsh-computer-use/brand */

import type { Branded } from '@x1a0f3n9/dsh-brand'

/** Provider-owned name identifying a computer-use registration. */
export type ComputerUseProviderName = Branded<'ComputerUseProviderName'>

/**
 * Brand a provider-owned name without changing or validating it.
 * @param name - name chosen by the provider implementation.
 * @returns the same name with its computer-use provider brand.
 */
export function ComputerUseProviderName(name: string): ComputerUseProviderName {
  return name as ComputerUseProviderName
}
