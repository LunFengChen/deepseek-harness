---
description: "面向持久 dsh 会话的对话与工作区回退，提供持久文件检查点和明确的恢复确认。"
kind: "package-reference"
---

# @x1a0f3n9/dsh-rewind

[English](README.md) | 中文

## 概述

`@x1a0f3n9/dsh-rewind` 是一个供持久 dsh 会话使用的可选 Web 插件。它把模型可见的对话回退到选中的人工消息，并可以从持久化的编辑前检查点恢复工作区文件。回退会追加可审计的 surface 标记，不会改写或删除会话日志。这与真正的会话删除命令相互独立；后者会删除选中的会话及其后续历史。

该插件随 fork 的 Web profile 预置，但默认关闭。用户可以在「设置 → 插件」中启用；没有包含 Web bundle 的 profile 也可以按 profile 插件方式安装。

## 目录

- [使用本包](#use-this-package)
- [配置](#configuration)
- [存储与安全](#storage-and-safety)
- [理解实现](#understand-the-implementation)
- [模型体验](#model-experience)
- [已知限制与后续工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

### 启用 Web 预置功能

启动 fork Web profile，打开「设置 → 插件」，启用「工作区回退」。该功能已经随 Web bundle 安装，但默认选择加入，避免部署无意中增加额外 UI 和检查点写入。

### 安装到其它 profile

```sh
xfdsh plugin --profile web add @x1a0f3n9/dsh-rewind
```

本包导出了 `dsh.bundle` patch，因此 profile 安装器可以通过标准插件机制挂载它。稳定的 `master` 线会用 `@xfcodeai/dsh-rewind` 发布相同源代码；开发线使用 `@x1a0f3n9/dsh-rewind`。仓库中的目录是 fork 仓库里的 `packages/session/session-rewind`。

### 回退对话

1. 打开一条用户消息，点击它操作行中的 **↶**。
2. 选择「仅对话」或「对话和工作区」。
3. 选择后者时，查看文件影响清单并确认工作区恢复。
4. 选中的消息及其后续内容会从模型可见 surface 中撤回，选中的用户文本会回填编辑器，便于修改后重新发送。

`/rewind` 与 `/undo` 命令提供相同流程，适合键盘操作。回退会先取消正在运行的回合，并按会话串行化并发请求。

-----

<a id="configuration"></a>
## 配置

Host 插件接受以下可选字段：

| 字段 | 含义 | 默认值 |
|---|---|---|
| `snapshotDir` | 文件检查点的精确目录 | `$DSH_REWIND_SNAPSHOT_DIR` 或 dsh home 下的检查点目录 |
| `dshHome` | 用于推导默认存储路径的 Harness home | `DSH_HOME` 或 `~/.dsh` |
| `dedup` | 去重相同的编辑前内容 | `true` |

Web profile 还提供「检查点清理」设置卡片。自动清理默认关闭；启用后会删除超过不活跃天数阈值的会话检查点，但不会删除会话日志。

-----

<a id="storage-and-safety"></a>
## 存储与安全

文件检查点存储在 `<dsh home>/rewind-snapshots/` 下，每个会话最多保留最新 100 组锚点。写入通过临时文件和原子发布完成。恢复前会检查当前文件状态；如果文件被外部修改，插件会报告冲突，而不是静默覆盖。

插件追踪受支持的写类工具调用（`write`、`edit` 与会修改文件的 `str_replace_editor` 操作）。它不承诺捕获任意 shell 命令、子 agent 自己进行的编辑或未知的外部变化。因此不能保证恢复每一个工作区文件。确认工作区恢复前应先查看影响清单。

-----

<a id="understand-the-implementation"></a>
## 理解实现

Host 端监听命令和工具 seam。它从会话事件日志生成纯回退计划，追加 surface 替换标记，并在会话空闲后恢复已记录检查点的文件。Client 端注册本地化命令装饰和类型化的会话操作 slot，不直接修改聊天 DOM。

检查点数据由本插件拥有，并独立于会话持久化。仅追加日志仍是审计记录，surface 投影则让撤回事件不再进入后续模型请求和 Web transcript。真正删除仍由 session controller 负责，回退插件不会实现真正删除。

-----

<a id="model-experience"></a>
## 模型体验

### 回退后的延续

#### What the model sees

回退后，下一次 agent 请求会从选中的人工消息开始，根据新的 `surfaceOp` 标记重建。被撤回的消息及其后续工具活动不会进入 active surface，但追加式日志仍可供持久化和诊断使用。

#### Token effect

回退后的第一次请求可能因为省略被撤回历史而减少输入 token。插件自身不会增加提示词指令或工具 schema；实际减少量取决于选中的目标和 provider 请求。

#### KV Cache effect

回退会从选中目标处改变请求前缀，因此第一个变化 token 之后的 provider 缓存复用取决于 provider，且可能降低。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与后续工作

- 工作区恢复只覆盖受支持的写类工具调用和已追踪路径；shell、subagent 与无法识别的编辑不在捕获保证内。
- 回退不是可无限展开的撤销栈。仅追加标记可以审计，但再次回退不会自动恢复之前撤回的 surface。
- 删除检查点文件会使相关文件无法恢复，但不影响对话回退。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

本包在开发分支遵循 fork 的包 scope。重命名为 `@xfcodeai/dsh-rewind` 属于稳定版本传播，不会再实现第二份代码或兼容别名。

</details>
