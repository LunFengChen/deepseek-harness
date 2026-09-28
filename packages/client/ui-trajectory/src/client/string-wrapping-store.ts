import {
  createSnapshotStore, type SnapshotStore,
} from '@x1a0f3n9/dsh-client-store'

/**
 * Create the browser-wide default for expanded JSON strings.
 * @returns A persisted preference sampled only when a string is expanded.
 */
export function createTrajectoryStringWrappingStore(): SnapshotStore<boolean> {
  return createSnapshotStore(false, {
    persist: { name: 'dsh.trajectory.jsonStringWrapping' },
  })
}
