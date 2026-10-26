import { defineConfig } from 'tsdown'

/** The Node provider and its private process bootstraps are published bundles. */
export default defineConfig([
  { entry: ['lib/types/index.js'], outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false },
  { entry: { process: 'lib/types/process-entry.js' }, outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false, noExternal: ['@x1a0f3n9/dsh-subprocess/control'] },
  { entry: { 'persistent-process': 'lib/types/persistent-process-entry.js' }, outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false, noExternal: ['@x1a0f3n9/dsh-subprocess/control'] },
])
