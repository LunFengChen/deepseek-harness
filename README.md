# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

Fork note: this branch publishes `@xfcodeai/dsh` and the `xfdsh` launcher so it can coexist with upstream `dsh`. The table below summarizes the main fork changes.

## Fork summary

| Area | What changed | Result |
| --- | --- | --- |
| Publish identity | Packages stay under `@xfcodeai/dsh` / `@xfcodeai/dsh-*`, and the published executable is `xfdsh`. | The fork can be installed and run beside upstream `dsh`. |
| Session history | The web UI can delete a turn and every later event in the same session, with destructive confirmation, instead of only forking away. | Unwanted answers can be removed without creating a new branch of history. |
| Session utilities | Workspace rows include a copy-session-id action. | Session ids are easier to share and debug. |
| Long-run stability | Context overflow now compacts instead of stalling; handshake failures resume; goal rounds can continue past the old hard stop. | Long tasks are less likely to stop mid-run. |
| Model and attachment compatibility | Commands that do not accept images reject them with a toast; model incompatibility is reported as a clear `session/model-unavailable` error. | Mixed model/image workflows fail fast instead of silently breaking. |
| Sandbox and replay | Stale full-access escalation targets are ignored; pi-ai replay metadata and wrapped responses are handled more safely; transient `PI_AI_ERROR` is retried. | Fewer false failures and less replay drift. |
| Release readiness | Release verification, pack layout, docs, and entrypoint checks were updated for the fork. | The fork can be published and installed as its own package line. |

### Install this fork

```sh
npm install --global @xfcodeai/dsh
xfdsh web
```

For one-off use:

```sh
npx @xfcodeai/dsh web
```

## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @xfcodeai/dsh web
```

For repeated use, install the launcher globally:

```sh
npm install --global @xfcodeai/dsh
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
