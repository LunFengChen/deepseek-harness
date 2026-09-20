/**
 * Resolve official `@x1a0f3n9/dsh-*` imports onto this fork's packages.
 *
 * Community plugins keep the official package names. pnpm `npm:@x1a0f3n9/...@workspace:*`
 * overrides write broken symlinks, so source launch remaps the specifier before
 * Node walks `node_modules`.
 * @module @x1a0f3n9/dsh-app-boot/official-package-resolve
 */

import { registerHooks, type ResolveHookSync } from 'node:module'
import { forkDshPackageName } from './profile.ts'

/** Whether {@link registerOfficialDshPackageResolve} has already installed the hook. */
let registered = false

/**
 * Remap one official dsh specifier onto the fork namespace, including subpaths.
 * @param specifier - module specifier from the resolver.
 * @returns the fork specifier, or `undefined` when the request is not an official dsh package.
 */
export function remapOfficialDshSpecifier(specifier: string): string | undefined {
  return forkDshPackageName(specifier)
}

/**
 * Node resolve hook that rewrites official dsh package names to the fork.
 * @param specifier - module specifier from the resolver.
 * @param context - resolver context forwarded to the next hook.
 * @param nextResolve - next resolver in the hook chain.
 * @returns the next resolver's result for the original or remapped specifier.
 */
export const resolveOfficialDshPackage: ResolveHookSync = (specifier, context, nextResolve) => {
  const remapped = remapOfficialDshSpecifier(specifier)
  return remapped === undefined ? nextResolve(specifier, context) : nextResolve(remapped, context)
}

/**
 * Install the official-to-fork resolve hook once for this process.
 * @returns nothing.
 */
export function registerOfficialDshPackageResolve(): void {
  if (registered) return
  registered = true
  registerHooks({ resolve: resolveOfficialDshPackage })
}
