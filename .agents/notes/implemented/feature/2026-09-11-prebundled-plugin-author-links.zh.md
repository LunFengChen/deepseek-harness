# Agent Note: 预装插件作者 GitHub 链接

Status: implemented

[English](2026-09-11-prebundled-plugin-author-links.md) | 中文

## Problem

Web 可选插件目录以前只显示标题和包名。带 scope 的包看起来像有作者，不带 scope 的像没有作者。这些名字也都不能点。

## Decision

目录条目可以声明 `author` 和 `homepage`。`homepage` 必须是不带凭据的 `https://github.com/...` URL。可选插件卡片不再单独显示作者行；声明了 `homepage` 时，包名就是 GitHub 链接。见[去掉目录作者行](2026-09-17-omit-catalog-author-byline.zh.md)。

## Verification

`pnpm exec vitest run packages/boot/app-boot/tests/profile.spec.ts packages/host/plugin-inventory/tests/inventory.spec.ts packages/client/ui-settings-plugin-inventory/tests/components.client.spec.tsx` 覆盖解析拒绝、Host 投影和包名上的 GitHub 链接。

## Alternatives considered

**启动时从每个插件的 npm `package.json` 读作者。** 否决：不少预装插件没有 `author`，而且目录已经负责标题和描述。

**在 dshmarket 卡片里做同一套署名。** 这次不做：那块 UI 属于 dshmarket，作者来自它自己的市场目录。

## Consequences

- Settings → Plugins → 可选插件在目录声明了 `homepage` 时，把包名链到该地址。
- 非 GitHub 的 homepage 会让 profile 加载失败，而不会变成应用内链接。
