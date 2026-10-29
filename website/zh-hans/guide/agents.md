---
description: 让伙伴跟着编码代理的工作状态做出反应：一键连接或要粘贴的设置、终端命令和安全说明
---

# 编码代理联动

Claude Code、Codex CLI、Gemini CLI、Cursor、Grok Build、Qoder、Kimi Code 这类编码代理干活的时候，伙伴也会跟着做出反应。点一下**连接**，或复制一段设置粘贴进去就好，不需要 Node.js。

## 每位伙伴负责一个代理 <Since v="0.1.0" />

1. 在**设置 → 编码工具连接**里，每个工具那一行都有**负责的伙伴**，选好伙伴。
2. 点那一行的**重新连接**，或重新复制设置再粘贴。

设置里写着这位伙伴（`--pet`），所以可以让 Clover 负责 Claude Code，让 Pip 负责 Codex。没有指定时（“未指定，由第一位伙伴反应”），由第一位伙伴接收；负责的伙伴送走以后，也会交回给第一位伙伴。

让每位伙伴负责不同的代理，乐园就成了一块状态板，现在谁在做什么一眼就能看到。

## 同时用多个代理

- 每位伙伴只显示自己负责的代理：状态点、名牌和桌面气泡都是各自的。
- 问伙伴“你刚才在做什么？”，它只讲自己那个代理最近做的事。

| 代理 | 伙伴 | 你会看到 |
|---|---|---|
| Claude Code | Clover | 改文件时显示工作中 |
| Codex CLI | Pip | 一次回复结束后显示任务完成 |
| Gemini CLI | Daisy | 等待确认时显示等待回答 |
| Cursor | Miso | 运行命令时显示工作中 |

### 同一个代理开两个会话

1. 在**设置 → 编码工具连接**里，这个工具的**负责的伙伴**留空，然后连接，或复制设置并粘贴。
2. 每个会话启动时指定各自的伙伴：

```bash
PLAYPETS_PET=Clover claude
PLAYPETS_PET=Pip claude
```

- PowerShell 里这样写：`$env:PLAYPETS_PET="Clover"; claude`。
- `PLAYPETS_PET` 和 `--pet` 一样，填伙伴的名字或 ID。
- 选了**负责的伙伴**后，设置里会写上这位伙伴（`--pet`），它比 `PLAYPETS_PET` 优先。
- 从终端启动的 Claude Code、Codex CLI、Gemini CLI、Grok Build、Qoder CLI、Kimi Code 都可以这样用。Cursor 的钩子由 Cursor 应用运行，所以只会通知一位伙伴。

## 乐园里看得到的东西 <Since v="0.1.0" />

有负责代理的伙伴，名牌上会用小字标出代理的名字（Clover, Claude Code），伙伴面板里名字下方的小标签也会显示。伙伴头上的小圆点表示代理的状态，鼠标悬停就能看到名字。

| 圆点 | 状态 | 何时消失 |
|---|---|---|
| 闪动的橙色 | 工作中 | 代理再次通知时 |
| 蓝色 | 等待中 | 代理再次通知时 |
| 绿色 | 完成 | 30 分钟后 |
| 红色 | 出了问题 | 30 分钟后 |

伙伴面板里的状态胶囊显示的也是代理的状态。聊天的回答在对话窗里。

## 会发生什么 <Since v="0.1.0" />

代理每走一步，伙伴的状态就跟着变。状态显示在伙伴面板的名字旁边和乐园的名牌上，在桌面上还会变成气泡，浮在伙伴头顶。

| 代理在做什么 | 伙伴的状态 |
|---|---|
| 正在思考、正在使用工具（例：“正在使用 Bash”） | 工作中 |
| 等待确认或回答 | 等待回答 |
| 完成了任务 | 任务完成 |
| 出了错误 | 出了点问题 |
| 会话结束 | 休息中 |

并不是每个代理都会报告每一步。Codex CLI 只在回复结束时报告，所以它的伙伴会显示任务完成，但不会显示工作中或等待回答。Cursor 没有在等待确认时调用的钩子，所以它的伙伴不会显示等待回答。

伙伴最多记得 8 条最近的活动。在[聊天](./chat.md)里问它“刚才在做什么？”，它就会讲给你听。

## 一键连接 <Since v="1.4.0" />

1. 打开**伙伴与设置 → 设置 → 编码工具连接**。
2. 点你所用工具旁边的**连接**。PlayPets 会先告诉你要改哪个文件，并询问你。
3. 在询问框里点**连接**。那一行会显示**已连接**，之后启动的会话都会通知伙伴。

PlayPets 只往那个文件里加自己的钩子。其他设置和其他工具的钩子保持不变，原文件会留在旁边，比如 `settings.json.playpets-backup`。已经连接时再点一次，什么也不会变。

换了负责的伙伴，或把应用挪到了别处，那一行会提示需要重新连接，这时点**重新连接**就好。**断开连接**只删除 PlayPets 的条目，文件的其他部分不会动。

像带注释的设置这样 PlayPets 读不懂的文件，它绝不会改写。这时那一行会说明原因，下面的**复制设置**照样能用。Codex 只运行一个 `notify` 程序，所以那里已经有别的程序时，PlayPets 也不会动它。

