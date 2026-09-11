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
| 包命名空间 | 开发线使用 `@x1a0f3n9/dsh-*`。`master` 跟踪上游 `@deepseek-ai/dsh-*`。之后的稳定 fork 线发布 `@xfcodeai/dsh-*`。vendor 和 native 包继续使用 `@deepseek-ai/*`。 | 两条 fork 线和官方 `dsh` 不会抢同一个 npm scope。 |
| 启动器 | 发布出来的命令是 `xfdsh`。官方 `dsh` 仍是上游 CLI。 | 两套产品可以并装。 |
| 数据目录 | `xfdsh` 的插件和 profile 放在 `~/.xfdsh`。官方 `dsh` 的插件和 profile 仍在 `~/.dsh`。会话、分组、附件、settings 和 API key 共用 `~/.dsh`。 | 不用迁移向导就能读到同一份历史。`xfdsh` 不会写 `~/.dsh/profiles`。 |
| Web 端口 | `xfdsh web` 默认监听 `127.0.0.1:7777`。官方 `dsh web` 仍是 `3080`。 | 两套 UI 可以同时开。 |
| Session Timeline | 预装且可关闭：回退、删除、重新生成，以及输入框压缩按钮。删除会截断选中的一轮以及后面的全部事件。压缩会落地思考模型被截断的摘要，而不是让对话保持不变。 | 不满意的回答会从界面和后续模型请求里一起消失。一点即可运行 `/compact`。 |
| 插件市场 | 预装且可关闭：`github:LunFengChen/dsh-market#v1.44.0`。官方 `@deepseek-ai/dsh-*` 插件会 remap 进这一套运行时。 | 社区插件用 `xfdsh plugin --profile web add` 安装。 |
| 插件作者 | 可选插件卡片会显示作者，并链到 GitHub。 | Settings → Plugins 能打开插件仓库，不再只剩包名。 |
| 思考强度 | 预装滑条 `github:LunFengChen/dsh-reasoning-effort#v0.7.1`。Settings → Models 里每个自定义模型可选默认（无）或自定义 `reasoningEfforts`。 | 自定义模型声明档位后，输入框才能选思考强度。滑条可在 Settings → Plugins 关闭。 |
| 上下文面板 | 预装且可关闭：`github:LunFengChen/dsh-context#v0.49.6`。版本探测读本 fork，不读残留的官方 CLI。 | Context 页和 `/context` 命令能看组成、压缩和 token 用量。 |
| Better sidebar | 预装且可关闭：`github:LunFengChen/DSH-better-sidebar#v0.19.0-alpha.1`。 | 文件、终端、Git 和子代理都在侧边栏工作台里。 |
| Hindsight 记忆 | 预装但默认关闭：`@vectorize-io/hindsight-coding-agents@0.5.2`。 | 在 Settings → Plugins 打开。xfdsh 默认走本机 daemon；Cloud 或自建 URL 可写在 `~/.hindsight/coding-agent.json`。本地回忆需要 `uv` 和提取用的 LLM key。 |
| 会话工具 | 工作区列表可以复制 session id。 | 方便分享和排障。 |
| 内存与续跑 | 会话持久化限制内存读取；context overflow 会压缩并重试。从大模型切到小模型时，会按待选模型先计价压力再发下一次请求。 | 长会话更不容易卡住。非空但被截断的摘要仍会替换被压缩的区间。 |
| 纯文本模型 | 历史图片和新图片会变成稳定文本占位符。 | 切到不支持图片的模型不会让会话停摆。 |
| Web 搜索 | 默认顺序是 Perplexity，然后 Exa。DeepSeek 搜索仍可选手动选择。 | 搜索不会总是去打 DeepSeek 账单。 |
| 多回答 / session git graph | 还没做。等 timeline 回退 UI 完成后再扩展。 | 只记在文档里，本轮不做。 |

## 分支

GitHub 默认分支是 `dev-x1a0f3n9`。不带 `-b` 克隆也会落到这条 fork 线。fork 功能不要直接提交到 `master`。

