# Agent Note：会话与工作区回退作为 fork 原生可选插件

Status: implemented

[English](2026-09-04-session-rewind.md) | 中文

## 问题

fork 用户需要一个比创建 session fork 更快的方式，以便重试不满意的回答或编辑。该功能必须保留仅追加的会话记录，不能声称可以恢复所有文件系统变化，并且要像 dsh 其它功能一样通过 Host/Client 插件 seam 加载。

## 决策

在 `packages/session/session-rewind` 中加入双端插件 `@x1a0f3n9/dsh-rewind`。Host 端从持久事件日志生成回退计划，追加 surface 替换标记，在执行前取消正在运行的回合，并在用户选择工作区模式时恢复持久化的编辑前文件检查点。Client 端通过类型化的用户消息操作 slot 提供本地化的 `/rewind`、`/undo` 命令流程。

Web bundle 预置该插件，但设置 `defaultEnabled: false`；「设置 → 插件」可以启用同一个 `session-rewind` Loader 条目。不包含该 bundle 的 profile 可以通过 `xfdsh plugin --profile <name> add @x1a0f3n9/dsh-rewind` 安装。开发 scope 使用 `@x1a0f3n9`；稳定传播时会改为 `@xfcodeai`，不会维护两份实现或别名。

检查点由插件拥有，使用原子发布，每个会话最多保留最新 100 组锚点，并在恢复前根据当前文件元数据重新核对。追踪范围包含受支持的 `write`、`edit` 与会修改文件的 `str_replace_editor` 调用。不承诺恢复任意 shell 命令、subagent 自己的编辑或未知外部变化。真正的会话删除仍由 session controller 负责。

## 曾考虑的替代方案

**原样使用第三方回退包。** 不采用：它的包身份、profile 元数据和 UI 依赖面向另一条发行线。fork 需要遵循当前 scope、类型化 slot、本地化归属和 bundle 目录规则的包。

**每次重试都创建 fork。** 不采用：这更慢，并且用户只是想修改消息或恢复已追踪文件时会产生额外会话。

**改写或截断会话日志。** 不采用：日志是审计记录，其它投影可能依赖它的追加序列。回退改用显式标记改变 active surface。

**承诺完整恢复工作区。** 不采用：在当前支持的工具 seam 上无法观测 shell、subagent 与未知外部编辑。UI 展示已知影响，并在检测到外部变化时报告冲突，而不是静默覆盖。

## 后果

该功能随 Web profile 交付但默认关闭，也可以通过标准 profile 插件安装。对话回退不依赖检查点文件；删除检查点文件只会取消文件恢复。仅追加日志仍保留撤回事件，因此诊断可以说明发生过什么回退。实现提供清晰的扩展 seam，但不会替代会话删除，也不会增加撤销栈。
