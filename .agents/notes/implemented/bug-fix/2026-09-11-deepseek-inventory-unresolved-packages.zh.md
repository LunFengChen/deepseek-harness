# Agent Note: Official DeepSeek requests omit unresolvable plugin packages

Status: implemented

[English](2026-09-11-deepseek-inventory-unresolved-packages.md) | 中文

## Problem

选官方 DeepSeek provider 会在发 HTTP 之前跑 request-extension。`dsh_plugin_packages` 遇到活跃 Loader 项是裸包、但宿主搜索路径上没有 `package.json` 时会直接抛错。GitHub 预装插件经常只在 web-app 包下面，不在 CLI 的搜索路径上，所以朋友只是切到 DeepSeek 就会看到 `DeepSeek request extension preparation failed`，会话彻底不能用。Pi-ai 路由不会跑这个 extension，所以别的模型还正常。

## Decision

`plugin-package-inventory-deepseek` 对解析不到的裸包直接省略，处理和松散模块一样。已经找到的 manifest 如果 `name`/`version` 格式坏了，准备阶段仍然失败。adapter 的 `REQUEST_EXTENSION` 消息会带上内部错误，聊天回合能看见真正原因，而不只是外层包装。

## Alternatives considered

**继续对解析不到的包抛错。** 否决：这份清单只是提供方诊断元数据。已经 import 成功的插件只是 `createRequire` 看不见，不应该让官方 DeepSeek 整轮停摆。

**在 fork profile 里关掉 `dsh_plugin_packages`。** 否决：这会让所有官方请求都丢掉这个字段，包括包能正常解析的部署。

**把社区插件的 import 改写到 fork 命名空间。** 否决：插件自己的包名解析，和 `@x1a0f3n9/dsh-*` remap 不是一回事。

## Consequences

- GitHub 或嵌套插件不在 Node 搜索路径上时，官方 DeepSeek 聊天仍能继续。
- 清单不完整也比硬失败一整轮更好。
- 找到的 manifest 身份字段坏了，请求仍然会被拒绝。
