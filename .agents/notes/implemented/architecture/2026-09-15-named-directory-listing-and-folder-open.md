# Agent Note: Named directory listing and folder open follow file-read authority

Status: implemented

English | [中文](2026-09-15-named-directory-listing-and-folder-open.zh.md)

## Problem

The Web GUI could preview a named file outside the Session workspace, but opening the same kind of path as a folder failed. `workspaceFiles.list` refused any directory outside the workspace root, folder mentions did not call `openReference`, and the preinstalled better-sidebar plugin applied its own `workspaceFence` to reads — a second policy above DSH sandbox modes, with a settings switch as the escape.

## Decision

A named directory listing is a read. `workspaceFiles.list` inherits the Session filesystem backend's read authority the same way file reads do: the workspace root is the base for relative paths, not a listing boundary. The listing's `path` is workspace-relative when the directory is inside the root, and the filesystem absolute path when it is not. `changes` stays workspace-scoped.

Folder mentions and `openFile(path, { directory: true })` open the same `dsh-resource://file/…` address with `WorkspaceFileParams.directory`. A viewer that can show a folder window (a tree rooted there) does so instead of reading the path as a regular file. Chat user-text chips for `@dir/` call that open.

The preinstalled better-sidebar plugin follows those DSH modes rather than a separate read fence: named reads, listings, and media/HTML are unfenced; writes stay workspace-scoped unless the Session sandbox is `danger-full-access` (or, without a sandbox service, the plugin's write pref is off). `directory: true` on the native tab params, or an `fs.read` that reports a directory, becomes `meta.dir` so the existing folder window runs. The pin is `github:LunFengChen/DSH-better-sidebar#v0.19.0-alpha.1-xfdsh.6`.

This supersedes the listing-containment half of [workspace file read authority](2026-09-09-workspace-file-read-authority.md). File-kind checks, size caps, and the change feed's workspace filter are unchanged.

## Alternatives considered

**Keep listing workspace-scoped and only disarm the plugin fence.** The builtin files tree and any other `workspaceFiles.list` caller would still refuse a named outside directory the same Session can already `read`.

**Ask the user to turn off “工作区路径检测”.** That makes a plugin pref the read authority. DSH already has `read-only`, `workspace-write`, and `danger-full-access`; reads are not confined under any of them.

**A new Sidebar tab kind for folders.** The preinstalled editor already renders a folder window when `meta.dir` is set; a second kind would duplicate it.

**Pass plugin-private `meta.dir` from DSH openers.** Navigation params for `file` addresses are `WorkspaceFileParams`. `directory` is the DSH field; the plugin maps it.

## Consequences

A caller holding a valid Session file address can list every directory the Session filesystem backend permits, including directories outside the workspace. Folder chips in sent user text open a tree. The builtin files page remains rooted at the session cwd. Writes from the sidebar stay workspace-scoped under `workspace-write` and `read-only`. Outside directories do not produce `changes` frames.
