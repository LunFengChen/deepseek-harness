# Agent Note: 开发分支 npm scope

Status: implemented

## Problem

fork 需要一条可以独立安装的开发包线，而稳定 fork 使用另一套 npm scope。如果两套包名混在同一个工作区中，workspace 链接、profile 组合包、release 校验和 TypeScript 路径就会不一致。

## Decision

开发分支的全部 harness workspace 包统一发布为 `@x1a0f3n9/dsh-*`，CLI 包为 `@x1a0f3n9/dsh`。可执行命令仍然叫 `xfdsh`，因此命令名可以与上游 `dsh` 区分。官方 `@deepseek-ai/dsh-*` 插件依赖仍然通过已有的兼容映射，指向对应的开发包；Cordis vendor 包和 native 包的 scope 不变。

稳定 fork scope 是另一条分支的职责：它使用同一套代码组织，但包名为 `@xfcodeai/dsh-*`，并且必须独立发布。两套 scope 不会在同一个 workspace 中同时安装。

## Alternatives considered

**继续使用上游的 `@deepseek-ai/dsh-*`：** 这会让开发分支与上游包冲突，也不能提供可独立安装的 fork。

**开发包也发布到稳定的 `@xfcodeai` scope：** 这会把未发布的开发产物混入稳定包线，使 CI 发布目标不明确。

**在同一个 workspace 中同时使用两套 fork scope：** 这会产生重复的包身份，并可能加载两份运行时 registry，因此不采用。

## Consequences

- 开发分支的 package manifest、导入路径、workspace 路径、profile 默认值、lockfile、release 校验和文档统一使用 `@x1a0f3n9`。
- `npm install --global @x1a0f3n9/dsh` 会安装 `xfdsh` 启动器；一次性运行可使用 `npx --package @x1a0f3n9/dsh xfdsh web`。
- 稳定的 `@xfcodeai` 包线仍需要单独的 scope 重命名分支和 release 发布，完成后才能面向用户。
- 官方插件仍通过显式 alias 兼容；对应 fork 包不可用时会在安装阶段失败，不会静默加载两套运行时。
