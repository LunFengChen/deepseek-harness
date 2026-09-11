# Agent Note: xfdsh defaults Hindsight to a local daemon

Status: implemented

English | [中文](2026-09-12-hindsight-local-daemon-default.zh.md)

## Problem

The Hindsight coding-agent plugin's built-in `serverMode` is `cloud`. Enabling the preinstalled row without `~/.hindsight/coding-agent.json` therefore talks to `https://api.hindsight.vectorize.io` and asks for an API token. The plugin already supports `daemon` mode: it starts `hindsight-embed` on `127.0.0.1:9077` when `uv` and an extraction LLM are present, and degrades to no memory when they are not. xfdsh was presenting Cloud as if it were required.

## Decision

`applyForkDefaults` sets `HINDSIGHT_SERVER_MODE=daemon` when the variable is unset or blank. xfdsh does not write `~/.hindsight/coding-agent.json`, does not vendor Hindsight, and does not start a daemon of its own. An explicit env value still wins. A `serverMode` in the Hindsight config file still wins over env. The on/off default is owned by [xfdsh enables Hindsight by default](2026-09-12-hindsight-enabled-by-default.md).

## Alternatives considered

**Write `~/.hindsight/coding-agent.json` with `serverMode: daemon` when the file is missing.** Rejected: that file is shared with other Hindsight-using agents; xfdsh should not create it.

**Ship or auto-start a Hindsight server inside xfdsh.** Rejected: that is a separate embed stack, extra process, and first-run download the plugin already owns in daemon mode.

**Fork `vectorize-io/hindsight` to change the built-in default.** Rejected: the monorepo is far larger than this integration; the coding-agent package already honors `HINDSIGHT_SERVER_MODE`.

## Consequences

- Loading Hindsight no longer requires a Cloud account.
- Local recall still needs `uv` on PATH and an extraction LLM (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `HINDSIGHT_API_LLM_PROVIDER`, or the Claude Code CLI). Missing those logs a warning and leaves the turn memoryless.
- A user who already chose Cloud or self-hosted in env or `coding-agent.json` is unchanged.
