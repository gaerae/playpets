---
description: 코딩 에이전트가 일하는 모습을 친구가 따라 하게 하는 설정, 터미널 명령, 보안 안내
---

# 코딩 에이전트 연동

Claude Code, Codex CLI, Gemini CLI, Cursor, Grok Build 같은 코딩 에이전트가 일하면 친구도 옆에서 같이 반응해요. 설정 한 조각을 복사해 붙여 넣으면 끝이고, Node.js는 없어도 돼요.

## 친구마다 담당 에이전트 <Since v="0.1.0" />

1. **설정 → 코딩 도구 연결**에서 도구마다 있는 **담당 친구**를 골라요.
2. **설정 복사**를 다시 눌러 붙여 넣어요.

복사한 설정에는 그 친구가 적혀요(`--pet`). Claude Code는 Clover가, Codex는 Pip가 맡는 식으로 나눠 맡길 수 있어요. 아무도 고르지 않으면("정하지 않음, 첫 친구가 반응해요") 첫 친구가 받고, 담당 친구를 내보냈을 때도 첫 친구에게 돌아가요.

친구마다 다른 에이전트를 맡기면 놀이터가 누가 지금 무슨 일을 하는지 보여 주는 현황판이 돼요.

## 여러 에이전트를 한꺼번에

- 친구마다 자기 에이전트만 보여 줘요. 상태 점, 이름표, 바탕화면 말풍선이 친구마다 따로예요.
- 친구에게 "뭐 하고 있었어?"라고 물으면 자기 에이전트가 최근에 한 일만 알려 줘요.

| 에이전트 | 친구 | 보이는 것 |
|---|---|---|
| Claude Code | Clover | 파일을 고치는 동안 일하는 중 |
| Codex CLI | Pip | 답이 끝나면 작업 완료 |
| Gemini CLI | Daisy | 확인을 기다릴 때 답을 기다리는 중 |
| Cursor | Miso | 명령을 실행하는 동안 일하는 중 |

### 같은 에이전트를 두 세션에서

1. **설정 → 코딩 도구 연결**에서 그 도구의 **담당 친구**를 비워 두고 설정을 복사해 붙여 넣어요.
2. 세션마다 맡을 친구를 정해 시작해요.

```bash
PLAYPETS_PET=Clover claude
PLAYPETS_PET=Pip claude
```

- PowerShell에서는 `$env:PLAYPETS_PET="Clover"; claude`처럼 써요.
- `PLAYPETS_PET`에는 `--pet`처럼 친구 이름이나 ID를 넣어요.
- **담당 친구**를 고르면 설정에 그 친구가 적히고(`--pet`), `PLAYPETS_PET`보다 먼저 쓰여요.
- 터미널에서 시작하는 Claude Code, Codex CLI, Gemini CLI, Grok Build에서 돼요. Cursor는 Cursor 앱이 훅을 실행하니 친구 하나에게만 알려요.

## 놀이터에서 보이는 것 <Since v="0.1.0" />

담당 에이전트가 있는 친구는 이름표에 에이전트 이름이 작게 붙어요(Clover, Claude Code). 친구 화면에서는 이름 아래 칩에도 나와요. 친구 머리 옆의 작은 점은 에이전트 상태예요. 마우스를 올리면 이름이 보여요.

| 점 | 상태 | 사라지는 때 |
|---|---|---|
| 주황, 깜빡임 | 일하는 중 | 에이전트가 다시 알릴 때까지 남아요 |
| 파랑 | 기다리는 중 | 에이전트가 다시 알릴 때까지 남아요 |
| 초록 | 끝남 | 30분 뒤 |
| 빨강 | 문제가 생김 | 30분 뒤 |

친구 화면의 상태 알약도 에이전트 상태를 보여 줘요. 대화 답은 대화창에 나와요.

## 무엇이 일어나나요 <Since v="0.1.0" />

에이전트가 한 단계씩 나아갈 때마다 친구의 상태도 바뀌어요. 상태는 친구 화면의 이름 옆과 놀이터 이름표에 보이고, 바탕화면에서는 친구 위에 말풍선으로 떠요.

| 에이전트가 하는 일 | 친구의 상태 |
|---|---|
| 생각 중, 도구 사용(예: "Bash 사용 중") | 일하는 중 |
| 확인이나 답을 기다림 | 답을 기다리는 중 |
| 작업을 마침 | 작업 완료 |
| 오류가 남 | 문제가 생겼어요 |
| 세션이 끝남 | 쉬는 중 |

친구는 최근 활동을 8개까지 기억해요. [대화](./chat.md)에서 "뭐 하고 있었어?" 하고 물어보면 이야기해 줘요.

## 설정 복사해 붙이기 <Since v="0.1.0" />

<Shot name="settings-agents" caption="설정 → 코딩 도구 연결. 도구마다 설정 복사 버튼이 있어요." />

1. **친구와 설정 → 설정 → 코딩 도구 연결**을 열어요.
2. 쓰는 도구 옆의 **설정 복사**를 눌러요. 어느 파일에 붙일지 알림이 알려 줘요.
3. 그 파일을 열어 붙여 넣고 저장해요. 에이전트를 다시 시작하면 바로 이어져요.

