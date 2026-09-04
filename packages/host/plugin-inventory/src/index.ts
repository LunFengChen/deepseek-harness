/** Projection and profile-level management for the current Cordis Loader plugin entries. */

import type { Context, FiberState } from '@deepseek-ai/cordis'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import { RemoteError } from '@xfcodeai/dsh-typert-protocol'
import { writeProfilePluginOverride, type DshPluginCatalogEntry } from '@xfcodeai/dsh-app-boot'
import type {} from '@xfcodeai/dsh-app-boot'
import type {} from '@deepseek-ai/cordis-plugin-loader'
// Type-only: the optional agent-preset roster resolved through `ctx.get`.
import type {} from '@deepseek-ai/dsh-agent-presets'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  AgentPresetPluginGroup,
  PluginEntryId,
  PluginFiberPhase,
  PluginInventoryCatalogEntry,
  PluginInventoryEntry,
  PluginInventorySetEnabledRequest,
  PluginInventorySetEnabledValue,
  PluginInventorySnapshot,
} from './types.ts'

export type * from './types.ts'

/** Brand an existing Loader-tree entry id at the owning boundary. */
function pluginEntryId(value: string): PluginEntryId {
  return value as PluginEntryId
}

/** Runtime mirror: FiberState is a cross-package const enum. */
const FIBER_STATE = {
  PENDING: 0 as FiberState.PENDING,
  LOADING: 1 as FiberState.LOADING,
  ACTIVE: 2 as FiberState.ACTIVE,
  FAILED: 3 as FiberState.FAILED,
  DISPOSED: 4 as FiberState.DISPOSED,
  UNLOADING: 5 as FiberState.UNLOADING,
} as const

/** Complete public projection of Cordis Fiber states. */
const FIBER_PHASE = {
  [FIBER_STATE.PENDING]: 'pending',
  [FIBER_STATE.LOADING]: 'loading',
  [FIBER_STATE.ACTIVE]: 'active',
  [FIBER_STATE.FAILED]: 'failed',
  [FIBER_STATE.DISPOSED]: null,
  [FIBER_STATE.UNLOADING]: 'unloading',
} as const satisfies Record<FiberState, PluginFiberPhase>

/** Project profile-bundle catalog metadata onto current Loader state. */
function catalogEntries(ctx: Context): PluginInventoryCatalogEntry[] {
  const runtime = ctx.get('dshProfile')
  if (runtime === undefined) return []
  const entries = new Map<string, Entry>()
  for (const entry of ctx.loader.entries()) entries.set(entry.id, entry)
  const catalog: PluginInventoryCatalogEntry[] = []
  const seen = new Set<string>()
  for (const layer of runtime.profile.layers) {
    for (const plugin of layer.plugins ?? []) {
      if (seen.has(plugin.entryId)) {
        throw new RemoteError('gateway/bad-request', `duplicate prebundled plugin entry id ${JSON.stringify(plugin.entryId)}`, {})
      }
      seen.add(plugin.entryId)
      const entry = entries.get(plugin.entryId)
      catalog.push({
        id: plugin.id,
        entryId: pluginEntryId(plugin.entryId),
        packageName: plugin.packageName,
        ...plugin.title === undefined ? {} : { title: plugin.title },
        ...plugin.description === undefined ? {} : { description: plugin.description },
        required: plugin.required ?? false,
        defaultEnabled: plugin.required || plugin.defaultEnabled === true,
        installed: entry !== undefined,
        enabled: entry === undefined ? false : !entry.disabled,
      })
    }
  }
  return catalog
}

/** Find one profile-bundle catalog entry by its Loader id. */
function findCatalogEntry(ctx: Context, entryId: string): DshPluginCatalogEntry | undefined {
  const runtime = ctx.get('dshProfile')
  if (runtime === undefined) return undefined
  for (const layer of runtime.profile.layers) {
    const found = layer.plugins?.find(plugin => plugin.entryId === entryId)
    if (found !== undefined) return found
  }
  return undefined
}

