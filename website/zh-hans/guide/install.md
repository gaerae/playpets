---
description: 通过 Microsoft Store、winget、Homebrew 或适合你系统的文件安装、第一次运行时的警告、更新和数据文件夹
---

# 安装

- 下面的按钮会给出适合你当前系统的安装方式。其他文件都在它下面的列表里。

<Downloads />

| 系统 | 安装方式 |
|---|---|
| Windows | [Microsoft Store](#microsoft-store)（推荐，由 Microsoft 签名）、[winget](#winget)、[GitHub 安装文件](#installer-from-github) |
| macOS | [Homebrew](#homebrew)、[GitHub dmg](#dmg-from-github) |
| Linux | [AppImage 或 deb](#linux) |

## Windows <Since v="0.1.0" /> {#windows}

| 方式 | 签名 | 更新 |
|---|---|---|
| Microsoft Store（推荐） | 由 Microsoft 签名，没有 SmartScreen 警告 | 商店 |
| winget | 与商店相同的安装包 | 商店 |
| GitHub 安装文件 | 暂无，SmartScreen 可能警告 | 应用自己 |

- 请只选一种方式。商店安装包和 GitHub 安装文件是两份各自独立的安装。

### Microsoft Store {#microsoft-store}

1. 打开 [Microsoft Store 里的 PlayPets](https://apps.microsoft.com/detail/9NSKXQ6R187M)，点**获取**。
2. 从「开始」菜单启动 PlayPets。

- 一般 PC（x64）和 ARM PC 会各自拿到合适的安装包。
- 更新由商店负责，可在 **Microsoft Store → 库**中查看。

### winget {#winget}

```powershell
winget install --id 9NSKXQ6R187M --source msstore
```

- 这是在终端里安装 Microsoft Store 安装包的方式。
- 第一次使用时，winget 可能会请你同意商店源的条款。

### GitHub 安装文件 {#installer-from-github}

::: warning 这个安装文件暂时没有代码签名
- SmartScreen 可能显示警告或阻止打开。想不看到警告直接安装，请用 [Microsoft Store](#microsoft-store) 或 [winget](#winget)。
- 这些检查不能证明文件安全。只有信任从官方发布页下载的文件时才继续。
:::

| 文件 | 适用 |
|---|---|
| `PlayPets_版本_windows-x64-setup.exe` | 一般 PC（x64）的安装文件 |
| `PlayPets_版本_windows-arm64-setup.exe` | ARM PC 的安装文件 |

1. 运行安装文件。SmartScreen 针对无法识别的应用显示「Windows 已保护你的电脑」时，先确认文件来自官方发布页。
2. 信任下载的文件的话，点**更多信息**查看可用选项。
3. 有**仍要运行**按钮就点它继续安装。没有的话，设备安全设置或组织策略可能不允许继续。
4. 在语言选择窗口中选简体中文、英语、韩语或日语，再按提示完成安装。

- SmartScreen 检查文件和发布者的信誉，所以新版本也可能再次显示警告。详见 [Microsoft 的 SmartScreen 信誉说明](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)。
- 请保持安全防护开启。恶意软件警告和无法识别应用警告是不同情况。
- ARM PC（骁龙等）请用 arm64 文件。
- x64 文件也能通过模拟运行，但它的安装和卸载程序无法替你关闭正在运行的 PlayPets，请先从托盘退出。

::: tip
- Windows 版已在虚拟机中确认过，但还没在真机上充分验证。
- 发现异常请到 [GitHub Issues](https://github.com/gaerae/playpets/issues) 告诉我们。
:::

## macOS <Since v="0.1.0" /> {#macos}

### Homebrew {#homebrew}

```sh
brew install gaerae/tap/playpets
```

- Homebrew 安装的也是 GitHub 发布页上的同一个 dmg，所以同样需要下面的首次打开步骤。
- 更新和 dmg 安装时一样，由应用自己完成。

### GitHub dmg {#dmg-from-github}

::: tip 从 1.3.0 起已签名并经过公证
- 从 1.3.0 起，macOS 应用使用 Apple Developer ID 签名，并经过 Apple 公证，像其他下载的应用一样打开即可。
- 1.2.0 及更早版本没有签名。打开这些版本时，可能需要按下面旧版本的步骤操作。
:::

| 文件 | 适用 |
|---|---|
| `PlayPets_版本_macos-universal.dmg` | Apple Silicon 和 Intel 都可以 |

1. 打开 dmg，把 PlayPets 拖到「应用程序」文件夹。
2. 打开 PlayPets。第一次打开时，macOS 会询问是否打开从互联网下载的应用，点**打开**。

没有签名的 1.2.0 及更早版本：

1. 尝试打开 PlayPets。如果 macOS 提示无法验证开发者或无法验证应用，关闭提示。
2. 前往「系统设置 > 隐私与安全性」，找到关于 PlayPets 的说明和**仍要打开**。
3. 该选项可用、而且你信任从官方发布页下载的文件时，点**仍要打开**，按提示验证身份，再在下一条提示中点**打开**。macOS 会把该应用保存为例外。

- 这些步骤遵循 [Apple 的安全打开应用指南](https://support.apple.com/en-us/102445)。
- 如果 macOS 提示应用会损坏电脑，不要把它当作无法验证开发者的警告处理。
- 受管理的设备可能限制打开应用。

## Linux <Since v="0.1.0" /> {#linux}

| 文件 | 适用 |
|---|---|
| `PlayPets_版本_linux-x64.deb`、`…_linux-arm64.deb` | Debian、Ubuntu 系 |
| `PlayPets_版本_linux-x64.AppImage`、`…_linux-arm64.AppImage` | 兼容的 Linux 发行版 |

- deb：用包管理器安装。
- AppImage：加上可执行权限后直接运行。

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Linux 上要知道的事
- AppImage 需要 FUSE 2：
  - Ubuntu 22.04：`sudo apt install libfuse2`
  - Ubuntu 24.04（软件包已改名）：`sudo apt install libfuse2t64`
  - 其他发行版：见 [AppImage 的 FUSE 指南](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)
  - 不用 FUSE：运行 `./PlayPets_*.AppImage --appimage-extract-and-run`
- 关闭窗口后，应用留在托盘里。
  - GNOME 默认不显示托盘图标，请开启「AppIndicator and KStatusNotifierItem Support」扩展。
  - 看不到图标时，再运行一次应用，乐园窗口也会回来。
- API 密钥保存在 Secret Service（GNOME Keyring、KWallet）里。
  - 没有它的环境下，保存需要密钥的连接时会提示无法访问安全存储。
  - Ollama 和订阅 CLI 不用密钥，不受影响。
:::

## 更新 <Since v="0.1.0" />

- Microsoft Store 安装版由 Store 管理更新，请在 **Microsoft Store → 库**检查。
- 下面通过 GitHub 安装程序更新的说明，适用于非 MSIX 安装版；测试用 MSIX 同样使用包管理更新。
- 存储与外部通信详情见[隐私政策](../privacy.md)。

立即检查：

- **设置 → 应用更新**里的**检查更新**、托盘菜单的**检查更新…**，或 macOS 菜单栏的 **PlayPets → 检查更新…**。
- 这些入口都会打开设置里的**应用更新**，检查结果和更新操作都显示在这里。

有新版本时：

- 会安静地显示版本入口，点击后打开同一个设置区域。
- 读完更新内容、选**安装并重启**后，应用会下载、验证签名、安装并重启。自动检查不会开始安装。
- 下载时可以关掉设置继续玩，小窗口也会保留进度入口。
- 重新打开不会重复下载。错误和重试操作都留在**应用更新**里。
- 重启后会短暂提示已安装的版本。

自动检查：

- 启动 20 秒后静默检查，运行期间每 6 小时再检查一次。
- 失败后分别在 5 分钟、15 分钟、1 小时后静默重试，之后每 6 小时重试。成功后恢复每 6 小时检查。
- 自动检查不会打开设置，也不弹通知。

验证：

- 新版本从 GitHub 发布页的 `latest.json` 查找。
- 下载的文件只有通过更新签名密钥验证后才会安装。验证失败的文件不会安装。

## 卸载

| 操作系统 | 方法 |
|---|---|
| macOS | 把「应用程序」文件夹里的 PlayPets 移到废纸篓。Homebrew：`brew uninstall playpets` |
| Windows 商店、winget | 在「设置 > 应用」里卸载 PlayPets，或运行 `winget uninstall --id 9NSKXQ6R187M` |
| Windows 安装版 | 在「设置 > 应用」里卸载 PlayPets |
| Linux deb | 用安装时的包管理器卸载 |
| Linux AppImage | 删除文件 |

- 删除应用后，下面的数据文件夹仍会留下。
- 商店、winget：卸载应用时，Windows 会一并删除安装包的数据。
- 想把设置和导入的宠物也删掉，请一并删除数据文件夹。

## 数据文件夹 <Since v="0.1.0" />

| 操作系统 | 位置 |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\`。Microsoft Store（包括用 winget 安装）：在安装包专用的文件夹里 |
| Linux | `~/.local/share/app.playpets/` |

| 文件 | 内容 |
|---|---|
| `state.json` | 伙伴和设置 |
| `bridge.json` | 代理联动用的端口和令牌 |
| `pets/` | 导入的宠物 |
| `backgrounds/` | 导入的背景 |
| `builtin/` | 自带的四位伙伴 |

- 想放到别处：把文件夹路径填进环境变量 `PLAYPETS_DATA`，再运行应用。
- 详见[设置](./settings.md)。
