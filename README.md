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
| Package namespace | Workspace packages were rescoped from `@deepseek-ai/dsh-*` to `@x1a0f3n9/dsh-*`; vendor and native packages keep their upstream scopes. | The fork owns its own published package line. |
| Launcher and release | The published executable is `xfdsh`; release verification, pack layout, and entrypoint checks were updated to match. | The fork installs and runs beside upstream `dsh` without command collisions. |
| Session history | The web UI can delete a turn and every later event in the same session, with destructive confirmation. The session controller forwards the request to persistence, the JSONL backend rewrites durable logs, and the projection cache schema was bumped. | Unwanted answers can be removed from the live session and from disk. |
| Session utilities | Workspace rows include a copy-session-id action. | Session ids are easier to share and debug. |
| Memory and continuation | Session persistence now bounds in-memory reads; context overflow triggers compaction; handshake failures resume; goal rounds can continue past the old hard stop; compaction retry defaults were raised. | Long sessions and long tasks are less likely to stall or get killed early. |
| LLM and replay | `PI_AI_ERROR` gets default retries; finish-reason truncation is classified as non-retryable; wrapped replay state and foreign replay metadata are handled correctly; provider-scoped env reach is asserted in tests. | Fewer false failures, fewer replay mismatches, and clearer retry behavior. |
| Model and attachment compatibility | Commands that do not accept images continue with text and keep the image draft; text-only model routes project historical and new images to stable text placeholders before dispatch. | Switching to a text-only model does not strand a session that already contains images. |
| Sandbox and permissions | Stale full-access escalation targets are ignored. | Old permission artifacts stop triggering the wrong escalation path. |
| Docs and examples | README, CLI help, release notes, and session-controller API docs were synchronized with the fork behavior. | The fork is documented the same way it behaves. |

### Install this fork

```sh
npm install --global @x1a0f3n9/dsh
xfdsh web
```

For one-off use:

```sh
npx @x1a0f3n9/dsh web
```

## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @x1a0f3n9/dsh web
```

For repeated use, install the launcher globally:

```sh
npm install --global @x1a0f3n9/dsh
xfdsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
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
