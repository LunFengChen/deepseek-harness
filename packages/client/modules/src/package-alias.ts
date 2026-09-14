/**
 * Official and fork package names for the same dsh product package.
 * @module @x1a0f3n9/dsh-client-modules/package-alias
 */

const OFFICIAL_PREFIX = '@deepseek-ai/dsh-'
const FORK_PREFIX = '@x1a0f3n9/dsh-'

/**
 * Return the opposite published name for an official or fork dsh package.
 * @param name - package name or subpath specifier such as `@scope/dsh-foo/client`.
 * @returns the aliased specifier, or `undefined` when the name is not a dsh product package.
 */
export function alternateDshPackageName(name: string): string | undefined {
  if (name.startsWith(OFFICIAL_PREFIX)) return FORK_PREFIX + name.slice(OFFICIAL_PREFIX.length)
  if (name.startsWith(FORK_PREFIX)) return OFFICIAL_PREFIX + name.slice(FORK_PREFIX.length)
  return undefined
}

/**
 * Return the stored key matching `name` or its official/fork alias.
 * @param map - table keyed by package name or specifier.
 * @param name - requested package name or specifier.
 * @returns the matching key when present.
 */
export function aliasedKey<T>(map: Map<string, T>, name: string): string | undefined {
  if (map.has(name)) return name
  const alternate = alternateDshPackageName(name)
  return alternate !== undefined && map.has(alternate) ? alternate : undefined
}

/**
 * Look up a map by the given name, then by its official/fork alias.
 * @param map - table keyed by package name or specifier.
 * @param name - requested package name or specifier.
 * @returns the stored value when either spelling is present.
 */
export function lookupAliased<T>(map: Map<string, T>, name: string): T | undefined {
  const key = aliasedKey(map, name)
  return key === undefined ? undefined : map.get(key)
}
