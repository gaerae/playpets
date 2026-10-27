---
description: 把编码代理的工作状态发送给伙伴的设置、终端命令和安全说明
---

# 编码代理联动

- Claude Code、Codex CLI、Gemini CLI、Cursor 等编码代理工作时，伙伴会跟着有反应。
- 复制一段设置粘贴进去就好，不需要 Node.js。

## 每位伙伴负责一个代理 <Since v="0.1.0" />

1. 在**设置 → 编码工具连接**里，每个工具那一行都有**负责的伙伴**，选好伙伴。
2. 再点一次**复制设置**，粘贴进去。

- 复制出的设置写着那位伙伴（`--pet`），所以可以让 Clover 负责 Claude Code、Pip 负责 Codex。
- 不指定时（“未指定, 由第一位伙伴反应”）由第一位伙伴接收。
- 负责的伙伴被送走后，也会回到第一位伙伴。
- 让每位伙伴负责不同的代理，乐园就成了显示“现在谁在做什么”的状态板。

## 乐园里看得到的东西 <Since v="0.1.0" />

- 有负责代理的伙伴，名牌上会小小地标出代理名字（Clover, Claude Code）。
- 伙伴面板里名字下方的小标签也显示负责的代理。
- 伙伴头上的小圆点是代理的状态，鼠标悬停会显示名字：

| 圆点 | 状态 | 何时消失 |
|---|---|---|
| 闪动的橙色 | 工作中 | 代理再次通知时 |
| 蓝色 | 等待中 | 代理再次通知时 |
| 绿色 | 完成 | 30 分钟后 |
| 红色 | 出了问题 | 30 分钟后 |

- 伙伴面板里的状态胶囊也是代理的状态。聊天的回答显示在对话窗里。

## 会发生什么 <Since v="0.1.0" />

- 代理的每个步骤会变成伙伴的状态。
- 状态显示在伙伴面板的名字旁边和乐园的名牌上，也会以气泡浮在桌面上的伙伴头顶。

| 代理在做什么 | 伙伴的状态 |
|---|---|
| 正在思考、正在使用工具（例：“正在使用 Bash”） | 工作中 |
| 等待确认或回答 | 等待回答 |
| 完成了任务 | 任务完成 |
| 出了错误 | 出了点问题 |
| 会话结束 | 休息中 |

- 伙伴最多记住 8 条最近的活动。在[聊天](./chat.md)里问“刚才在做什么？”，它就会讲给你听。

## 复制设置并粘贴 <Since v="0.1.0" />

<Shot name="settings-agents" caption="设置 → 编码工具连接。每个工具都有一个复制设置按钮。" />

1. 打开**伙伴与设置 → 设置 → 编码工具连接**。
2. 点你所用工具旁边的**复制设置**。提示会告诉你要粘贴到哪个文件。
3. 打开那个文件，粘贴并保存。重新启动代理后就接上了。

| 工具 | 粘贴到哪里 | 行为 |
|---|---|---|
| Claude Code（推荐） | `~/.claude/settings.json` | 通过钩子（hook）每一步都通知 |
| Codex CLI | `~/.codex/config.toml` 的最上面 | 任务结束时通知 |
| Gemini CLI | `~/.gemini/settings.json` | 通过钩子每一步都通知 |
| Cursor | `~/.cursor/hooks.json` | 通知编辑、命令和完成。只用观察用的钩子 |
| 其他 MCP 工具 | 工具的 MCP 设置 | AI 用 `set_pet_state`、`say`、`react`、`list_pets` 工具直接发送状态和气泡 |

- 复制的设置里包含 PlayPets 可执行文件的路径。应用的可执行文件本身就是联动命令，不用另外安装。
- 把应用移到了别处的话，请重新复制设置并粘贴。
- 文件里已经有 `hooks` 或 `mcpServers` 项时，把这段设置合并进那个项里。

## 直接在终端里 <Since v="0.1.0" />

- 同一个可执行文件也能在终端里调用，跟伙伴说话。
- 下面的 `playpets` 指应用的可执行文件（macOS 上是 `/Applications/PlayPets.app/Contents/MacOS/playpets`）。

```
playpets hook claude|gemini|cursor   # 钩子（stdin 传入 JSON，退出码始终为 0；对 Gemini、Cursor 输出 {}）
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
| `playpets run -- npm test` | 命令运行期间是“工作中”，结束后变成“任务完成”或“出了点问题” |

- 用 `--pet 名字` 或 `--pet 伙伴ID` 指定伙伴。不加则发给第一位伙伴。
- 伙伴 ID 在伙伴设置窗口的底部。

## 安全 <Since v="0.1.0" />

- 联动只在这台电脑内进行。
  - 应用在 `127.0.0.1` 上打开一个随机端口，并对每个请求检查随机令牌。
  - 端口和令牌保存在数据文件夹的 `bridge.json` 里，每次重启应用都会更换。
- [编码代理联动](./agents.md)省略用户提示词和工具输入。本地桥接使用 `127.0.0.1` 和令牌认证。
- 简短的完成或通知报告（包括截取的代理回复）可能包含工作细节，并可能随伙伴对话发给所选 AI 服务。
- 请检查通过终端或 MCP 发送的消息。想把这些内容留在本机，用已下载的本地模型。
- 钩子不会阻塞代理的工作：3 秒内安静地结束；应用没打开时，代理也照常运行。
- 这和聊天用的 AI 连接是分开的。只做了联动，不等于就能和伙伴聊天。

更详细的结构见开发者文档[编码代理联动](/dev/agent-integration)。

## Windows 上的注意事项

- 用本地构建的试验性 MSIX 包安装时，可执行文件在 `WindowsApps` 下，无法通过路径调用。这时复制出的设置会指向执行别名 `%LOCALAPPDATA%\Microsoft\WindowsApps\playpets.exe`。
- 用 npm 安装的 `claude`、`codex` 必须在 `%APPDATA%\npm` 里，应用才能找到。装在别处可能无法自动检测。
