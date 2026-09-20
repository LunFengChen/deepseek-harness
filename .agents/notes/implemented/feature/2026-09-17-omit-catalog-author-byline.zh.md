# Agent Note: 去掉可选插件作者行

Status: implemented

[English](2026-09-17-omit-catalog-author-byline.md) | 中文

## Problem

可选插件卡片在 `@scope/name` 下面再画一行目录 `author`。fork pin 上那一行会在 `@x1a0f3n9/dsh-session-timeline` 旁边再写 `LunFengChen`，所有者写了两遍，多出来的那一行像第二个身份。

## Decision

可选插件卡片不渲染 `author`。带 scope 的包名已经标明所有者。目录声明了 `homepage` 时，包名就是新标签页的 GitHub 链接。目录里的 `author` 和 `homepage` 仍留在 bundle 清单里，供解析检查和 Host 投影使用。相关：[预装插件作者 GitHub 链接](2026-09-11-prebundled-plugin-author-links.zh.md)。

## Alternatives considered

**只给不带 scope 的包保留作者行。** 否决：多出来的那一行仍是第二个身份，而且这些卡片已经有标题和包名。

**从目录 schema 里删掉 `author`。** 这次不做：profile 加载仍会校验这个字段，Host 快照可以带着它但不画出来。

## Consequences

- Settings → Plugins 显示标题、包名、版本和描述，不再把 `LunFengChen` 画成署名。
- 点击包名仍会打开 GitHub pin。
