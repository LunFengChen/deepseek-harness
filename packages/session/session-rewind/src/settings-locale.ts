/**
 * Small host-side adapter for reading the locale preference from the settings
 * provider. The current settings API accepts a namespace string directly.
 *
 * @module dsh-rewind/settings-locale
 */

/** Minimal settings provider face needed by the locale reader. */
export interface SettingsProviderLike {
  /**
   * Read one registered settings namespace.
   * @param namespace - Registered settings namespace.
   * @returns The resolved namespace value, when it is registered.
   */
  get(namespace: string): unknown
}

/**
 * Read one settings section.
 * @param provider - Settings provider owning the namespace.
 * @param namespace - Registered settings namespace.
 * @returns The resolved namespace value, when it is registered.
 */
export function readSettingsSection(provider: SettingsProviderLike, namespace: string): unknown {
  return provider.get(namespace)
}
