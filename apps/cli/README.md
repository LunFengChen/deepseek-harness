# `@xfcodeai/dsh`

English | [中文](README.zh.md)

The `xfdsh` command is the sole supported Node application launcher: profiles are ordered stacks of plugin-bundle patch layers under the user's own overrides. SDK and ACP are profiles, not separate public bins. The Python runtime wheel packages this same command; the SDK defaults to `sdk`, and the minimal example selects `sdk-minimal`. [`src/args.ts`](src/args.ts) owns the command grammar, and [`src/bin.ts`](src/bin.ts) loads only the selected runner. Invalid commands, options from another mode, configuration errors, and boot failures exit nonzero.

## Entry modes

| Command | Purpose |
|---|---|
| `xfdsh --profile <name>` | Boot the named profile under `$DSH_HOME/profiles/<name>`. |
| `xfdsh --profile acp` | Serve automation clients over ACP stdio until disconnect. |
| `xfdsh --profile headless "job"` | Run one fresh persisted session, print the final answer, and exit. |
| `xfdsh --profile sdk` | Serve SDK clients over JSON-RPC stdio until shutdown or disconnect. |
| `xfdsh --profile sdk-minimal` | Serve SDK clients with the standalone minimal agent tree. |
| `xfdsh web` | Alias of `--profile web`. |
| `xfdsh plugin --profile <name> <pnpm args>` | Manage a profile's plugins by forwarding to pnpm in the profile directory. |

The invoking directory is the default workspace root. The `web`, `headless`, `sdk`, `sdk-minimal`, and `acp` profiles auto-initialize on first use from shipped templates; any other profile must be created through `xfdsh plugin`.

## App arguments

The launcher parses only its own flags and hands everything after them to the booted profile, where any injected app plugin may parse the shared immutable snapshot ([`dsh-cmdline`](../../packages/boot/cmdline/README.md)). The first token the launcher does not recognize starts the app's arguments:

```sh
xfdsh --profile web --port 8080       # --port belongs to the web app
xfdsh --profile tui --resume <id>     # example, assuming the tui profile is installed; --resume belongs to the terminal app
xfdsh --profile headless "run the tests"
xfdsh --profile web --help            # the web app's flags, not the launcher's
xfdsh --help                          # the launcher's own help
```

<a id="profiles"></a>
## Profiles

A profile directory holds a `package.json` (out-of-tree plugin dependencies plus the profile manifest `dsh.profile` with its ordered `bundles` list and `patchReload` lifecycle) and a `cordis.patch.yml` (the user's own patch layer). `patchReload: live` watches the profile and home-level patch files; `startup` applies them once.

The tree composes over an empty root:
- each bundle's patch in `dsh.profile.bundles` order
- then the profile's `cordis.patch.yml`, then the home-level `$DSH_HOME/cordis.patch.yml`
- then `--patch` overlays

Bundles named in `dsh.profile.bundles` resolve from the dsh installation first (`@xfcodeai/dsh-base`, `@xfcodeai/dsh-web-app`, `@xfcodeai/dsh-headless`, `@xfcodeai/dsh-sdk-app`, `@xfcodeai/dsh-sdk-minimal`, `@xfcodeai/dsh-acp-app`), then from the profile's own `node_modules`, where pnpm installs out-of-tree plugins.

Use `--dump-default-config` and `--dump-config` to inspect the composed tree without booting it.

### Plugin compatibility

`xfdsh plugin --profile <name> add <package>` installs the package into the shared `$DSH_HOME/profiles/<name>` directory, so `dsh` and `xfdsh` see the same profiles and history when they use the same home. Fork packages in the `@xfcodeai/dsh-*` namespace and official bundles that declare `@deepseek-ai/dsh-*` dependencies are supported. Profile installation maps each official dsh dependency to the matching fork package while preserving the official import name, so one xfdsh runtime is used. If a matching fork package cannot be installed, pnpm fails explicitly instead of mixing official and fork runtimes. Existing profiles should run `xfdsh plugin --profile <name> install` once after upgrading.

The [CLI behavior reference](reference/README.md) owns exact layer precedence, flags, shutdown behavior, deployment defaults, and source execution.

## Optional overlays

`config/examples/` ships opt-in overlays for GitHub review webhooks, session-local Schedule, memory MCP servers, and runtime Cordis tools. They are never part of a default profile; the [user guides](../../docs/user/guide/index.md) and [developer practice guides](../../docs/user/develop/practice/index.md) own setup and safety instructions.

## Development

Production runs require built package and frontend artifacts. From the repository root, run `pnpm run build` separately, then use `pnpm dsh <args...>` to run the TypeScript entry and forward every argument; the [source-execution reference](reference/README.md#source-execution) owns the module-resolution contract.
