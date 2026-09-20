# Agent Note: plugin inventory matches nested Loader ids

Status: implemented

[English](2026-09-10-plugin-inventory-nested-entry-id.md) | 中文

## Problem

设置 → 插件 把预装插件显示成关闭。点开启会 toast「插件状态保存失败，请重试。」目录存的是 yaml 本地 id，例如 `dsh-context`。Include 树会给 `Entry.id` 加前缀，于是精确比较 `entry.id === catalog.entryId` 找不到已挂载的插件。

## Decision

`pluginInventory` 用 `entry.id` 或本地 `entry.options.id` 匹配目录 id。profile override 仍然按目录 id 落盘。设置页展示宿主返回的错误原文，不再只用泛化重试 toast。

## Alternatives considered

**把目录元数据改成嵌套运行时 id。** 否决：profile `pluginOverrides` 和 bundle patch 针对的是 yaml id。

**继续只用泛化客户端 toast。** 否决：宿主已经返回找不到条目的原因；藏起来会让嵌套 id 失配看起来像保存失败。

## Consequences

- 在 include 下启动的预装插件会显示为已安装且已启用。
- 开关会把 `dsh.profile.pluginOverrides` 写到目录 id 下。
