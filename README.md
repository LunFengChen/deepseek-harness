# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

Fork note: this branch publishes `@x1a0f3n9/dsh` and the `xfdsh` launcher so it can coexist with upstream `dsh`. The table below summarizes the main fork changes.

## Fork summary

The rows below summarize the fork's user-visible and release-impacting changes; merge commits only integrate upstream work and are not listed separately.

| Area | What changed | Result |
| --- | --- | --- |
| Package namespace | Development packages use `@x1a0f3n9/dsh-*`. `master` tracks upstream `@deepseek-ai/dsh-*`. A later stable fork line publishes `@xfcodeai/dsh-*`. Vendor and native packages keep `@deepseek-ai/*`. | The two fork lines and official `dsh` do not share an npm scope. |
| Launcher | The shipped command is `xfdsh`. Official `dsh` stays the upstream CLI. | The two products can be installed together. |
| Homes | `xfdsh` stores plugins and profiles in `~/.xfdsh`. Official `dsh` keeps plugins and profiles in `~/.dsh`. Sessions, workspace groups, attachments, settings, and API keys stay in `~/.dsh`. | History is shared without a migration wizard. `xfdsh` never writes `~/.dsh/profiles`. |
| Web port | `xfdsh web` listens on `127.0.0.1:7777`. Official `dsh web` stays on `3080`. | Both UIs can run at the same time. |
| Session timeline | Preinstalled, disableable plugin: rewind, delete, regenerate, and a composer compact button. Delete truncates the selected turn and every later event. Compact lands a truncated thinking-model summary instead of leaving the conversation unchanged. | Unwanted answers leave the UI and later model requests. One click runs `/compact`. |
| Plugin market | Preinstalled, disableable plugin `github:LunFengChen/dsh-market#v1.44.0`. Official `@deepseek-ai/dsh-*` plugins remap into this runtime. | Community plugins install with `xfdsh plugin --profile web add`. |
| Plugin authors | Optional-plugin cards show the catalog author as a GitHub link. | Settings → Plugins opens the plugin repository instead of leaving the package name as the only byline. |
| Reasoning effort | Preinstalled slider `github:LunFengChen/dsh-reasoning-effort#v0.7.1`. Settings → Models lets each custom model choose Default (none) or Custom `reasoningEfforts`. | The composer can pick thinking strength after a custom model declares levels. Disable the slider from Settings → Plugins. |
| Context dashboard | Preinstalled, disableable plugin `github:LunFengChen/dsh-context#v0.49.6`. Version detection reads this fork, not a leftover official CLI. | A Context tab and `/context` command show composition, compaction, and token use. |
| Better sidebar | Preinstalled, disableable plugin `github:LunFengChen/DSH-better-sidebar#v0.19.0-alpha.1`. | Files, terminal, Git, and subagents live in the sidebar workbench. |
| Hindsight memory | Preinstalled and on by default: `@vectorize-io/hindsight-coding-agents@0.5.2`. | xfdsh defaults to a local daemon, not Cloud. Disable from Settings → Plugins. Cloud or a self-hosted URL remains optional in `~/.hindsight/coding-agent.json`. |
| Session utilities | Workspace rows can copy the session id. | Session ids are easier to share and debug. |
| Memory and continuation | Session persistence bounds in-memory reads; context overflow triggers compaction and retry. A large-to-small model switch prices pressure against the pending picker before the next request. | Long sessions are less likely to stall. Truncated nonempty summaries still replace the compacted span. |
| Text-only models | Historical and new images become stable text placeholders on text-only routes. | Switching models does not strand a session that already contains images. |
| Web search | Default provider order is Perplexity, then Exa. DeepSeek search remains selectable. | Search does not always bill DeepSeek. |
| Multi-answer / session git graph | Not implemented. Follow-up work on `dsh-session-timeline` after the rewind UI is done. | Documented and deferred. |

## Branches

GitHub's default branch is `dev-x1a0f3n9`. Clone without `-b` already lands on the fork line. Do not commit fork features onto `master`.

| Branch | Role | npm |
| --- | --- | --- |
| `master` | Tracks upstream dsh. Sync upstream here. | Does not publish this fork today. |
| `dev-x1a0f3n9` | Fork integration. Test here, then push. | Push publishes `@x1a0f3n9/*`. |
| `feat/<topic>` or `fix/<topic>` | One small change, cut from `dev-x1a0f3n9`. | None. Merge `--no-ff` into `dev-x1a0f3n9`. |

1. Update `master` from upstream `deepseek-ai/deepseek-harness`.
2. Merge that `master` into `dev-x1a0f3n9`. Resolve conflicts on the fork line, not on `master`.
3. Cut `feat/<topic>` or `fix/<topic>` from `dev-x1a0f3n9`.
4. Merge `--no-ff` back into `dev-x1a0f3n9`. Do not merge those short-lived branches into `master`.
5. Test `dev-x1a0f3n9` locally with `pnpm xfdsh web`.
6. Push `dev-x1a0f3n9`. CI builds and publishes `@x1a0f3n9/*`.
7. When the fork set is ready, merge `dev-x1a0f3n9` into `master` for the `@xfcodeai/*` line.

## Install this fork

There are two supported install paths for this fork. Both start `xfdsh web` at `http://127.0.0.1:7777`. Official `dsh` is a separate product and does not need a history migration.

**Official `dsh` (unchanged):**

```sh
npm install --global @deepseek-ai/dsh
dsh web
```

This uses `~/.dsh` for plugins, profiles, sessions, settings, and keys, and listens on `http://127.0.0.1:3080`.

**Fork npm (development scope `@x1a0f3n9`):**

```sh
npm install --global @x1a0f3n9/dsh
xfdsh web
```

**Fork source checkout:**

```sh
git clone -b dev-x1a0f3n9 https://github.com/LunFengChen/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm xfdsh web
```

`pnpm xfdsh web` launches this checkout through tsx. Later launches do not need another compile. Rebuild after a fresh clone, after pulling large changes, or when using `pnpm exec xfdsh`. A bare `xfdsh web` on PATH comes from `npm install --global @x1a0f3n9/dsh`.

For one-off use without a global install:

```sh
npx --package @x1a0f3n9/dsh xfdsh web
```

`xfdsh` keeps plugins and profiles in `~/.xfdsh` and never writes `~/.dsh/profiles`. Sessions, workspace groups, attachments, settings, and API keys stay in `~/.dsh`, so both CLIs see the same history. Preinstalled timeline, plugin-market, reasoning-effort, context, better-sidebar, and hindsight entries can be disabled from Settings → Plugins.

Pushing `dev-x1a0f3n9` publishes `@x1a0f3n9/*`. An npm new-name quota pause stops that run without failing it; the next push continues remaining names. `master` currently tracks upstream and does not publish this fork. A later stable fork publish uses `@xfcodeai/*`.

## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx --package @x1a0f3n9/dsh xfdsh web
```

The command starts the Web UI at `http://127.0.0.1:7777` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone -b dev-x1a0f3n9 https://github.com/LunFengChen/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm xfdsh web
```

Daily launches are `pnpm xfdsh web` and do not rebuild. `pnpm exec xfdsh web` uses the built bin and needs a current `lib/`.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/LunFengChen/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