## 复制设置并粘贴 <Since v="0.1.0" />

<Shot name="settings-agents" caption="设置 → 编码工具连接。每个工具都有连接和复制设置按钮。" />

想自己加设置的话，这样做：

1. 打开**伙伴与设置 → 设置 → 编码工具连接**。
2. 点你所用工具旁边的**复制设置**。提示会告诉你要粘贴到哪个文件。
3. 打开那个文件，粘贴并保存。重新启动代理，马上就能接上。

| 工具 | 粘贴到哪里 | 行为 |
|---|---|---|
| Claude Code（推荐） | `~/.claude/settings.json` | 通过钩子（hook）每一步都通知 |
| Codex CLI | `~/.codex/config.toml` 的最上面 | 任务结束时通知 |
| Gemini CLI | `~/.gemini/settings.json` | 通过钩子每一步都通知 |
| Cursor | `~/.cursor/hooks.json` | 通知编辑、命令和完成。只用观察用的钩子 |
| Grok Build | `~/.grok/hooks/playpets.json`，另存为新文件 | 通过钩子每一步都会通知 |
| Qoder | `~/.qoder/settings.json` | 通过钩子每一步都会通知。Qoder IDE 重启后生效 |
| Kimi Code | `~/.kimi-code/config.toml` 的末尾 | 通过钩子每一步都会通知 |
| 其他 MCP 工具 | 工具的 MCP 设置 | AI 用 `set_pet_state`、`say`、`react`、`list_pets` 工具直接发送状态和气泡 |

- 复制的设置里有 PlayPets 可执行文件的路径。这个可执行文件本身就是联动命令，不用另外安装。
- 如果把应用挪到了别处，请点**重新连接**，或重新复制设置再粘贴一次。
- 如果是在 1.4.0 之前的版本复制的 Claude Code 设置，请重新复制再粘贴。这样遇到使用上限之类的错误停下时，伙伴也会告诉你。
- 文件里已经有 `hooks` 或 `mcpServers` 项时，把这段设置合并到那一项里。
- Grok Build 也会运行 Claude Code 和 Cursor 的钩子，但它的工作只显示在 Grok Build 的伙伴身上。

## 直接在终端里 <Since v="0.1.0" />

同一个可执行文件也可以在终端里调用，用来跟伙伴说话。下面的 `playpets` 指应用的可执行文件，在 macOS 上是 `/Applications/PlayPets.app/Contents/MacOS/playpets`。

```
playpets hook claude|gemini|cursor|grok|qoder|kimi   # 钩子（stdin 传入 JSON，退出码始终为 0；对 Gemini、Cursor 输出 {}）
playpets hook codex <json>      # Codex notify
playpets mcp                    # MCP stdio 服务器
playpets status <状态> [消息]   [--pet 名字|ID] [--bridge 文件]
playpets say <话>
playpets react <动作>
playpets pets
playpets run -- <命令>
```

常用例子：

| 命令 | 作用 |
|---|---|
| `playpets pets` | 伙伴列表和当前状态 |
| `playpets say "测试通过"` | 不改状态，只显示一个气泡 |
| `playpets status working "正在构建"` | 更改状态。`idle`、`working`、`waiting`、`done`、`error` 之一 |
| `playpets react wave` | 做一次反应。`wave`、`jump`、`pet` 之一 |
| `playpets run -- npm test` | 命令运行期间是“工作中”，结束后变成“任务完成”或“出了点问题”。用 Ctrl-C 停下时，回到“休息中” |

- 用 `--pet 名字` 或 `--pet 伙伴ID` 指定某位伙伴，不加就发给第一位伙伴。
- 伙伴 ID 在伙伴设置窗口的最下面。

## 安全 <Since v="0.1.0" />

- 联动只在这台电脑内进行。
  - 应用在 `127.0.0.1` 上打开一个随机端口，并对每个请求检查随机令牌。
  - 端口和令牌保存在数据文件夹的 `bridge.json` 里，每次重启应用都会更换。
- [编码代理联动](./agents.md)不会带上用户提示词和工具输入。本地桥接使用 `127.0.0.1` 和令牌认证。
- 简短的完成或通知报告（包括截取的代理回复）可能带有工作细节，这些内容可能会在伙伴聊天时发给你选的 AI 服务。
  - 通过终端或 MCP 发送的消息，请先检查一下。
  - 想把这些内容留在本机，就用已下载的本地模型。
- 钩子不会卡住代理的工作：几秒内悄悄结束；应用没打开时，代理也照常运行。
- 这和聊天用的 AI 连接是两回事。只设置联动，并不能和伙伴聊天。

更详细的结构见开发者文档[编码代理联动](/dev/agent-integration)。

## Windows 上的注意事项

- 用本地构建的试验性 MSIX 包安装时，可执行文件在 `WindowsApps` 下，没法通过路径调用。这时复制出的设置会指向执行别名 `%LOCALAPPDATA%\Microsoft\WindowsApps\playpets.exe`。
- 用 npm 安装的 `claude`、`codex` 要在 `%APPDATA%\npm` 里，应用才找得到。装在别处的话，可能无法自动检测。
