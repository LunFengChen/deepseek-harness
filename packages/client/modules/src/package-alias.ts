/**
 * Official and fork package names for the same dsh product package.
 * @module @x1a0f3n9/dsh-client-modules/package-alias
 */

const OFFICIAL_PREFIX = '@deepseek-ai/dsh-'
const FORK_PREFIX = '@x1a0f3n9/dsh-'

/** Community preset plugins whose upstream npm name is not `@deepseek-ai/dsh-*`. */
const COMMUNITY_ALIAS_ROOTS = [
  ['dsh-context', '@x1a0f3n9/dsh-context'],
  ['dsh-better-sidebar', '@x1a0f3n9/dsh-better-sidebar'],
  ['@michengai/dsh-skills-manager', '@x1a0f3n9/dsh-skills-manager'],
] as const

/**
 * Swap a community plugin specifier between upstream and fork spellings.
 * @param name - package name or subpath specifier.
 * @returns the other spelling, or `undefined` when `name` is not a known community plugin.
 */
function alternateCommunityPackageName(name: string): string | undefined {
  for (const [upstream, fork] of COMMUNITY_ALIAS_ROOTS) {
    if (name === upstream) return fork
    if (name === fork) return upstream
    if (name.startsWith(`${upstream}/`)) return fork + name.slice(upstream.length)
    if (name.startsWith(`${fork}/`)) return upstream + name.slice(fork.length)
  }
  return undefined
}

/**
 * Return the opposite published name for an official or fork dsh package.
 * @param name - package name or subpath specifier such as `@scope/dsh-foo/client`.
 * @returns the aliased specifier, or `undefined` when the name is not a dsh product package.
 */
export function alternateDshPackageName(name: string): string | undefined {
  const community = alternateCommunityPackageName(name)
  if (community !== undefined) return community
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
