/**
 * Shared declarations for the package.json fields used by DSH plugin authors.
 * Each reader owns JSON validation and resolved defaults.
 * @module @x1a0f3n9/dsh-package-manifest/types
 */

/** Package identity and metadata; local profile readers may accept a partial declaration. */
export interface DshPackageManifest {
  /** Published npm package name. */
  name: string
  /** Published npm package version. */
  version: string
  /** Package summary for discovery and display. */
  description?: string
  /** Prevent npm publication, for example for local profile projects. */
  private?: boolean
  /** Packages installed alongside this package. */
  dependencies?: Record<string, string>
  /** Compatible versions of packages supplied by the consuming project. */
  peerDependencies?: Record<string, string>
  /** Runtime requirements; DSH compatibility is declarative until a reader enforces it. */
  engines?: DshEnginesManifest
  /** DSH-specific author declarations. */
  dsh?: DshManifest
}

/** Public author fields under `package.json.dsh`; a package may declare several roles. */
export interface DshManifest {
  /** Manifest format version, independent of the npm package and Session format versions. */
  manifestVersion?: 1
  /** Bundle metadata consumed by the profile launcher. */
  bundle?: DshBundleManifest
  /** Profile metadata consumed by the profile launcher. */
  profile?: DshProfileManifest
  /** Client module loading and build metadata. */
  client?: DshClientManifest
  /**
   * Launcher-generated module proxy metadata, not an author configuration entry.
   * @internal
   */
  moduleFallback?: DshModuleFallbackManifest
}

/** Metadata generated and read by the launcher's module fallback proxies. */
export interface DshModuleFallbackManifest {
  /** Package export subpaths mapped to resolved target file URLs. */
  targets: Record<string, string>
}

/** Runtime version requirements under `package.json.engines`. */
export interface DshEnginesManifest {
  /** Compatible DSH versions as a SemVer range, including an exact version. */
  dsh?: string
  /** Compatible Node.js versions. */
  node?: string
  /** Compatible npm versions. */
  npm?: string
  /** Requirements for additional runtimes or package managers. */
  [engine: string]: string | undefined
}

/** Metadata for one prebundled plugin feature that a profile may toggle. */
export interface DshPluginCatalogEntry {
  /** Stable catalog identity, unique across the selected bundle layers. */
  id: string
  /** Loader entry id changed when this feature is enabled or disabled. */
  entryId: string
  /** Package that provides the feature, for display and diagnostics. */
  packageName: string
  /** Optional package-owned display title. */
  title?: string
  /** Optional package-owned description. */
  description?: string
  /** Optional display name for the plugin author. */
  author?: string
  /** Optional https://github.com URL opened from the author byline. */
  homepage?: string
  /** Required features cannot be disabled from profile settings. */
  required?: boolean
  /** Default runtime state when the profile has no saved override. */
  defaultEnabled?: boolean
}

/** The configuration layer exported by a bundle package. */
export interface DshBundleManifest {
  /** Patch file path relative to the declaring package root. */
  patch: string
  /** Optional prebundled plugin features exposed for profile settings. */
  plugins?: readonly DshPluginCatalogEntry[]
}

/** The bundle composition declared by a profile directory. */
export interface DshProfileManifest {
  /** Ordered bundle layer list, using installed package names. */
  bundles?: string[]
  /** Persisted enablement overrides for prebundled plugin catalog entries. */
  pluginOverrides?: Record<string, boolean>
  /** User patch lifecycle; omitted means `live` for custom profiles. */
  patchReload?: ProfilePatchReload
}

/** Whether user patch files reload while a profile remains active or apply only at startup. */
export type ProfilePatchReload = 'live' | 'startup'

/** Client module declaration read by client-modules and the client build. */
export interface DshClientManifest {
  /** Client platform identifier; the Web consumer selects `web`. */
  platform: string
  /** Informational package-name dependencies, not Cordis service injection. */
  inject?: string[]
  /** Boot phase-one registration barrier; absent means the shared application batch. */
  immediately?: boolean
  /**
   * Exact module-table requests beyond the implicit client baseline, including
   * subpaths such as `<pkg>/client`; absent means baseline externals only.
   * Type-only imports are erased and create no module request.
   */
  external?: string[]
}
