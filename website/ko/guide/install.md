---
description: 운영체제별 설치 파일 고르기, 처음 실행할 때 뜨는 경고, 업데이트와 데이터 폴더
---

# 설치하기

설치 파일은 [GitHub 릴리스](https://github.com/gaerae/playpets/releases/latest)에서 받아요. 파일 이름은 `PlayPets_버전_운영체제.확장자` 꼴이에요.

::: warning macOS와 Windows에서 실행 경고가 뜰 수 있어요
지금 배포 파일에는 코드 서명이 없고, macOS 앱에는 공증도 없어요. Gatekeeper나 SmartScreen이 경고하거나 실행을 막을 수 있어요. 이 검사만으로 파일이 안전하다고 확인되는 것은 아니에요. 공식 릴리스 페이지에서 받은 파일을 신뢰할 때만 계속해 주세요. 쓸 수 있는 버튼은 운영체제와 기기 정책에 따라 달라요. 서명은 계획에 있어요.
:::

## macOS <Since v="0.1.0" />

| 파일 | 대상 |
|---|---|
| `PlayPets_버전_macos-universal.dmg` | Apple Silicon과 Intel 모두 |

1. dmg를 열고 PlayPets를 응용 프로그램 폴더로 끌어 놓아요.
2. PlayPets를 열어 봐요. 개발자를 확인할 수 없거나 앱을 검증할 수 없다는 안내가 뜨면 닫아요.
3. 시스템 설정 > 개인정보 보호 및 보안으로 가서 PlayPets에 대한 안내와 **그래도 열기**를 찾아요.
4. 그 버튼이 있고 받은 파일을 신뢰한다면 **그래도 열기**를 눌러요. 인증을 요청하면 확인하고, 다음 안내에서 **열기**를 눌러요. macOS가 이 앱을 예외로 저장해요.

이 순서는 [Apple의 안전하게 앱 열기 안내](https://support.apple.com/en-us/102445)를 따라요. 컴퓨터를 손상시킨다는 경고가 뜨면 개발자를 확인할 수 없다는 경고와 같은 경우로 다루지 마세요. 관리되는 기기에서는 앱 실행이 제한될 수 있어요.

## Windows <Since v="0.1.0" />

| 파일 | 대상 |
|---|---|
| `PlayPets_버전_windows-x64-setup.exe` | 일반 PC(x64) 설치 파일 |
| `PlayPets_버전_windows-arm64-setup.exe` | ARM PC 설치 파일 |

1. 설치 파일을 실행해요. 알 수 없는 앱에 대해 SmartScreen이 "Windows의 PC 보호" 창을 띄우면 공식 릴리스 페이지에서 받은 파일인지 확인해요.
2. 받은 파일을 신뢰한다면 **추가 정보**를 눌러 쓸 수 있는 선택지를 봐요.
3. **실행** 버튼이 있다면 눌러 설치를 이어 가요. 버튼이 없으면 기기의 보안 설정이나 조직 정책으로 실행이 제한된 것일 수 있어요.
4. 언어 선택 창에서 한국어, 영어, 일본어, 중국어 간체 중 하나를 고르고 설치를 진행해요.

SmartScreen은 파일과 게시자의 평판을 확인하므로 새 버전에서 다시 경고할 수 있어요. 자세한 내용은 [Microsoft의 SmartScreen 평판 안내](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation)에 있어요. 보안 기능은 켜 두세요. 악성 프로그램 경고는 알 수 없는 앱 경고와 다른 경우예요.

ARM PC(스냅드래곤 등)에서는 arm64 파일을 쓰세요. x64 파일도 에뮬레이션으로 돌아가지만, 그 설치, 제거 프로그램은 실행 중인 PlayPets를 대신 닫지 못해요. 먼저 트레이에서 종료해 주세요.

::: tip
Windows 빌드는 가상 머신에서 확인했지만, 실제 기기에서는 아직 충분히 확인하지 않았어요. 이상한 점이 보이면 [GitHub 이슈](https://github.com/gaerae/playpets/issues)로 알려 주세요.
:::

## Linux <Since v="0.1.0" />

| 파일 | 대상 |
|---|---|
| `PlayPets_버전_linux-x64.deb`, `…_linux-arm64.deb` | Debian, Ubuntu 계열 |
| `PlayPets_버전_linux-x64.AppImage`, `…_linux-arm64.AppImage` | 호환되는 Linux 배포판 |

deb는 패키지 관리자로 설치해요. AppImage는 실행 권한을 주고 바로 실행해요.

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Linux에서 알아 둘 것
- AppImage는 FUSE 2가 필요해요. Ubuntu 22.04에서는 `sudo apt install libfuse2`로 설치하고, Ubuntu 24.04에서는 이름이 바뀐 패키지인 `sudo apt install libfuse2t64`를 사용해요. 다른 배포판은 [AppImage의 FUSE 안내](https://docs.appimage.org/user-guide/troubleshooting/fuse.html)를 확인해 주세요. FUSE 없이 실행하려면 `./PlayPets_*.AppImage --appimage-extract-and-run`을 사용해요.
- 창을 닫으면 앱은 트레이에 남아요. GNOME은 트레이 아이콘을 기본으로 보여 주지 않으니 "AppIndicator and KStatusNotifierItem Support" 확장을 켜 주세요. 아이콘이 안 보여도 앱을 다시 실행하면 놀이터 창이 돌아와요.
- API 키는 Secret Service(GNOME Keyring, KWallet)에 저장해요. 없는 환경에서는 키가 필요한 연결을 저장할 때 보안 저장소에 접근할 수 없다는 안내가 떠요. Ollama와 구독 CLI는 키가 없어서 상관없어요.
:::

## 업데이트 <Since v="0.1.0" />

Microsoft Store 설치본은 Store에서 업데이트해요. **Microsoft Store → 라이브러리**에서 확인해 주세요. 아래 GitHub 설치 파일 업데이트 안내는 MSIX 이외의 설치본에 해당해요. 테스트용 MSIX도 패키지 관리 방식으로 업데이트해요. 저장과 외부 통신은 [개인정보처리방침](../privacy.md)에서 확인할 수 있어요.

- **설정 → 앱 업데이트**의 **업데이트 확인**, 트레이 메뉴의 **업데이트 확인…**, macOS 메뉴 막대의 **PlayPets → 업데이트 확인…**으로 지금 확인할 수 있어요. 모두 설정의 **앱 업데이트**로 열리고, 확인 결과와 업데이트 작업을 한곳에서 볼 수 있어요.
- 새 버전이 있으면 버전 표시가 조용히 나타나고, 누르면 같은 설정 항목으로 열려요. 새로운 점을 읽고 **설치하고 다시 시작**을 고르면 다운로드, 서명 확인, 설치 후 다시 시작해요. 자동 확인만으로 설치를 시작하지는 않아요. 다운로드 중에는 설정을 닫고 계속 놀 수 있고, 작은 창에서도 진행 버튼이 남아요. 다시 열어도 다운로드를 중복 실행하지 않아요. 오류와 다시 시도도 **앱 업데이트**에서 확인할 수 있어요. 재시작 후에는 설치된 버전을 잠깐 알려 줘요.
- 앱을 시작한 뒤 20초가 지나면 조용히 확인하고, 실행 중에는 6시간마다 다시 확인해요. 확인에 실패하면 5분, 15분, 1시간 뒤에 조용히 다시 시도하고, 이후에는 6시간마다 시도해요. 확인에 성공하면 6시간 간격으로 돌아가요. 자동 확인으로 설정이 열리거나 알림이 뜨지는 않아요.
- 새 버전은 GitHub 릴리스의 `latest.json`에서 찾아요. 받은 파일은 업데이트 서명 키로 검증한 뒤에만 설치해요. 검증에 실패한 파일은 설치하지 않아요.

## 제거

| 운영체제 | 방법 |
|---|---|
| macOS | 응용 프로그램 폴더의 PlayPets를 휴지통으로 옮겨요 |
| Windows 설치 파일 | 설정 > 앱에서 PlayPets를 제거해요 |
| Linux deb | 설치할 때 쓴 패키지 관리자로 제거해요 |
| Linux AppImage | 파일을 지워요 |

앱을 지워도 아래 데이터 폴더는 남아요. 설정과 가져온 펫까지 모두 지우려면 데이터 폴더도 함께 지워 주세요.

## 데이터 폴더 <Since v="0.1.0" />

| 운영체제 | 위치 |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

안에는 `state.json`(친구와 설정), `bridge.json`(에이전트 연동용 포트와 토큰), `pets/`(가져온 펫), `builtin/`(기본 펫 네 개)가 있어요. 다른 곳에 두고 싶으면 환경 변수 `PLAYPETS_DATA`에 폴더 경로를 넣고 앱을 실행하면 돼요. 자세한 내용은 [설정](./settings.md)에 있어요.