/** Service exposing Loader state and profile-owned prebundled plugin settings. */
export class PluginInventoryGateway extends TypertRemoteService {
  static inject = ['loader']

  constructor(ctx: Context) {
    super(ctx, 'pluginInventory')
  }

  /**
   * Read the Loader directly on every call. Cordis's internal plugin/status
   * events already maintain Entry.fiber and Fiber.state, so a second cache
   * would only add another lifecycle truth to keep synchronized.
   *
   * When an agent-preset roster is composed, the snapshot also carries each
   * preset's composition rows, because those rows — not the Loader's own
   * entries — are where a deployment that mounts the roster runs its
   * model-facing plugins.
   * @returns Current non-group Loader entries in Loader order, with per-preset
   * compositions when a roster is composed.
   */
  /** Read the current Loader inventory. */
  @Remote('list')
  async list(): Promise<PluginInventorySnapshot> {
    const entries: PluginInventoryEntry[] = []
    for (const entry of this.ctx.loader.entries()) {
      if (entry.options.group) continue
      entries.push({
        entryId: pluginEntryId(entry.id),
        moduleName: entry.options.name,
        enabled: !entry.disabled,
        fiberPhase: entry.fiber === undefined ? null : FIBER_PHASE[entry.fiber.state],
      })
    }
    const catalog = catalogEntries(this.ctx)
    const presets = this.ctx.get('agentPresets')
    if (presets === undefined) return { entries, ...catalog.length === 0 ? {} : { catalog } }
    const agentPresets: AgentPresetPluginGroup[] = (await presets.compositionInventory()).map(
      composition => ({
        ...composition,
        rows: composition.rows.map(({ fiberState, ...row }) => ({
          ...row,
          fiberPhase: fiberState === undefined ? null : FIBER_PHASE[fiberState],
        })),
      }),
    )
    return { entries, ...catalog.length === 0 ? {} : { catalog }, agentPresets }
  }

  /**
   * Enable or disable one package-owned prebundled entry and persist the
   * choice in the active profile manifest.
   * @param request - catalog Loader entry id and desired enablement.
   * @returns the effective enablement after the Loader update.
   * @throws RemoteError when the profile is unavailable, the entry is not cataloged, or the update fails.
   */
  @Remote('setEnabled')
  async setEnabled(request: PluginInventorySetEnabledRequest): Promise<PluginInventorySetEnabledValue> {
    const runtime = this.ctx.get('dshProfile')
    if (runtime === undefined) {
      throw new RemoteError('gateway/internal', 'profile plugin management is unavailable in this Host', {})
    }
    const catalog = findCatalogEntry(this.ctx, request.entryId)
    if (catalog === undefined) {
      throw new RemoteError('gateway/bad-request', `plugin entry ${JSON.stringify(request.entryId)} is not prebundled in this profile`, {})
    }
    if (catalog.required && !request.enabled) {
      throw new RemoteError('gateway/bad-request', `required plugin ${JSON.stringify(request.entryId)} cannot be disabled`, {})
    }
    let entry: Entry | undefined
    for (const candidate of this.ctx.loader.entries()) {
      if (candidate.id === request.entryId) {
        entry = candidate
        break
      }
    }
    if (entry === undefined) {
      throw new RemoteError('gateway/internal', `prebundled plugin ${JSON.stringify(request.entryId)} is not installed`, {})
    }
    const previousEnabled = !entry.disabled
    if (previousEnabled !== request.enabled) await entry.update({ disabled: !request.enabled })
    try {
      writeProfilePluginOverride(runtime.binName, runtime.profile.dir, request.entryId, request.enabled)
    } catch (error) {
      if (previousEnabled !== request.enabled) await entry.update({ disabled: !previousEnabled })
      throw error
    }
    runtime.profile.pluginOverrides = {
      ...(runtime.profile.pluginOverrides ?? {}),
      [request.entryId]: request.enabled,
    }
    return { enabled: !entry.disabled }
  }
}

export default PluginInventoryGateway
