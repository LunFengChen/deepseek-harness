import { defineConfig } from 'tsdown'

/** Separate entry bundles keep the private process bootstrap self-contained. */
export default defineConfig([
  { entry: ['lib/types/index.js'], outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false },
  { entry: { process: 'lib/types/process-entry.js' }, outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', fixedExtension: false, dts: false, clean: false, noExternal: ['@x1a0f3n9/dsh-subprocess/control'] },
])
