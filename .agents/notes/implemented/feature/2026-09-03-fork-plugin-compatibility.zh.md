# Agent Note：共用 profile 与 fork 插件兼容性

状态：已实现

[English](2026-09-03-fork-plugin-compatibility.md) | 中文

## 问题

fork 发布了自己的 `@x1a0f3n9/dsh-*` 包命名空间，但 profile 目录和会话历史仍通过 `$DSH_HOME` 共用。因此，`xfdsh` 安装的插件必须出现在同一个 profile 中，同时不能让只支持上游的插件直到启动时才暴露问题。

## 决策

`xfdsh plugin --profile <name> ...` 继续使用共用的 `$DSH_HOME/profiles/<name>` 目录。profile loader 接受 fork 包，以及运行时、peer 和 optional 依赖没有使用旧 `@deepseek-ai/dsh-*` 产品命名空间的外部 Cordis 组合包。对于声明上游产品包的已列出组合包，loader 会拒绝加载，并报告不兼容的包名以及可用的 fork 迁移选择。

兼容性检查不会拒绝 Cordis 等上游命名空间的 vendor 包，不会重写 npm 包名，也不会为未声明依赖却直接导入上游私有模块的插件提供兼容承诺。由官方 `@deepseek-ai` 命名空间或之前 fork 命名空间创建的、与随附模板完全一致的 profile，会被改写为当前的 `@xfcodeai` 内置包名；用户添加过其他 bundle 的列表保持不变。fork 原生插件必须针对 `@x1a0f3n9/dsh-*` 发布；通用组合包应依赖稳定的 Cordis 或其他公开接口。

## 备选方案

**使用独立的 `~/.xfdsh` home。** 这会隔离插件，但也会拆分用户的 profile 和历史记录，不符合共用历史记录的要求。

**静默把 `@deepseek-ai/dsh-*` 别名到 `@x1a0f3n9/dsh-*`。** npm 别名可能复制 peer 和单例依赖，也无法保证私有模块导入兼容，因此 fork 选择给出明确错误，而不是制造一个部分可用的运行时。

## 后果

当两个启动器使用同一个 `$DSH_HOME` 时，任一启动器安装的插件都会记录到相同的 profile。上游产品插件需要 fork 原生版本，或者使用官方 `dsh` 安装；只要声明的运行时依赖避开旧产品命名空间，便携的 Cordis 组合包仍可继续使用。包含不兼容组合包的已有 profile 会以可操作的错误停止，直到替换或移除该依赖。