| 分支 | 作用 | npm |
| --- | --- | --- |
| `master` | 跟踪上游 dsh。在这里同步上游。 | 当前不发布这个 fork。 |
| `dev-x1a0f3n9` | fork 集成线。在这里测试，再推送。 | 推送后发布 `@x1a0f3n9/*`。 |
| `feat/<topic>` 或 `fix/<topic>` | 一个小改动，从 `dev-x1a0f3n9` 拉出。 | 不发布。完成后 `--no-ff` 合回 `dev-x1a0f3n9`。 |

1. 从上游 `deepseek-ai/deepseek-harness` 更新 `master`。
2. 把这次的 `master` 合进 `dev-x1a0f3n9`。冲突在 fork 线上解，不要解在 `master`。
3. 从 `dev-x1a0f3n9` 拉出 `feat/<topic>` 或 `fix/<topic>`。
4. `--no-ff` 合回 `dev-x1a0f3n9`。这些短分支不要合进 `master`。
5. 本地用 `pnpm xfdsh web` 测 `dev-x1a0f3n9`。
6. 推送 `dev-x1a0f3n9`。CI 会编译并发布 `@x1a0f3n9/*`。
7. 功能够多后，再把 `dev-x1a0f3n9` 合进 `master`，走 `@xfcodeai/*` 这条线。

## 安装这个 fork

这个 fork 支持两种安装方式。都会在 `http://127.0.0.1:7777` 启动 `xfdsh web`。官方 `dsh` 是另一套产品，不需要做历史迁移。

**官方 `dsh`（不变）：**

```sh
npm install --global @deepseek-ai/dsh
dsh web
```

插件、profile、会话、settings 和 key 都在 `~/.dsh`，监听 `http://127.0.0.1:3080`。

**fork npm（开发 scope `@x1a0f3n9`）：**

```sh
npm install --global @x1a0f3n9/dsh
xfdsh web
```

**fork 源码：**

```sh
git clone -b dev-x1a0f3n9 https://github.com/LunFengChen/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm xfdsh web
```

`pnpm xfdsh web` 用 tsx 启动当前仓库。之后每次启动不用再编译。克隆后、拉取大改动后，或使用 `pnpm exec xfdsh` 时才需要重新 `pnpm run build`。PATH 上的裸 `xfdsh web` 来自 `npm install --global @x1a0f3n9/dsh`。

不装全局包的一次性运行：

```sh
npx --package @x1a0f3n9/dsh xfdsh web
```

`xfdsh` 的插件和 profile 放在 `~/.xfdsh`，不会写 `~/.dsh/profiles`。会话、分组、附件、settings 和 API key 仍在 `~/.dsh`，所以两套 CLI 看到同一份历史。预装的 timeline、插件市场、思考强度、上下文面板、better-sidebar 和 hindsight 可以在 Settings → Plugins 关闭。

推送 `dev-x1a0f3n9` 会发布 `@x1a0f3n9/*`。遇到 npm 新包名额度会暂停这一轮但不把 job 判失败，下次再推会继续发剩下的名字。`master` 当前跟踪上游，不发布这个 fork。之后的稳定 fork 发布使用 `@xfcodeai/*`。

## 开发者预览

DeepSeek Harness 处于 _开发者预览_ 阶段，正在快速迭代。**未来将出现破坏兼容性的变更。**

运行本项目前，请阅读[安全说明](SAFETY.zh.md)。

<a id="run"></a>

## 运行

### 通过 `npm` 运行

安装 `Node.js`，然后运行：

```sh
npx --package @x1a0f3n9/dsh xfdsh web
```

该命令默认会在 `http://127.0.0.1:7777` 启动 Web UI，本机启动时还会用默认浏览器打开页面。通过 SSH 启动时只打印宿主机 URL，因为本地转发地址由 SSH 客户端或编辑器持有。传入 `--no-open` 可仅运行服务器而不打开浏览器。详见 [Web UI 指南](docs/user/guide/index.zh.md)。

<a id="run-from-source"></a>

### 从源码运行

如需从仓库源码运行：

```sh
git clone -b dev-x1a0f3n9 https://github.com/LunFengChen/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm xfdsh web
```

日常启动用 `pnpm xfdsh web`，不会重新编译。`pnpm exec xfdsh web` 走编好的 bin，需要当前的 `lib/`。

## 社区与支持

- 通过 [GitHub Discussions](https://github.com/LunFengChen/deepseek-harness/discussions) 提交反馈或 bug 报告。
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
