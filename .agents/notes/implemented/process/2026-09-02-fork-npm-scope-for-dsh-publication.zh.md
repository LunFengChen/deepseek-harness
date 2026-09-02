# Agent Note: Fork npm scope for dsh publication

Status: implemented

[English](2026-09-02-fork-npm-scope-for-dsh-publication.md) | 中文

## Problem

Fork 无法在没有上游组织凭据的情况下，使用上游 `@deepseek-ai` scope 发布第一方 dsh 包。

如果继续使用上游 scope，Fork 的发布说明就会依赖上游 registry 权限，也无法提供独立的面向用户的 npm 安装路径。

## Decision

第一方 dsh 发布族使用 `@xfcodeai` scope：启动器是 `@xfcodeai/dsh`，workspace 根包是 `@xfcodeai/dsh-root`，`packages/*/*` 与 `apps/*` 下的每个可发布包都使用 `@xfcodeai/dsh-*` 或该 scope 下的应用包名。 发布后的启动命令是 `xfdsh`，因此可以和官方 `dsh` 命令共存。

当前源码导入、manifest、lockfile、Cordis 配置、测试、快照、生成目录和当前文档都使用 `@xfcodeai` dsh 名称。这个预发布仓库不为原 dsh 名称保留兼容别名。

Vendored Cordis 框架仍位于 `@deepseek-ai` 下，因为它是有独立上游 rescope 和发布规则的 vendored 发布族。Native Landlock 包也仍位于 `@deepseek-ai` 下，因为它是独立发布族，不属于本次 dsh scope 迁移。

现有发布序列除 dsh scope 外保持不变：先构建 dsh，再校验 dsh 发布族，打包 tarball，验证打包后的安装，最后使用 Fork 的 npm 凭据发布版本。发布族校验器现在分别要求 dsh 成员使用 `@xfcodeai`、vendor 成员使用 `@deepseek-ai`，不再假设所有发布族共用一个 scope。

## Alternatives considered

**继续让 dsh 使用 `@deepseek-ai`。** 否决：Fork 无法在没有上游组织凭据的情况下提供独立安装路径，在不拥有名称的情况下发布也不安全。

**改用非 scoped 包名。** 否决：非 scoped 名称更难统一保留，无法清楚表明 Fork 的所有者，而且首次发布前还要再次进行全仓库改名。

**同时重命名 vendor 和 native 包。** 否决：它们是拥有独立发布流程和上游 vendoring 规则的发布族。合并改名会扩大变更范围，却不能解决 dsh Fork 的名称所有权问题。

**在原 dsh 名称下保留兼容包。** 否决：预发布仓库明确不携带兼容别名，而别名既要求拥有上游 scope，又会保留两套包名词汇。

## Consequences

这个 Fork 的消费方应安装 `@xfcodeai/dsh`，而不是 `@deepseek-ai/dsh`。迁移到这个 Fork 时，使用原 dsh 包名的现有导入必须更新。

当 Fork 维护者拥有并完成认证的 `@xfcodeai` npm scope 后，dsh 包族可以独立发布。除非后续单独决定 scope，vendor 和 native 发布仍需要各自的 `@deepseek-ai` 发布所有权。

历史 archived Agent Notes 保留原始包名，不会被重写；当前 Agent Notes 和当前生成引用描述本仓库实际发布的名称。
