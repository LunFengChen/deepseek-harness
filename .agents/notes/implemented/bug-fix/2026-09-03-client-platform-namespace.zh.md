# Agent Note：fork 客户端使用精确的平台命名空间

状态：已实现

[English](2026-09-03-client-platform-namespace.md) | 中文

## 问题

浏览器页面可能把过期的外壳，与刚提供的 `@xfcodeai/dsh-*` 客户端 bundle 混在一起。这样外壳和 bundle 会使用不同的模块表，renderer 可能 require 一个外壳没有预加载的平台包。

## 决策

客户端模块系统只按精确的 `@xfcodeai/dsh-*` 名称解析平台 seed。动态插件 entry id 仍保持精确的 graph key，不会被重写。前端 HTML 使用 `cache-control: no-store`，让后续导航获取同一代的外壳和启动图。

fork 不在浏览器中为其他产品命名空间提供别名。服务端更新后，旧页面必须刷新；缺少平台 entry 时仍明确报错。profile loader 仍会拒绝声明上游产品运行时依赖的 bundle。

## 考虑过的替代方案

**在加载时把其他客户端包命名空间重写到当前命名空间。** 拒绝，因为动态插件 entry id 与包 factory 是 graph 所有的身份；重写会隐藏不兼容的 bundle，并让卸载与 HMR 记录变得含混。

**从浏览器下载缺失的平台包。** 拒绝，因为平台模块由外壳提供且必须是共享单例；加载第二份副本会拆分 React、store 或 UI slot 状态。

**只让浏览器缓存失效。** 拒绝，因为已经打开的页面在刷新前仍可能保留旧外壳；`no-store` 只保证后续导航，当前页面仍需要显式刷新。

## 后果

服务端更新后，已经打开的页面仍需要刷新一次。重新打开的 `xfdsh web` 页面会使用精确的 `@xfcodeai` 命名空间加载 shell 和 renderer。缺少平台 entry 时仍会明确报错，不会被转换成无关的包下载。
