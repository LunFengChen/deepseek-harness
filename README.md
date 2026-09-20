# DeepSeek Harness

English | [中文](README.zh.md)

This repository is **xfdsh**, a fork of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (`dsh`).
The published command is `xfdsh`. Official `dsh` can stay installed.

## Use this fork

Install Node.js, then start the Web UI at `http://127.0.0.1:7777`.

Two install paths. Both launch `xfdsh web`. Sessions, workspace groups, attachments, settings, and API keys stay in `~/.dsh`, so there is no history migration. Plugins and profiles live in `~/.xfdsh`. Disable preinstalled extras from Settings → xfdsh preset plugins.

Read the [safety notice](SAFETY.md) before running.

### npm

```sh
npm install --global @xfcodeai/dsh
xfdsh web
```

The command starts the Web UI at `http://127.0.0.1:7777` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

One-off without a global install:

```sh
npx --package @xfcodeai/dsh xfdsh web
```

A bare `xfdsh` on PATH comes from the global npm install. The development line from `dev-x1a0f3n9` uses `@x1a0f3n9/dsh` in the same commands.

### Source

```sh
git clone -b dev-x1a0f3n9 https://github.com/LunFengChen/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm xfdsh web
```

GitHub's default branch is `dev-x1a0f3n9`, so a clone without `-b` also lands here. Daily launches are `pnpm xfdsh web` and do not rebuild. Rebuild after a fresh clone, after pulling large changes, or when using `pnpm exec xfdsh`. `pnpm exec xfdsh web` uses the built bin and needs a current `lib/`.

## Official dsh

Official DeepSeek Harness is a separate product from [DeepSeek AI](https://deepseek.com).

```sh
npm install --global @deepseek-ai/dsh
dsh web
```

Official `dsh web` listens on `http://127.0.0.1:3080` and uses `~/.dsh` for plugins and profiles. Both CLIs can run at the same time. They share session history and keep plugin installs apart.

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512). Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/).

## What this fork changes

The rows below summarize user-visible and release-impacting fork changes. Merge commits that only integrate upstream are not listed.

Development packages use `@x1a0f3n9/dsh-*`. `master` publishes `@xfcodeai/dsh-*` from the same tree. Vendor and native packages keep `@deepseek-ai/*`.

### Preset plugins

Prebundled extras live on **Settings → xfdsh preset plugins**. Cards show the package version; the package name links to GitHub. Plugin list keeps session/global inventory and omits these packages.

| Plugin | Package | What it does |
| --- | --- | --- |
| Session timeline | `@x1a0f3n9/dsh-session-timeline@0.1.5-xfdsh.2` | Rewind, delete, regenerate, and a composer compact button. |
| Plugin market | `@x1a0f3n9/dshmarket@1.45.2` | Browse community plugins. Official `@deepseek-ai/dsh-*` plugins remap into this runtime. |
| Reasoning effort | `@x1a0f3n9/dsh-reasoning-effort@0.7.3` | Settings → Models lets each custom model choose Default (none) or Custom `reasoningEfforts`. The composer can then pick thinking strength. |
| Context dashboard | `@x1a0f3n9/dsh-context@0.49.7` | A Context tab and `/context` show composition, compaction, and token use. Version detection reads this fork. |
| Better sidebar | `@x1a0f3n9/dsh-better-sidebar@0.19.3` | Files, terminal, Git, and subagents in the sidebar workbench. |
| Hindsight memory | `@x1a0f3n9/hindsight-coding-agents@0.5.2-xfdsh.4` | On by default. Uses a local daemon, not Cloud. Cloud or a self-hosted URL remains optional in `~/.hindsight/coding-agent.json`. |
| Failover queue | `@x1a0f3n9/dsh-failover-queue@0.1.11` | Composer chip plus Settings → Failover for P1/P2/P3. Fails over after `llm-retry`, or immediately on `AUTH` / `RATE_LIMIT` / `NO_ADAPTER`. Recovered P1 is probed and selected again. |
| Skills manager | `@x1a0f3n9/dsh-skills-manager@0.1.53-xfdsh.1` | Load, toggle, create, and import local Agent skills. Settings → Skills appears when the card is on. |
| Web search pool | `@x1a0f3n9/dsh-web-search-pool` | Default order is the search pool, then Perplexity, Exa, and keyless Bing/DuckDuckGo. DeepSeek search remains selectable. Every chat model can `web_search` without a DeepSeek search key. |

### Other changes

| Area | What changed | Result |
| --- | --- | --- |
| Hindsight git stderr | The LunFengChen fork pipes `git` stderr. | Opening a session whose cwd is not a git repository no longer prints `fatal: not a git repository`. |
| Session utilities | Workspace rows can copy the session id. | Session ids are easier to share and debug. |
| Memory and continuation | Session persistence bounds in-memory reads; context overflow triggers compaction and retry. A large-to-small model switch prices pressure against the pending picker before the next request. | Long sessions are less likely to stall. Truncated nonempty summaries still replace the compacted span. |
| Text-only models | Historical and new images become stable text placeholders on text-only routes. | Switching models does not strand a session that already contains images. |
| Multi-answer / session git graph | Not implemented. Follow-up work on `dsh-session-timeline` after the rewind UI is done. | Documented and deferred. |

## Branches

GitHub's default branch is `dev-x1a0f3n9`. Clone without `-b` already lands on the fork line. Do not commit fork features onto `master`.

| Branch | Role | npm |
| --- | --- | --- |
| `master` | Stable fork line. Merge upstream here, then into `dev-x1a0f3n9`. | Push publishes `@xfcodeai/*`. |
| `dev-x1a0f3n9` | Fork integration. Test here, then push. | Push publishes `@x1a0f3n9/*`. |
| `feat/<topic>` or `fix/<topic>` | One small change, cut from `dev-x1a0f3n9`. | None. Merge `--no-ff` into `dev-x1a0f3n9`. |

1. Merge upstream `deepseek-ai/deepseek-harness` into `master`.
2. Merge that `master` into `dev-x1a0f3n9`. Resolve remaining fork-line conflicts there.
3. Cut `feat/<topic>` or `fix/<topic>` from `dev-x1a0f3n9`.
4. Merge `--no-ff` back into `dev-x1a0f3n9`. Do not merge those short-lived branches into `master`.
5. Test `dev-x1a0f3n9` locally with `pnpm xfdsh web`.
6. Push `dev-x1a0f3n9`. CI builds and publishes `@x1a0f3n9/*`.
7. Merge `dev-x1a0f3n9` into `master` and push. CI publishes `@xfcodeai/*`.

An npm new-name quota pause stops a publish run without failing it; the next push continues remaining names.

## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/LunFengChen/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## Citation

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
