# Agent Note: 目录列举用有界并发探测子项

Status: implemented

[English](2026-09-16-listdir-bounded-concurrency.md) | 中文

## Problem

`fs-local` 的 `listDirectory` 对每个子项串行 `realpath` 再 `stat`。子项上百的目录——Host 文件侧栏、对文件夹的 `view`、经 `ctx.fs` 的插件资源管理器——每个名字等两次系统调用。打开 `node_modules` 或单体仓库的 `packages/` 会卡住 Host，后续 RPC（包括侧栏任务面板）跟着饿死。

## Decision

非符号链接子项沿用已列举父目录已经 `realpath` 过的 `targetKey`，只再 `stat`。符号链接子项仍走 `realpath`，这样经父符号链接捕获的列举在链接改指后仍保持当时身份。子项探测每次最多 32 个并发，按稳定名字顺序返回。任一子项出错仍使整次列举失败。

## Verification

`pnpm exec vitest run packages/fs/fs-local/tests/fsio.spec.ts packages/fs/fs-local/tests/filesystem.spec.ts -t 'listDir|listDirectory'`

## Alternatives considered

**继续串行 realpath+stat。** 否决：200 个子项就是四百次串行系统调用；卡住就是缺陷。

**跳过文件 `stat`，只信 `Dirent` 类型。** 否决：列举调用方仍要文件大小和 version，测试也钉死这些字段。

**对每个子项无界 `Promise.all`。** 否决：上万子项的目录会同时打开成千上万次 stat，触发 `EMFILE`。

## Consequences

- 普通文件的列举是每个名字一次 `stat`，而不是先 `realpath` 再 `stat`，并且 32 路重叠。
- 符号链接与身份测试仍走 realpath 路径；父链接改指后的列举仍报告捕获时的身份。
- 中止仍在子项探测之间抛 `FS_ABORTED`；第一次中止检查之后，飞行中的探测可能还会完成。
