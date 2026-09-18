# Agent Note: 把 xfdsh 预置插件从插件列表拆出去

Status: implemented

[English](2026-09-14-xfdsh-preset-plugins-tab.md) | 中文

## Problem

插件列表标签页把 profile 预置的 xfdsh 功能和会话/全局 Loader 清单放在同一页，分组标题还是「可选插件」。用户要这些卡片出现在名叫 xfdsh预置插件 的独立界面里。

## Decision

再注册一个 `settings.plugins.tab`（`xfdsh-presets`）。这个标签页渲染目录卡片（标题、可点包名、描述、启用开关）。插件列表只保留会话和全局行，并去掉目录里的包，包括嵌套 Loader id。目录为空时隐藏这一组，而不是渲染空的「可选插件」块。

## Alternatives considered

**继续放在插件列表里，只改分组标题。** 否决：用户要的是新的类似 UI，不是同一页再加一个标题。

**只按包名过滤。** 否决：嵌套 include 树会给 Loader id 加前缀，所以清单还要匹配 `entryId` 和 `parent:entryId`。

## Consequences

- Settings → Plugins 显示插件配置、插件列表和 xfdsh预置插件。
- Timeline、市场、思考强度、dsh-context、better-sidebar、Hindsight、故障转移队列、技能管理和 web-search-pool 都在新标签页开关。