| 도구 | 붙여 넣을 곳 | 동작 |
|---|---|---|
| Claude Code (추천) | `~/.claude/settings.json` | 훅으로 단계마다 알려 줘요 |
| Codex CLI | `~/.codex/config.toml` 맨 위 | 작업이 끝날 때 알려 줘요 |
| Gemini CLI | `~/.gemini/settings.json` | 훅으로 단계마다 알려 줘요 |
| Cursor | `~/.cursor/hooks.json` | 편집, 명령, 완료를 알려 줘요. 관찰용 훅만 써요 |
| Grok Build | `~/.grok/hooks/playpets.json`, 새 파일로 저장 | 훅으로 단계마다 알려 줘요 |
| 그 밖의 MCP 도구 | 도구의 MCP 설정 | AI가 `set_pet_state`, `say`, `react`, `list_pets` 도구로 직접 상태와 말풍선을 보내요 |

- 복사한 조각에는 PlayPets 실행 파일 경로가 들어 있어요.
- 이 실행 파일이 곧 연동 명령이라 따로 설치할 게 없어요.
- 앱을 다른 곳으로 옮겼다면 설정을 다시 복사해 붙여 넣어요.
- 파일에 `hooks`나 `mcpServers` 항목이 이미 있으면 그 항목 안에 조각을 합쳐 넣어요.
- Grok Build는 Claude Code와 Cursor의 훅도 함께 실행해요. 그래도 Grok Build의 작업은 Grok Build 친구에게만 보여요.

## 터미널에서 직접 <Since v="0.1.0" />

같은 실행 파일을 터미널에서 불러 친구에게 말을 걸 수도 있어요. 아래 `playpets`는 앱 실행 파일이에요. macOS에서는 `/Applications/PlayPets.app/Contents/MacOS/playpets`예요.

```
playpets hook claude|gemini|cursor|grok   # 훅 (stdin JSON, 항상 종료 코드 0; Gemini, Cursor에는 {} 출력)
playpets hook codex <json>      # Codex notify
playpets mcp                    # MCP stdio 서버
playpets status <상태> [메시지]   [--pet 이름|ID] [--bridge 파일]
playpets say <말>
playpets react <동작>
playpets pets
playpets run -- <명령>
```

| 명령 | 하는 일 |
|---|---|
| `playpets pets` | 친구 목록과 지금 상태 |
| `playpets say "테스트 통과"` | 상태는 그대로 두고 말풍선만 띄워요 |
| `playpets status working "빌드 중"` | 상태를 바꿔요. `idle`, `working`, `waiting`, `done`, `error` 중 하나 |
| `playpets react wave` | 한 번 반응해요. `wave`, `jump`, `pet` 중 하나 |
| `playpets run -- npm test` | 명령이 도는 동안 "일하는 중", 끝나면 "작업 완료" 또는 "문제가 생겼어요" |

- 특정 친구에게 보내려면 `--pet 이름`이나 `--pet 친구ID`를 붙여요. 붙이지 않으면 첫 친구에게 가요.
- 친구 ID는 친구 설정 창 맨 아래에 있어요.

## 보안 <Since v="0.1.0" />

- 연동은 이 컴퓨터 안에서만 오가요.
  - 앱이 `127.0.0.1`에 임의의 포트를 열고, 요청마다 무작위 토큰을 확인해요.
  - 포트와 토큰은 데이터 폴더의 `bridge.json`에 있고, 앱을 다시 켤 때마다 바뀌어요.
- [코딩 에이전트 연동](./agents.md)은 사용자 프롬프트와 도구 입력을 빼고 보내요. 로컬 연결은 `127.0.0.1`과 토큰 인증을 써요.
- 짧은 완료 보고나 알림에는 에이전트 답변 일부 같은 작업 내용이 들어갈 수 있어요. 이 내용은 친구와 대화할 때 고른 AI에 전해질 수 있어요.
  - 터미널이나 MCP로 보내는 메시지는 한 번 확인해 주세요.
  - 이런 내용을 컴퓨터 밖으로 내보내고 싶지 않다면 내려받은 로컬 모델을 쓰세요.
- 훅은 에이전트의 작업을 막지 않아요. 3초 안에 조용히 끝나고, 앱이 꺼져 있어도 에이전트는 그대로 돌아가요.
- 대화용 AI 연결과는 별개예요. 연동만 해서는 친구와 대화할 수 없어요.
- 자세한 구조는 개발자 문서 [코딩 에이전트 연동](/dev/agent-integration)에 있어요.

## Windows에서 주의할 점

- 로컬에서 만든 시험용 MSIX 패키지로 설치했다면 실행 파일이 `WindowsApps` 아래에 있어서 경로로 부를 수 없어요. 그래서 복사되는 설정은 실행 별칭 `%LOCALAPPDATA%\Microsoft\WindowsApps\playpets.exe`를 가리켜요.
- npm으로 설치한 `claude`, `codex`는 `%APPDATA%\npm`에 있어야 앱이 찾아요. 다른 곳에 설치했다면 자동으로 못 찾을 수도 있어요.
