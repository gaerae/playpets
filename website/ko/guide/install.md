---
description: Microsoft Store, winget, Homebrew, 운영체제에 맞는 파일로 설치하기, 처음 실행할 때 뜨는 경고, 업데이트와 데이터 폴더
---

# 설치하기

- 아래 버튼은 지금 쓰는 운영체제에 맞는 설치 방법을 보여 줘요. 다른 파일은 그 아래 목록에 있어요.

<Downloads />

| 운영체제 | 설치 방법 |
|---|---|
| Windows | [Microsoft Store](#microsoft-store)(추천, Microsoft 서명), [winget](#winget), [GitHub 설치 파일](#installer-from-github) |
| macOS | [Homebrew](#homebrew), [GitHub dmg](#dmg-from-github) |
| Linux | [AppImage 또는 deb](#linux) |

## Windows <Since v="0.1.0" /> {#windows}

| 방법 | 서명 | 업데이트 |
|---|---|---|
| Microsoft Store(추천) | Microsoft 서명, SmartScreen 경고 없음 | 스토어 |
| winget | 스토어와 같은 패키지 | 스토어 |
| GitHub 설치 파일 | 아직 없음, SmartScreen이 경고할 수 있음 | 앱 자체 |

- 한 가지 방법만 고르세요. 스토어 패키지와 GitHub 설치 파일은 서로 다른 설치예요.

### Microsoft Store {#microsoft-store}

1. [Microsoft Store의 PlayPets](https://apps.microsoft.com/detail/9NSKXQ6R187M)를 열고 **받기**를 눌러요.
2. 시작 메뉴에서 PlayPets를 실행해요.

- 일반 PC(x64)와 ARM PC는 각자에 맞는 패키지를 받아요.
- 업데이트는 스토어가 맡아요. **Microsoft Store → 라이브러리**에서 확인해요.

### winget {#winget}

```powershell
winget install --id 9NSKXQ6R187M --source msstore
```

- 터미널에서 Microsoft Store 패키지를 설치하는 방법이에요.
- 처음에는 winget이 스토어 원본의 약관에 동의할지 물을 수 있어요.

### GitHub 설치 파일 {#installer-from-github}

::: warning 이 설치 파일에는 아직 코드 서명이 없어요
- SmartScreen이 경고하거나 실행을 막을 수 있어요. 경고 없이 설치하려면 [Microsoft Store](#microsoft-store)나 [winget](#winget)을 쓰세요.
- 이 검사만으로 파일이 안전하다고 확인되지는 않아요. 공식 릴리스 페이지에서 받은 파일을 신뢰할 때만 계속해 주세요.
:::

| 파일 | 대상 |
|---|---|
| `PlayPets_버전_windows-x64-setup.exe` | 일반 PC(x64) 설치 파일 |
| `PlayPets_버전_windows-arm64-setup.exe` | ARM PC 설치 파일 |

1. 설치 파일을 실행해요. SmartScreen이 알 수 없는 앱이라며 "Windows의 PC 보호" 창을 띄우면 공식 릴리스 페이지에서 받은 파일인지 확인해요.
2. 받은 파일을 신뢰하면 **추가 정보**를 눌러 선택지를 봐요.
3. **실행** 버튼이 있으면 눌러 설치를 이어 가요. 없으면 기기 보안 설정이나 조직 정책으로 실행이 제한된 것일 수 있어요.
4. 언어 선택 창에서 한국어, 영어, 일본어, 중국어 간체 중 하나를 고르고 설치해요.

- SmartScreen은 파일과 게시자의 평판을 보므로 새 버전에서 다시 경고할 수 있어요. [Microsoft의 SmartScreen 평판 안내](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)
- 보안 기능은 켜 두세요. 악성 프로그램 경고는 알 수 없는 앱 경고와 다른 경우예요.
- ARM PC(스냅드래곤 등)에서는 arm64 파일을 쓰세요.
- x64 파일도 에뮬레이션으로 돌아가지만, 그 설치, 제거 프로그램은 실행 중인 PlayPets를 대신 닫지 못해요. 먼저 트레이에서 종료해 주세요.

::: tip
- Windows 빌드는 가상 머신에서 확인했고, 실제 기기에서는 아직 충분히 확인하지 않았어요.
- 이상한 점은 [GitHub 이슈](https://github.com/gaerae/playpets/issues)로 알려 주세요.
:::

## macOS <Since v="0.1.0" /> {#macos}

### Homebrew {#homebrew}

```sh
brew install gaerae/tap/playpets
```

- Homebrew도 GitHub 릴리스의 같은 dmg를 설치하므로, 아래의 처음 실행 순서가 똑같이 필요해요.
- 업데이트는 dmg로 설치했을 때처럼 앱에서 받아요.

### GitHub dmg {#dmg-from-github}

::: tip 1.3.0부터 서명과 공증이 돼 있어요
- 1.3.0부터 macOS 앱은 Apple Developer ID로 서명되고 Apple의 공증을 받아서, 인터넷에서 받은 다른 앱처럼 열려요.
- 1.2.0 이하는 서명이 없어요. 그 버전을 열 때는 아래 이전 버전 순서가 필요할 수 있어요.
:::

| 파일 | 대상 |
|---|---|
| `PlayPets_버전_macos-universal.dmg` | Apple Silicon과 Intel 모두 |

1. dmg를 열고 PlayPets를 응용 프로그램 폴더로 끌어 놓아요.
2. PlayPets를 열어요. 처음 한 번 인터넷에서 받은 앱을 열지 물으면 **열기**를 눌러요.

서명이 없는 1.2.0 이하라면:

1. PlayPets를 열어요. 개발자를 확인할 수 없거나 앱을 검증할 수 없다는 안내가 뜨면 닫아요.
2. 시스템 설정 > 개인정보 보호 및 보안에서 PlayPets 안내와 **그래도 열기**를 찾아요.
3. 버튼이 있고 공식 릴리스 페이지에서 받은 파일을 신뢰하면 **그래도 열기**를 눌러요. 인증을 요청하면 확인하고, 다음 안내에서 **열기**를 눌러요. macOS가 이 앱을 예외로 저장해요.

- 이 순서는 [Apple의 안전하게 앱 열기 안내](https://support.apple.com/en-us/102445)를 따라요.
- 컴퓨터를 손상시킨다는 경고는 개발자를 확인할 수 없다는 경고와 같은 경우로 다루지 마세요.
- 관리되는 기기에서는 앱 실행이 제한될 수 있어요.

## Linux <Since v="0.1.0" /> {#linux}

| 파일 | 대상 |
|---|---|
| `PlayPets_버전_linux-x64.deb`, `…_linux-arm64.deb` | Debian, Ubuntu 계열 |
| `PlayPets_버전_linux-x64.AppImage`, `…_linux-arm64.AppImage` | 호환되는 Linux 배포판 |

- deb: 패키지 관리자로 설치해요.
- AppImage: 실행 권한을 주고 바로 실행해요.

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Linux에서 알아 둘 것
- AppImage는 FUSE 2가 필요해요.
  - Ubuntu 22.04: `sudo apt install libfuse2`
  - Ubuntu 24.04: 이름이 바뀐 패키지 `sudo apt install libfuse2t64`
  - 다른 배포판: [AppImage의 FUSE 안내](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)
  - FUSE 없이 실행: `./PlayPets_*.AppImage --appimage-extract-and-run`
- 창을 닫으면 앱은 트레이에 남아요.
  - GNOME은 트레이 아이콘을 기본으로 보여 주지 않아요. "AppIndicator and KStatusNotifierItem Support" 확장을 켜 주세요.
  - 아이콘이 안 보여도 앱을 다시 실행하면 놀이터 창이 돌아와요.
- API 키는 Secret Service(GNOME Keyring, KWallet)에 저장해요.
  - 없는 환경에서는 키가 필요한 연결을 저장할 때 보안 저장소에 접근할 수 없다는 안내가 떠요.
  - Ollama와 구독 CLI는 키가 없어서 상관없어요.
:::

## 업데이트 <Since v="0.1.0" />

- Microsoft Store 설치본은 Store에서 업데이트해요. **Microsoft Store → 라이브러리**에서 확인해 주세요.
- 아래 안내는 MSIX가 아닌 GitHub 설치본에 해당해요. 테스트용 MSIX도 패키지 관리 방식으로 업데이트해요.
- 저장과 외부 통신은 [개인정보처리방침](../privacy.md)에 있어요.

지금 확인하기:
- **설정 → 앱 업데이트**의 **업데이트 확인**
- 트레이 메뉴의 **업데이트 확인…**
- macOS 메뉴 막대의 **PlayPets → 업데이트 확인…**
- 모두 설정의 **앱 업데이트**로 열려요. 확인 결과와 업데이트 작업을 한곳에서 봐요.

새 버전 설치:
1. 새 버전이 있으면 버전 표시가 조용히 나타나요. 누르면 같은 설정 항목이 열려요.
2. 새로운 점을 읽고 **설치하고 다시 시작**을 골라요.
3. 다운로드, 서명 확인, 설치 후 다시 시작해요. 재시작 후 설치된 버전을 잠깐 알려 줘요.

- 자동 확인만으로 설치를 시작하지는 않아요.
- 다운로드 중에도 설정을 닫고 계속 놀 수 있어요. 작은 창에서도 진행 버튼이 남아요.
- 다시 열어도 다운로드를 중복 실행하지 않아요.
- 오류와 다시 시도도 **앱 업데이트**에서 봐요.

자동 확인:
- 앱 시작 20초 뒤 조용히 확인하고, 실행 중에는 6시간마다 다시 확인해요.
- 실패하면 5분, 15분, 1시간 뒤에 조용히 다시 시도하고, 이후에는 6시간마다 시도해요. 성공하면 6시간 간격으로 돌아가요.
- 자동 확인으로 설정이 열리거나 알림이 뜨지는 않아요.
- 새 버전은 GitHub 릴리스의 `latest.json`에서 찾아요.
- 받은 파일은 업데이트 서명 키로 검증한 뒤에만 설치해요. 검증에 실패하면 설치하지 않아요.

## 제거

| 운영체제 | 방법 |
|---|---|
| macOS | 응용 프로그램 폴더의 PlayPets를 휴지통으로 옮겨요. Homebrew: `brew uninstall playpets` |
| Windows 스토어, winget | 설정 > 앱에서 PlayPets를 제거하거나 `winget uninstall --id 9NSKXQ6R187M` |
| Windows 설치 파일 | 설정 > 앱에서 PlayPets를 제거해요 |
| Linux deb | 설치할 때 쓴 패키지 관리자로 제거해요 |
| Linux AppImage | 파일을 지워요 |

- 앱을 지워도 아래 데이터 폴더는 남아요.
- 스토어, winget: 앱을 지우면 Windows가 패키지 데이터도 함께 지워요.
- 설정과 가져온 펫까지 모두 지우려면 데이터 폴더도 지워 주세요.

## 데이터 폴더 <Since v="0.1.0" />

| 운영체제 | 위치 |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\`. 스토어, winget: 패키지 전용 폴더 안 |
| Linux | `~/.local/share/app.playpets/` |

| 안에 있는 것 | 내용 |
|---|---|
| `state.json` | 친구와 설정 |
| `bridge.json` | 에이전트 연동용 포트와 토큰 |
| `pets/` | 가져온 펫 |
| `builtin/` | 기본 펫 네 개 |

- 다른 곳에 두려면 환경 변수 `PLAYPETS_DATA`에 폴더 경로를 넣고 앱을 실행해요. 자세한 내용은 [설정](./settings.md)에 있어요.
