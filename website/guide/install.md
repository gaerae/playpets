---
description: 운영체제별 설치 파일 고르기, 처음 실행할 때 뜨는 경고, 업데이트와 데이터 폴더
---

# 설치하기

설치 파일은 [GitHub 릴리스](https://github.com/gaerae/playpets/releases/latest)에서 받아요. 파일 이름은 `PlayPets_버전_운영체제.확장자` 꼴이에요.

::: warning 처음 실행할 때 경고가 떠요
지금 배포 파일에는 코드 서명이 없어요. 그래서 macOS의 Gatekeeper와 Windows의 SmartScreen이 처음 실행을 한 번 막아요. 앱의 문제가 아니라 서명이 없어서 나는 경고예요. 서명은 계획에 있고, 준비되면 이 안내도 바뀌어요. 아래 운영체제별 설명대로 지나가면 돼요.
:::

## macOS <Since v="0.1.0" />

| 파일 | 대상 |
|---|---|
| `PlayPets_버전_macos-universal.dmg` | Apple Silicon과 Intel 모두 |

1. dmg를 열고 PlayPets를 응용 프로그램 폴더로 끌어 놓아요.
2. PlayPets를 한 번 열어요. "확인되지 않은 개발자" 또는 "열 수 없습니다" 안내가 뜨고 닫혀요.
3. 시스템 설정 > 개인정보 보호 및 보안으로 가요. 아래쪽에 PlayPets에 대한 안내와 **그래도 열기** 버튼이 있어요.
4. **그래도 열기**를 누르고 비밀번호나 Touch ID로 확인해요. 다음부터는 바로 열려요.

macOS 15부터는 Control 키를 누른 채 여는 방법이 없어져서, 시스템 설정까지 가야 해요.

## Windows <Since v="0.1.0" />

| 파일 | 대상 |
|---|---|
| `PlayPets_버전_windows-x64-setup.exe` | 일반 PC(x64) 설치 파일 |
| `PlayPets_버전_windows-arm64-setup.exe` | ARM PC 설치 파일 |
| `PlayPets_버전_windows-x64-portable.zip`, `…_windows-arm64-portable.zip` | 설치 없이 풀어서 실행 |

1. 설치 파일을 실행해요. SmartScreen이 "Windows의 PC 보호" 창을 띄워요.
2. **추가 정보**를 눌러요. 그러면 **실행** 버튼이 나타나요.
3. **실행**을 누르고 설치 과정을 따라가요.

포터블 zip은 원하는 폴더에 풀고 `playpets.exe`를 실행하면 돼요. 이때도 SmartScreen 경고는 같은 방법으로 지나가요.

::: tip
Windows 빌드는 실제 기기에서 아직 충분히 확인하지 않았어요. 이상한 점이 보이면 [GitHub 이슈](https://github.com/gaerae/playpets/issues)로 알려 주세요.
:::

## Linux <Since v="0.1.0" />

| 파일 | 대상 |
|---|---|
| `PlayPets_버전_linux-x64.deb`, `…_linux-arm64.deb` | Debian, Ubuntu 계열 |
| `PlayPets_버전_linux-x64.AppImage`, `…_linux-arm64.AppImage` | 배포판 가리지 않고 실행 |

deb는 패키지 관리자로 설치해요. AppImage는 실행 권한을 주고 바로 실행해요.

```sh
chmod +x PlayPets_*.AppImage
./PlayPets_*.AppImage
```

::: tip Linux에서 알아 둘 것
- AppImage는 FUSE 2가 필요해요. Ubuntu 22.04부터는 기본으로 없어서 `sudo apt install libfuse2`를 한 번 하거나, `./PlayPets_*.AppImage --appimage-extract-and-run`으로 실행해요.
- 창을 닫으면 앱은 트레이에 남아요. GNOME은 트레이 아이콘을 기본으로 보여 주지 않으니 "AppIndicator and KStatusNotifierItem Support" 확장을 켜 주세요. 아이콘이 안 보여도 앱을 다시 실행하면 놀이터 창이 돌아와요.
- API 키는 Secret Service(GNOME Keyring, KWallet)에 저장해요. 없는 환경에서는 키가 필요한 연결을 저장할 때 보안 저장소에 접근할 수 없다는 안내가 떠요. Ollama와 구독 CLI는 키가 없어서 상관없어요.
:::

## 업데이트 <Since v="0.1.0" />

- 설정 탭의 **앱 업데이트**에서 **업데이트 확인**을 누르면 지금 확인해요. 새 버전이 있으면 **설치하고 다시 시작** 버튼으로 바뀌어요.
- 앱이 시작한 뒤 20초가 지나면 한 번 조용히 확인해요. 새 버전이 있으면 알림이 뜨고, 설정 탭에서 설치할 수 있어요.
- 새 버전은 GitHub 릴리스의 `latest.json`에서 찾아요. 받은 파일은 업데이트 서명 키로 검증한 뒤에만 설치해요. 검증에 실패한 파일은 설치하지 않아요.
- Windows 포터블 zip은 자동 업데이트 대상이 아니에요. 새 zip을 받아 바꿔 주세요.

## 제거

| 운영체제 | 방법 |
|---|---|
| macOS | 응용 프로그램 폴더의 PlayPets를 휴지통으로 옮겨요 |
| Windows 설치 파일 | 설정 > 앱에서 PlayPets를 제거해요 |
| Windows 포터블 | 풀어 둔 폴더를 지워요 |
| Linux deb | 설치할 때 쓴 패키지 관리자로 제거해요 |
| Linux AppImage | 파일을 지워요 |

앱을 지워도 아래 데이터 폴더는 남아요. 설정과 가져온 펫까지 모두 지우려면 데이터 폴더도 함께 지워 주세요.

## 데이터 폴더 <Since v="0.1.0" />

| 운영체제 | 위치 |
|---|---|
| macOS | `~/Library/Application Support/app.playpets/` |
| Windows | `%APPDATA%\app.playpets\` |
| Linux | `~/.local/share/app.playpets/` |

안에는 `state.json`(친구와 설정), `bridge.json`(에이전트 연동용 포트와 토큰), `pets/`(가져온 펫), `builtin/`(기본 펫 세 마리)가 있어요. 다른 곳에 두고 싶으면 환경 변수 `PLAYPETS_DATA`에 폴더 경로를 넣고 앱을 실행하면 돼요. 자세한 내용은 [설정](./settings.md)에 있어요.
