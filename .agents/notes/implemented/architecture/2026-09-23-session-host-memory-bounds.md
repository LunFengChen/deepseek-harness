# Agent Note: Session host memory bounds

Status: implemented

English | [中文](2026-09-23-session-host-memory-bounds.zh.md)

## Problem

A live Session still holds its complete event log. Opening several large stored Sessions in `xfdsh web` therefore retained several full object graphs plus the compressed files used to build them. One 121 MB `session.jsonl.zstd` is ~341 MB of UTF-8 and ~397k JSONL lines; V8 then keeps UTF-16 strings and objects. After a couple of hours the default ~4 GB old-space aborts.

[Session history opens from a log suffix](2026-09-11-session-history-suffix-page.md) already pages the last ~50 messages without restoring a Session or activating an Agent. Resume, compaction, and observation still full-read. The suffix path still slurped the complete artifact into one Buffer. `ApiSessionAgentController` discarded `AgentHandle`, so idle Agents never left.

## Decision

API Session keeps every `AgentHandle` it creates or resumes. Before observing or resuming Session B it awaits dispose of idle ordinary roots only when more than five recently used ordinary roots would stay mounted. The five-slot cache is LRU: switching among five Sessions remounts nothing; a sixth Session drops the least-recent idle root. Running Agents, in-flight create/resume work, subagent-owned identities, and Agents owned by B stay. The controller fiber disposes leftover handles on unload.

The prepared-observation cache keeps its existing LRU of five cuts, including large Sessions. That reuse is left in place.

`SessionPersistence.readHistorySuffix` opens the generation file and scans Zstandard frame boundaries through a sliding window. It decompresses only the header frame and the newest event frames that cover one page. Uncompressed logs walk complete JSONL lines from the end. The Buffer decoder remains for unit tests.

After persistence stores the constructor seed, `Session.releaseLiveWindow()` keeps `this.log` as a contiguous tail of at most `SESSION_LIVE_WINDOW_EVENTS` events, cut at `turn/start`. Surface nodes, `request/header`, `request/context`, and `turn/start` that leave the tail stay in `prefixHot`. `snapshotEvents` returns only the tail. Write-open resume streams current-generation events through `adoptEvent` into `Session.adoptRestoredEvent`, which compacts that window as it goes, instead of `sessions.prepare` copying a full seed. Projection units and the token meter ingest each restored event during that stream so they do not rebuild from the live tail. `ctx.sessions.fork` throws `INVALID_BOUNDARY` when that tail is not a complete `0..boundary` prefix. The Remote API fork and windowed `deleteFrom` reread the persisted prefix. History UI pages the file suffix; Trajectory virtualizes the tail. They do not punch holes in the live array.

## Alternatives considered

**Raise `--max-old-space-size`.** Rejected: the process still grows without bound as the user opens more large Sessions.

**Refuse to resume huge Sessions.** Rejected: those logs are the working set; the host should drop idle copies, not the active one.

**Evict huge cuts from the five-slot prepared cache.** Rejected: the five-slot reuse is useful; idle Agents and suffix slurps were the first costs to drop.

**Evict from `AgentRegistry` itself.** Rejected: the handle owner is API Session; the registry cannot know which idle root the web host still needs.

**Keep older events in process as UTF-8 JSON.** Rejected: that densifies the live log instead of windowing the read/render path, and it is not a Session format.

**Punch holes in `this.log` (`this.log[seq] = undefined`).** Rejected: `ctx.sessions.fork` and tool-time subagent seed need a contiguous prefix. A sparse snapshot is not a valid seed.

**Page `this.log` from disk on every historical `eventAt`, and seed fork from the persisted prefix.** Implemented as a live tail plus `prefixHot`, not a disk read per seq. Historical `eventAt` is undefined unless the event is in the tail or `prefixHot`. Remote API fork reads the persisted prefix; in-process `ctx.sessions.fork` refuses an incomplete live snapshot.

## Consequences

- Switching among five recently used Sessions keeps those Agents mounted. A sixth idle Session can drop the least-recent Agent; the next click resumes from disk.
- History suffix reads from a file descriptor and decompresses only the header plus the tail page.
- The currently open Session retains a fixed tail plus `prefixHot`, not the complete event graph. Resume streams each current-generation event into that window. It still scans every frame and line once (CPU, one compressed file, one plaintext frame, and the window). Migrating or old-generation write opens still materialize the full log.
- `ctx.sessions.fork` of a windowed source throws when the live snapshot is not a `0..boundary` prefix. API `fork` reads disk.

## Related

[Session history opens from a log suffix](2026-09-11-session-history-suffix-page.md) still owns the page contract and the view-versus-resume split.

[A session's agent is composed from a preset cordis.yml](2026-08-03-per-session-agent-presets.md) still owns preset composition; idle-root eviction now lives on API Session.

[Deprecate synchronous reads of arbitrary Session events](2026-09-09-deprecate-synchronous-session-event-reads.md) still owns the storage direction to stop keeping the complete sequence in memory.

[Windowed restore folds projections during ingest](../bug-fix/2026-09-28-windowed-restore-projection-fold.md) owns the restore-time ingest that keeps projection and token-meter folds correct after the tail window drops.
