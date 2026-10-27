---
description: Microsoft Store、winget、Homebrew、OSに合ったファイルでのインストール、初回起動時の警告、アップデートとデータフォルダー
---

# インストール

- 下のボタンは、いま使っているOSに合ったインストール方法を示します。ほかのファイルはその下の一覧にあります。

<Downloads />

| OS | インストール方法 |
|---|---|
| Windows | [Microsoft Store](#microsoft-store)（おすすめ、Microsoftの署名付き）、[winget](#winget)、[GitHubのインストーラー](#installer-from-github) |
| macOS | [Homebrew](#homebrew)、[GitHubのdmg](#dmg-from-github) |
| Linux | [AppImageまたはdeb](#linux) |

## Windows <Since v="0.1.0" /> {#windows}

| 方法 | 署名 | アップデート |
|---|---|---|
| Microsoft Store（おすすめ） | Microsoftの署名付き、SmartScreenの警告なし | Store |
| winget | Storeと同じパッケージ | Store |
| GitHubのインストーラー | まだなし、SmartScreenが警告する場合あり | アプリ自身 |

- 方法は一つに絞ってください。StoreのパッケージとGitHubのインストーラーは別々のインストールです。

### Microsoft Store {#microsoft-store}

1. [Microsoft StoreのPlayPets](https://apps.microsoft.com/detail/9NSKXQ6R187M)を開き、**入手**を選びます。
2. スタートメニューからPlayPetsを起動します。

- 通常のPC（x64）とARM PCには、それぞれに合ったパッケージが届きます。
- アップデートはStoreが行います。**Microsoft Store → ライブラリ**で確認できます。

### winget {#winget}

```powershell
winget install --id 9NSKXQ6R187M --source msstore
```

- ターミナルからMicrosoft Storeのパッケージをインストールする方法です。
- 初回は、Storeのソースの使用条件に同意するかwingetが尋ねる場合があります。

### GitHubのインストーラー {#installer-from-github}

::: warning このインストーラーはまだコード署名されていません
- SmartScreenが警告したり、開くのを止めたりする場合があります。警告なしでインストールするには、[Microsoft Store](#microsoft-store)か[winget](#winget)を使ってください。
- 確認を通っても、ファイルの安全が確かめられたわけではありません。公式リリースページからのダウンロードを信頼できる場合だけ進んでください。
:::

| ファイル | 対象 |
|---|---|
| `PlayPets_version_windows-x64-setup.exe` | 通常のPC（x64）向けインストーラー |
| `PlayPets_version_windows-arm64-setup.exe` | ARM PC向けインストーラー |

1. インストーラーを実行します。SmartScreenが認識されないアプリとして**Windows によって PC が保護されました**と表示したら、公式リリースページから入手したファイルか確認します。
2. ダウンロードを信頼できる場合は**詳細情報**を選び、使える操作を確認します。
3. **実行**があれば選び、インストーラーを続けます。ない場合は、端末のセキュリティ設定や組織の方針で続けられない可能性があります。
4. 言語選択画面で日本語、英語、韓国語、簡体字中国語から選び、案内に沿ってインストールします。

- SmartScreenはファイルと発行元の評判を見るため、新しいバージョンでもまた警告が出ることがあります（[MicrosoftによるSmartScreenの評判の説明](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)）。
- 保護機能はオンのままにしてください。
- マルウェアの警告は、認識されないアプリの警告とは別のものです。
- ARM PC（Snapdragonなど）ではarm64のファイルを使ってください。
- x64のファイルもエミュレーションで動きます。ただしそのインストーラーとアンインストーラーは、実行中のPlayPetsを代わりに閉じられません。先にトレイから終了してください。

::: tip
- Windows版は仮想マシンで確認しましたが、実機ではまだ十分にテストしていません。
- おかしな点は[GitHubのIssue](https://github.com/gaerae/playpets/issues)で知らせてください。
:::

## macOS <Since v="0.1.0" /> {#macos}

### Homebrew {#homebrew}

```sh
brew install gaerae/tap/playpets
```

- HomebrewもGitHubリリースの同じdmgをインストールするため、下の初回起動の手順が同じように必要です。
- アップデートはdmgの場合と同じく、アプリから受け取ります。

### GitHubのdmg {#dmg-from-github}

::: warning macOSのアプリはまだコード署名と公証が済んでいません
- 初めて開くとき、Gatekeeperが警告したり、開くのを止めたりする場合があります。macOSの署名は準備中です。
- 確認を通っても、ファイルの安全が確かめられたわけではありません。公式リリースページからのダウンロードを信頼できる場合だけ進んでください。
- 使える操作はOSや端末の管理方針で異なります。
:::

| ファイル | 対象 |
|---|---|
| `PlayPets_version_macos-universal.dmg` | Apple SiliconとIntelの両方 |

1. dmgを開き、PlayPetsを**アプリケーション**フォルダーへドラッグします。
2. PlayPetsを開きます。開発元を確認できない、またはアプリを検証できないと表示されたら、警告を閉じます。
3. **システム設定 → プライバシーとセキュリティ**を開き、PlayPetsについての案内と**このまま開く**を探します。
4. その操作が使えて、ダウンロードを信頼できる場合は**このまま開く**を押します。求められたら認証し、次の警告で**開く**を押します。macOSがこのアプリの例外を保存します。

- 手順は[Appleの安全にアプリを開く方法の案内](https://support.apple.com/en-us/102445)に沿っています。
- 「コンピュータに損害を与える」と表示された場合は、開発元を確認できないという警告と同じに扱わないでください。
- 管理された端末では、アプリを開くことが制限される場合があります。

## Linux <Since v="0.1.0" /> {#linux}

| ファイル | 対象 |
|---|---|
| `PlayPets_version_linux-x64.deb`、`…_linux-arm64.deb` | Debian、Ubuntu系 |
| `PlayPets_version_linux-x64.AppImage`、`…_linux-arm64.AppImage` | 対応するLinuxディストリビューション |

- debはパッケージ管理ツールでインストールします。
- AppImageは実行可能にしてから起動します。

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Linuxで知っておくこと
- AppImageにはFUSE 2が必要です。
  - Ubuntu 22.04: `sudo apt install libfuse2`
  - Ubuntu 24.04: 名前が変わったパッケージ`sudo apt install libfuse2t64`
  - ほかのディストリビューション: [AppImageのFUSEの案内](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)
  - FUSEがない場合: `./PlayPets_*.AppImage --appimage-extract-and-run`で起動します。
- 窓を閉じてもアプリはトレイに残ります。
  - GNOMEでは「AppIndicator and KStatusNotifierItem Support」拡張機能がオンでないと、トレイアイコンが出ません。
  - アイコンがなくても、アプリをもう一度起動すれば庭が戻ります。
- APIキーはSecret Service（GNOME Keyring、KWallet）に保存します。
  - ない場合、キーが必要な接続を保存しようとすると、安全な保管場所に接続できないという案内が出ます。
  - OllamaとサブスクリプションのCLIにはキーは要りません。
:::

## アップデート <Since v="0.1.0" /> {#updates}

- Microsoft Store版の更新はStoreが管理します。**Microsoft Store → ライブラリ**で確認してください。
- 以下のGitHubインストーラーによる更新は、MSIX以外のインストールに適用されます。テスト用MSIXもパッケージ管理による更新を使います。
- 保存と外部通信は[プライバシーポリシー](../privacy.md)をご覧ください。

**すぐに確認する**
- 次のどれでも確認できます。
  - 設定の**アプリのアップデート**にある**アップデートを確認**
  - トレイメニューの**アップデートを確認…**
  - macOSのメニューバーの**PlayPets → アップデートを確認…**
- どれも設定の**アプリのアップデート**を開き、確認結果と更新の操作を同じ場所に表示します。

**インストールする**
1. 新しいバージョンがあると、バージョン表示が静かに現れます。押すと同じ設定項目が開きます。
2. 変更内容を読み、**インストールして再起動**を選びます。
3. ダウンロード、署名確認、インストールのあと、再起動します。

- 自動確認だけでインストールを始めることはありません。
- ダウンロード中も設定を閉じて遊べます。小さい窓にも進捗ボタンが残ります。
- 開き直しても重複ダウンロードしません。
- エラーと再試行も**アプリのアップデート**で確認できます。
- 再起動後、新しいバージョンを短く知らせます。

**自動確認**

| とき | 動き |
|---|---|
| 起動20秒後 | 静かに確認 |
| 実行中 | 6時間ごとに確認 |
| 確認に失敗 | 5分後、15分後、1時間後に静かに再試行。その後は6時間ごと |
| 確認に成功 | 6時間間隔に戻る |

- 自動確認で設定を開いたり、通知を出したりはしません。
- 新しいバージョンはGitHubリリースの`latest.json`で見つけます。
- ダウンロードしたファイルは、アップデート用の署名鍵で検証してからインストールします。検証に失敗したファイルはインストールしません。

## アンインストール

| OS | 方法 |
|---|---|
| macOS | **アプリケーション**フォルダーのPlayPetsをゴミ箱に入れます。Homebrew：`brew uninstall playpets` |
| Windows Store、winget | **設定 → アプリ**でPlayPetsを削除するか、`winget uninstall --id 9NSKXQ6R187M` |
| Windowsインストーラー | **設定 → アプリ**でPlayPetsを削除します |
| Linux deb | インストールに使ったパッケージ管理ツールで削除します |
| Linux AppImage | ファイルを削除します |

- アプリを削除しても、下のデータフォルダーは残ります。
- Store、winget：アプリを削除すると、Windowsがパッケージのデータも一緒に削除します。
- 設定や取り込んだペットも消すには、データフォルダーも削除してください。

## データフォルダー <Since v="0.1.0" /> {#data-folder}

| OS | 場所 |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\`。Store、winget：パッケージ専用のフォルダー内 |
| Linux | `~/.local/share/app.playpets/` |

| 中身 | 内容 |
|---|---|
| `state.json` | 友だちと設定 |
| `bridge.json` | エージェント連携のポートとトークン |
| `pets/` | 取り込んだペット |
| `builtin/` | 付属の4種類の仲間 |

- 別の場所に置くには、環境変数`PLAYPETS_DATA`にフォルダーのパスを入れてアプリを起動します。
- 詳しくは[設定](./settings.md)を参照してください。
