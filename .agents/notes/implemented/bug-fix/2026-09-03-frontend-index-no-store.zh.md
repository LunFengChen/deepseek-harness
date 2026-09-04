# Agent Note: Web 壳页面不应缓存 index 响应

Status: implemented

[English](2026-09-03-frontend-index-no-store.md) | 中文

## 问题

Web 壳的 index 是按请求生成的，其中包含当前客户端插件图、带版本标识的 bundle URL 和启动注入行。浏览器如果复用旧的 index 缓存，就可能把旧壳和新的 `@xfcodeai` 客户端 bundle 配在一起。此时模块加载器会报告缺少 `@x1a0f3n9/dsh-client-ui-slots` 之类的平台 seed，尽管当前壳实际上提供了它。

## 决策

`dsh-host-frontend-static` 为经过认证的 HTML index 响应发送 `cache-control: no-store`。静态资源保持现有响应策略，因为它们的 Vite 文件名和插件版本查询参数提供了缓存身份。这样在重新构建、切换 profile 或更新插件后，每次导航都会取得新生成的启动图。

## Alternatives considered

**要求用户在每次构建后手动强制刷新。** 拒绝，因为普通导航仍可能命中旧图，并且把服务端组装事实变成了手动恢复步骤。

**禁止缓存所有静态资源。** 拒绝，因为带哈希的壳资源和带版本查询参数的插件 bundle 可以安全缓存；禁用它们的缓存会增加传输开销，却不能修复动态 index 的配对问题。

**把每个 UI 依赖都打包进每个客户端插件。** 拒绝，因为这会重复 React/UI 单例模块，并绕过壳通过模块表共享的模块身份。

## 后果

普通刷新会获取当前 HTML 图，不会复用旧的 index 响应。带哈希的资源仍可缓存；已经打开的旧标签页仍需刷新一次才能取得 no-store 策略，服务器无法追溯性地替换该标签页已经持有的字节。
