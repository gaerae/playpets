# [Research] Where does PlayPets fit among open-source desktop pets and pixel-office agent dashboards?

## Question
In 2026 there was a flood of desktop pet projects that react to coding agents, and of projects that draw agents as staff in an office. Among them, we looked at what is actually different about PlayPets, what we claim is different when it is not, and who we should go after as our first users. The research date is 2026-10-05, and star counts and last-activity dates are the values read from the GitHub API that day. The survey of site layouts done on the same day is in "[How do open-source desktop apps lay out their public websites?](oss-desktop-app-websites.md)".

## Findings
### Desktop pets and the Codex pet ecosystem
| Name | In one line | Tech | Stars | Last activity | Pet format | At once | Agents it reacts to | Chat with the pet | Pets with each other |
|---|---|---|---|---|---|---|---|---|---|
| [Codex pets (OpenAI, official)](https://learn.chatgpt.com/docs/pets) | Companion that appears in the Codex app, web and CLI | Built into Codex | – | Launched 2026-05 | The original. The format is written down only in the [hatch-pet skill](https://github.com/openai/skills/blob/main/skills/.curated/hatch-pet/SKILL.md) | 1 | Codex | None | None |
| [OpenPets (OpenPetsHQ)](https://github.com/OpenPetsHQ/openpets) | Companion platform with a plugin SDK | Electron | 1,261 | 2026-09-27 | Own format | Multiple instances | Claude Code, OpenCode, Cursor, MCP | Plugins can call `ctx.ai` | None |
| [OpenPets (alterhq)](https://github.com/alterhq/openpets) + [openpets.sh](https://openpets.sh/) | One macOS pet and the largest registry | Swift | 98 | 2026-05-14, stopped | Codex format | 1 | MCP, CLI | None | None |
| [OpenPet (X-T-E-R)](https://github.com/X-T-E-R/OpenPet) | Codex-compatible local runtime | Tauri | 57 | 2026-05-06 | Codex format | 1 active | CLI, MCP, HTTP | None | None |
| [Clawd on Desk](https://github.com/rullerzhou-afk/clawd-on-desk) | A pixel crab watches your agents | Electron | 6,365 | 2026-10-05 | 3 of its own + Codex pet zip | 1 | 20+ (hooks) | None | None |
| [CoPet](https://github.com/ChanceYu/CoPet) | A companion for every agent | Tauri | 34 | 2026-07-15 | Codex-compatible, 20+ built in | 1 active | 8 (hooks) | None | None |
| [Petdex](https://github.com/crafter-station/petdex) ([petdex.dev](https://petdex.dev/)) | Gallery of 4,869+ pets and a desktop app | Native + Zig hook server | 4,198 | 2026-09-28 | Codex format, also accepts v2 8×11 | 1 active | 6, including Codex, Claude Code, Gemini CLI | None | None |
| [AgentPet](https://github.com/ntd4996/agentpet) | Grows and levels up as it watches agents | Swift + Tauri | 376 | 2026-09-30 | Codex pet packs | Several, per project | 11+ | Speech bubbles only | None |
| [pets-driven](https://github.com/young1the/pets-driven) | Korean README, Windows only | Tauri | 1 | 2026-09-22 | Petdex assets | 1 per directory | Claude Code, Codex | None | Scripted scenes |
| [multi-codex-pets](https://github.com/anthnykr/multi-codex-pets) | Several Codex pets roam the screen | Swift | 15 | 2026-05-05 | Codex format | Several | None | None | None |
| [vibebud](https://github.com/Shellishack/vibebud) | Floating AI buddies that form a team when placed close together | Electron | 72 | 2026-05-02, stopped | Own | Several | Codex, Claude Code | Yes (API key) | Shared prompt |
| [claude-code-pet](https://github.com/zzp1221/claude-code-pet), [Clyde](https://github.com/QingJ01/Clyde), [code-pet](https://github.com/Xiaooolong/code-pet), [claude-pet](https://github.com/IMMINJU/claude-pet) | Single pets that receive status through hooks | Tauri | 9–143 | 2026-03 to 05 | Own or Codex | 1 | Mostly Claude Code | None | None |
| [WindowPet](https://github.com/SeakMengs/WindowPet) | Overlay with unlimited pets | Tauri | 670 | 2025-04, stopped | 45+ of its own | Unlimited | None | None | None |
| [BongoCat](https://github.com/ayangweb/BongoCat) | Live2D cat that reacts to input | Tauri | 23,795 | 2026-10-03 | Live2D | 1 | None | None | None |
| [vscode-pets](https://github.com/tonybaloney/vscode-pets) | Pets inside the editor | VS Code | 4,175 | 2026-10-03 | Own | Several | None | None | None |
| Galleries: [codexpet.top](https://github.com/legeling/awesome-codex-pet) (Korean docs, assets CC BY-NC), [Codex PokéPets](https://github.com/dnnyngyen/codex-pokepets), [codex-pets.net](https://github.com/portons/codex-pet-share) (multiplayer playroom), [full index](https://github.com/alterhq/awesome-codex-pets-projects) | Making and sharing pets | Web | 134–1,060 | 2026-09 to 10 | Codex format | – | – | – | – |

### Pixel-office agent dashboards and agent character visualizations
| Name | In one line | Platform | Stars | Last activity | Agents it reacts to | Chat with characters | Characters with each other |
|---|---|---|---|---|---|---|---|
| [Pixel Agents](https://github.com/pixel-agents-hq/pixel-agents) | A pixel employee for every Claude Code session | VS Code extension, `npx` | 9,514 | 2026-09-21 | Claude Code only | None | None |
| [claude-office (paulrobello)](https://github.com/paulrobello/claude-office) | A boss and staff in a multi-floor building | Web | 548 | 2026-09-14 | Claude Code | Speech bubbles | Delegation scenes |
| [Claude-Office (W17ant)](https://github.com/W17ant/Claude-Office) | 27 sitcom-themed characters and office chat | Web | 196 | 2026-04-16 | Claude Code hooks | Yes (Claude CLI) | Chat panel |
| [agent-virtual-office](https://github.com/KbWen/agent-virtual-office) | 8 roles, tea breaks and squabbles | Browser | 35 | 2026-10-02 | Claude Code hooks, HTTP | None | Scripted scenes |
| [pixel-office (MaoEmong)](https://github.com/MaoEmong/pixel-office), [Pixel-Agent-Office-IDE](https://github.com/sunsangnim/Pixel-Agent-Office-IDE), [claude-office (when630)](https://github.com/when630/claude-office) | Korean offices that add command features and staged scenes | Windows, Electron | 0–2 | 2026-09 to 10 | Claude, Codex CLI | Some | Some |
| [agent-visualiser](https://github.com/JoelHutchinson/agent-visualiser) | An office fed by OpenTelemetry | Browser | 0 | 2026-09-29 | Claude, OTLP | None | None |
| OpenClaw office group ([agent-monitor](https://github.com/ruiqili2/agent-monitor) and others) | OpenClaw only | Web | 2–56 | 2026-03 to 07 | OpenClaw | Some | None |
| [ChatDev](https://github.com/OpenBMB/ChatDev), [MetaGPT](https://github.com/FoundationAgents/MetaGPT) | Frameworks for a virtual software company. ChatDev 2.0 dropped the office metaphor | Python | 34k, 70k | 2026-01 to 07 | Their own | – | Between roles |
| [AI Town](https://github.com/a16z-infra/ai-town), [Generative Agents](https://github.com/joonspk-research/generative_agents) | Simulations of a town where characters live | Web | 10.6k, 22k | 2026-08, 2024-08 dormant | Not applicable | Yes | Yes (real LLM conversation) |

### What each group competes on
- **The pet group is a status indicator.** Following the four states of the official Codex pets, the basic form is "receive status through hooks and change what one pet does", and in the two months from March to May 2026 more than eight repositories built the same thing in Tauri. This axis is already a commodity.
- **Galleries handle pet distribution.** There are seven or more galleries, and Petdex alone has 4,869 pets. There is no reason to build yet another gallery; consuming all of them is the right move.
- **What is missing in the pet group:** Only three apps let you chat with the pet, and all of them stopped at API keys or have no stars. Some have several pets, but none has pets actually talking to each other through an LLM. The pet group has no space where weather and time pass; the office group took all of the space.
- **The office group visualizes session structure.** It shows "how many sessions are running, which are subagents, and which are waiting for my input". Pixel Agents is the standard, and it is limited to Claude Code and VS Code. There are more than ten clones, so it is more saturated than the pet group. Recent differentiation goes three ways: command (command bars, delegation), staging (tea breaks, chases) and standard ingestion (OpenTelemetry).
- **From the simulation group**, the one thing to take is a proven appeal: "when characters talk to each other through an LLM, people watch".

### Where PlayPets differs and where it does not
| Axis | Really different? | Closest |
|---|---|---|
| The Codex pet format without Codex | No. More than ten apps already do it. It is the price of entry, not a differentiator | Petdex desktop, CoPet |
| Several pets on one screen | Partly. Only AgentPet also overlaps on agent reactions and cross-platform support | AgentPet |
| Each pet chats with its own AI | Yes. PlayPets is the only one confirmed to use subscription CLIs (Claude Code, Codex) as the chat backend for pets, and to give each pet a different backend | vibebud (stopped) |
| Pets talking to each other | Yes. No pet continues a conversation through an LLM. It has to be shown so it is not mistaken for scripted scenes | vibebud team mode, AI Town |
| Both a yard (weather, time, games) and roaming the desktop | Yes. The pet group has no space and the office group has no roaming | Pixel Agents for space, Clawd on Desk for roaming |
| Agent reactions | No. Everyone does it, and Clawd on Desk (20+) and CoPet (8) cover more. Petdex and OpenPets also say "does not send your prompts or code" | Clawd on Desk, CoPet |
| Korean first | Yes, but small. The seven projects with a Korean README all have 0 to 12 stars and support a single OS. Only PlayPets does three languages and three OSes | pets-driven, Hoo |

### The pixel-office angle
It is possible, but we should not take the name. The office group is session-centered: a desk appears when a session starts and disappears when it ends. A PlayPets friend is a permanent companion the user invited, and hooks go to a specific friend. Spawning pets automatically, one per session, would break the identity of a "friend". Also, recent office projects are moving toward command features, so calling ourselves an office would make users expect those. Instead, we can absorb one core value of the office group with what we already have. If each friend has an agent it is in charge of (Tabby on Claude Code, Smoky on Codex, Mochi on Gemini), the yard becomes a status board, and answering when you ask "What were you up to?" is something Pixel Agents cannot do. Not an office, but "friends at work".

### Risks
1. **Changes to the Codex format.** The official docs give only 1536×1872, and the row layout appears only in the hatch-pet skill. It is a contract of the current app, not a spec. Keep the loader flexible on the number of rows and test both 8×9 and 8×11 (this is how it works now).
2. **The "Codex" trademark.** [OpenAI has filed for the Codex trademark](https://www.trademarkia.com/news/technology/openai-files-codex-trademark), and its [brand guidelines](https://openai.com/brand/) restrict use of product names. A description such as "compatible with the Codex pet format" is fine, but do not name the app, the domain or badges after Codex pets.
3. **Large projects catch up.** OpenPets already has multiple instances and `ctx.ai`, so a single plugin could catch up on the chat axis, and Clawd on Desk only needs to add multiple pets. What we have to defend is what is structurally different and expensive to copy, such as "friends talking to each other" and "the yard".
4. **Asset licenses.** codexpet.top assets are CC BY-NC 4.0, and PokéPets are for fan use only. Users importing them is fine, but we do not use them for the starter pets, screenshots or promotion. Keeping the three starter pets as our own MIT work was the right call.

### Limits of this research
- It was read over one day, and star counts and activity dates are that day's values.
- The detailed behavior of the official Codex pets was seen only through docs and press coverage.
- Judgments such as "maintained by one person" or "stopped" are based on the date of the last push.

## Conclusion and recommendations
**The current first line, "Codex pets, now outside Codex too", is something more than ten competitors could say just as well.** Three things, each a single feature, are done only by PlayPets: connecting a subscription CLI or Ollama to each pet for chat, pets talking to each other in turn through an LLM, and moving between a yard with weather and the desktop. The pitch should lead with these three and list Codex format compatibility, multiple pets and hook reactions further back, as the price of entry.

- Recommended line (ko): "Codex 펫 1만 마리가 사는 놀이터. 친구마다 다른 AI로 말하고, 서로 이야기하고, 어느 코딩 에이전트든 곁에서 함께 일해요. Codex는 없어도 돼요."
- Recommended line (en): "A yard where every Codex pet can live. Each friend talks with its own AI, friends talk to each other, and any coding agent has company. No Codex required."
- Do not use the word "office"; go with "friends at work". Describe in the guide how to give each friend an agent it is in charge of.
- Users to win first: ① Petdex users (bring out all the pets you collected at once), ② Clawd on Desk users (add friends next to Clawd), ③ Windows and Linux users of openpets.sh (that app is macOS only and has stopped), ④ Pixel Agents users who need something beyond VS Code and Claude Code (it keeps going on the desktop after the editor is closed), ⑤ people who have tried Korean pet projects (pets-driven, Hoo, when630) (Korean-native and runs on three OSes). WindowPet and BongoCat users are put last because the message does not fit them.
- Pets talking to each other must be shown in a demo GIF. In text, it cannot be told apart from scripted scenes.
