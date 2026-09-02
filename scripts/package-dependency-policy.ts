/** Explicit exceptions and Host packages for the published dependency policy. */

/** Packages treated as Client/Host packages without declaring `dsh.client`. */
const CLIENT_FACE_INCLUDE: readonly string[] = []

/** Packages exempted from automatic Client/Host treatment despite declaring `dsh.client`. */
const CLIENT_FACE_EXCLUDE: readonly string[] = [
  '@xfcodeai/dsh-api-session-controller',
  '@xfcodeai/dsh-api-workspace-controller',
]

/** Host-only packages whose peer relays are deliberately flattened. */
const HOST_DEPENDENCY_PACKAGES: readonly string[] = [
  '@xfcodeai/dsh-llm',
  '@xfcodeai/dsh-session',
]

/** Development-only package relationships not represented by source imports. */
const CONFIGURATION_ONLY_DEV_DEPENDENCIES = {
  '@xfcodeai/dsh-client-locale': ['@xfcodeai/dsh-api-remotes'],
  '@xfcodeai/dsh-client-ui-conversation': [
    '@xfcodeai/dsh-api-remotes',
    '@xfcodeai/dsh-client-ui-workspace',
  ],
  '@xfcodeai/dsh-client-ui-model-selection': ['@xfcodeai/dsh-client-ui-input-trigger'],
  '@xfcodeai/dsh-client-ui-sidebar': ['@xfcodeai/dsh-client-ui-workspace'],
  '@xfcodeai/dsh-client-ui-subagent': ['@xfcodeai/dsh-client-ui-input-trigger'],
  '@xfcodeai/dsh-client-ui-theme': ['@xfcodeai/dsh-api-remotes'],
  '@xfcodeai/dsh-client-ui-tool': ['@xfcodeai/dsh-api-remotes'],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Workspace packages whose complete runtime surface is safe across duplicate installations. */
const DUPLICATE_SAFE_PACKAGES: readonly string[] = [
  '@xfcodeai/dsh-brand',
  '@xfcodeai/dsh-typert-protocol',
  '@xfcodeai/dsh-util-crypto',
  '@xfcodeai/dsh-util-values',
]

/**
 * Runtime exports whose values remain valid when npm installs another package copy.
 */
const SAFE_HOST_DEPENDENCY_EXPORTS = {
  '@xfcodeai/dsh-credentials': ['credentialKey'],
  '@xfcodeai/dsh-deque': ['Deque'],
  '@xfcodeai/dsh-llm': ['callConfigEquals'],
  '@xfcodeai/dsh-timeout': ['MAX_TIMER_DELAY_MS'],
  '@deepseek-ai/schemastery': ['default'],
} as const satisfies HostDependencyExports

/** Runtime exports that require every consumer to resolve the provider's shared peer instance. */
const PEER_REQUIRED_HOST_EXPORTS = {
  '@xfcodeai/dsh-scope': ['carrierKeyOf', 'scopeOf', 'scopeTarget'],
} as const satisfies HostDependencyExports

/** Exact import specifier to reviewed runtime exports. */
type HostDependencyExports = Readonly<Record<string, readonly string[]>>

/** Complete configurable input to package dependency classification. */
export interface PackageDependencyPolicy {
  readonly clientFaceInclude: readonly string[]
  readonly clientFaceExclude: readonly string[]
  readonly hostPackages: readonly string[]
  readonly configurationOnlyDevDependencies: Readonly<Record<string, readonly string[]>>
  readonly duplicateSafePackages?: readonly string[]
  readonly safeHostDependencyExports: HostDependencyExports
  readonly peerRequiredHostExports: HostDependencyExports
}

/** Repository dependency policy consumed by verification and benchmarking. */
export const PACKAGE_DEPENDENCY_POLICY: PackageDependencyPolicy = {
  clientFaceInclude: CLIENT_FACE_INCLUDE,
  clientFaceExclude: CLIENT_FACE_EXCLUDE,
  hostPackages: HOST_DEPENDENCY_PACKAGES,
  configurationOnlyDevDependencies: CONFIGURATION_ONLY_DEV_DEPENDENCIES,
  duplicateSafePackages: DUPLICATE_SAFE_PACKAGES,
  safeHostDependencyExports: SAFE_HOST_DEPENDENCY_EXPORTS,
  peerRequiredHostExports: PEER_REQUIRED_HOST_EXPORTS,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether a package manifest declares a dynamically loaded Client entry. */
export function hasClientDeclaration(dshField: unknown): boolean {
  return isRecord(dshField) && Object.hasOwn(dshField, 'client')
}

/** Whether the repository policy flattens one package's non-Cordis peers. */
export function usesFlattenedPackageDependencies(
  manifestPath: string,
  packageName: string,
  dshField: unknown,
  policy: PackageDependencyPolicy = PACKAGE_DEPENDENCY_POLICY,
): boolean {
  if (!manifestPath.startsWith('packages/') || manifestPath.startsWith('packages/experimental/')) return false
  if (policy.hostPackages.includes(packageName)) return true
  if (manifestPath.startsWith('packages/client/')) return true
  const included = hasClientDeclaration(dshField) || policy.clientFaceInclude.includes(packageName)
  return included && !policy.clientFaceExclude.includes(packageName)
}
