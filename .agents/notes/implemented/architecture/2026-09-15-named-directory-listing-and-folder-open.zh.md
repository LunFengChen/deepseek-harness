# Agent Note: 具名目录列举与文件夹打开遵循文件读取权限

Status: implemented

[English](2026-09-15-named-directory-listing-and-folder-open.md) | 中文

## Problem

Web GUI 可以预览 Session 工作区外的具名文件，但把同类路径当文件夹打开会失败。`workspaceFiles.list` 拒绝工作区根外的任何目录，文件夹提及不调用 `openReference`，预装的 better-sidebar 插件还用自己的 `workspaceFence` 限制读取——这是叠在 DSH 沙箱模式之上的第二套策略，只能靠设置开关绕过。

## Decision

具名目录列举是一次读取。`workspaceFiles.list` 与文件读取一样继承 Session 文件系统后端的读取权限：工作区根是相对路径的基准，不是列举边界。被列举目录在根内时 `path` 为工作区相对路径，否则为文件系统绝对路径。`changes` 仍限于工作区。

文件夹提及和 `openFile(path, { directory: true })` 打开同一 `dsh-resource://file/…` 地址，并带上 `WorkspaceFileParams.directory`。能显示文件夹窗口（以该目录为根的树）的查看器会这样做，而不是把路径当普通文件读。聊天用户文本中的 `@dir/` 芯片走这条打开路径。

预装 better-sidebar 插件遵循这些 DSH 模式，而不再另设读取围栏：具名读取、列举和 media/HTML 不加围栏；写入仍限于工作区，除非 Session 沙箱是 `danger-full-access`（没有沙箱服务时，则仅在插件写入偏好关闭时放开）。原生标签参数上的 `directory: true`，或报告目录的 `fs.read`，会变成 `meta.dir`，从而跑已有的文件夹窗口。钉选为 `github:LunFengChen/DSH-better-sidebar#v0.19.0-alpha.1-xfdsh.6`。

这取代[工作区文件读取权限](2026-09-09-workspace-file-read-authority.zh.md)中关于列举包含限制的一半。文件类型检查、大小上限，以及变更流的工作区过滤不变。

## Alternatives considered

**列举仍限于工作区，只解除插件围栏。** 内置文件树和其他 `workspaceFiles.list` 调用方仍会拒绝同一 Session 已经能 `read` 的具名根外目录。

**让用户关掉「工作区路径检测」。** 这会让插件偏好成为读取权限。DSH 已有 `read-only`、`workspace-write` 和 `danger-full-access`；这些模式下读取都不加围栏。

**为文件夹新增一种 Sidebar 标签类型。** 预装编辑器在设置 `meta.dir` 时已经渲染文件夹窗口；再加一种类型会重复。

**由 DSH 打开方传递插件私有的 `meta.dir`。** `file` 地址的导航参数是 `WorkspaceFileParams`。`directory` 是 DSH 字段；插件负责映射。

## Consequences

持有有效 Session 文件地址的调用方可以列举 Session 文件系统后端允许读取的每个目录，包括工作区外目录。已发送用户文本中的文件夹芯片会打开一棵树。内置文件页仍以会话工作目录为根。在 `workspace-write` 和 `read-only` 下，侧栏写入仍限于工作区。工作区外目录不会产生 `changes` 帧。
