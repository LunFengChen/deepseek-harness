# DeepSeek Harness

[English](README.md) | 中文

DeepSeek Harness（`dsh`）是由 [DeepSeek AI](https://deepseek.com) 开发的开源 agent harness（智能体框架）。

它构建于**一切皆插件**的架构之上，由 [Cordis](https://github.com/cordiverse/cordis) 驱动，其设计参见论文 [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512)。

文档：[https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

分支说明：这个 fork 发布的是 `@x1a0f3n9/dsh` 和 `xfdsh` 启动器，可以和上游 `dsh` 并存。下面表格概览这个 fork 相对上游的主要改动。

## Fork 概览

下面的表格只汇总这个 fork 的用户可见和发布相关改动；合并上游的提交只负责集成，不单独展开。

| 领域 | 改动 | 结果 |
| --- | --- | --- |
| 包命名空间 | 工作区包从 `@deepseek-ai/dsh-*` 改为 `@x1a0f3n9/dsh-*`；vendor 和 native 包保留上游命名空间。 | fork 拥有自己的发布包线。 |
| 启动器与发布 | 发布出来的可执行命令是 `xfdsh`；release 校验、pack 布局和入口检查都已跟着调整。 | fork 可以和上游 `dsh` 并装并用，不会冲突。 |
| 会话历史 | Web UI 可以对当前会话做“真删除”：删掉某个问题/回答以及后面的所有历史，并且有双重确认。session controller 会把删除请求下发给持久化层，JSONL 后端会重写落盘日志，projection cache 也同步升级了版本。 | 不满意的回答可以直接从会话里和磁盘里一起移除。 |
| 会话工具 | 工作区列表里增加了复制 session id。 | 方便分享、排障和定位会话。 |
| 内存与续跑 | 会话持久化现在限制内存中的读取规模；context overflow 会触发压缩；握手失败可以恢复；goal 轮次不再被旧的硬上限卡死；compaction 的默认重试次数也调高了。 | 长会话和长任务更不容易卡住或被过早终止。 |
| LLM 与回放 | `PI_AI_ERROR` 会走默认重试；finish_reason 截断被归为不可重试；包装后的回放状态和外来 replay metadata 都能正确处理；还补了 provider-scoped 环境真的到达 wire request 的测试。 | 更少误报、更少回放不一致，重试行为也更清楚。 |
| 模型与图片兼容 | 不支持图片的命令会继续执行文本并保留图片草稿；纯文本模型路由会在分发前把历史图片和新图片投影为稳定文本占位符。 | 切换到纯文本模型不会让已有图片的会话停摆。 |
| sandbox 与权限 | 会忽略过期的 full-access escalation target。 | 旧的权限状态不会再走错升级路径。 |
| 文档与示例 | README、CLI help、发布说明和 session-controller 的 API 文档都同步到了 fork 的行为。 | 文档和实际行为保持一致。 |

### 安装这个 fork

```sh
npm install --global @x1a0f3n9/dsh
xfdsh web
```

一次性运行：

```sh
npx @x1a0f3n9/dsh web
```

## 开发者预览

DeepSeek Harness 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

运行本项目前，请阅读[安全说明](SAFETY.zh.md)。

<a id="run"></a>

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx @x1a0f3n9/dsh web
```

如需重复使用，可全局安装启动器：

```sh
npm install --global @x1a0f3n9/dsh
xfdsh web
```

该命令默认会在 `http://127.0.0.1:3080` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

<a id="run-from-source"></a>

### 从源码运行

如需从仓库源码运行：

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` 会准备仓库产物。`pnpm dsh web` 会直接使用这些已构建产物，不会重新构建。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions) 提交反馈或 bug 报告。
- 为你的插件仓库添加 [`dsh-plugin`](https://github.com/topics/dsh-plugin) 话题，便于被发现。
- 欢迎加入 DeepSeek Harness 企微群：扫码添加企微小助手并填写入群问卷，完成后小助手会邀请你入群。

<table>
  <thead>
    <tr>
      <th align="center">企微小助手</th>
      <th align="center">入群问卷</th>
      <th align="center">微信公众号</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-assistant.png" alt="DeepSeek Harness 企微小助手二维码" width="180" height="180"></td>
      <td align="center"><a href="https://trtgsjkv6r.feishu.cn/share/base/form/shrcnIt5twSVdLGD52KJBckGCgg"><img src="https://cdn.deepseek.com/harness/readme/community-wecom-survey.png" alt="DeepSeek Harness 入群问卷二维码" width="180" height="180"></a></td>
      <td align="center"><img src="https://cdn.deepseek.com/harness/readme/community-wechat-official-account.png" alt="DeepSeek Harness 团队微信公众号二维码" width="180" height="180"></td>
    </tr>
  </tbody>
</table>

## 参与贡献

参见 [CONTRIBUTING.md](CONTRIBUTING.zh.md)。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
