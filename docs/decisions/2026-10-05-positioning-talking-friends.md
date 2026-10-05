# Decision: Lead with "a yard where your pets talk to each other", and treat Codex pet compatibility and hook reactions as the price of entry

## Context
The pre-launch research "[Where does PlayPets fit among open-source desktop pets and pixel-office agent dashboards?](../reference/competitors.md)" (2026-10-05) measured 31 pet apps that react to coding agents and 18 pixel-office agent dashboards. More than ten apps already offer "use the Codex pet format without Codex", and every one of them receives agent status through hooks. On the other hand, PlayPets was the only app that connects a subscription CLI or Ollama to each pet for chat, the only one where pets talk to each other in turn through an LLM, and the only one with both a yard where weather and time pass and a desktop mode. Until then the first line was "Codex pets, now outside Codex too" ("Codex 펫, 이제 Codex 밖에서도").

## Decision
- The first line is "A yard where your pets talk to each other" (Korean: "서로 이야기하는 펫들의 놀이터"). The site's first screen, the README, the share card and launch posts all start with this line.
- The three things we lead with are ① each friend chats with its own AI, ② friends talk to each other in turn, ③ the yard and the desktop. Codex pet format compatibility, multiple pets and hook reactions go after, stated only as facts. The comparison table says agent reactions are the same as in other apps.
- We do not use the word "office". Instead we call them "friends at work", and add a way to pick the friend each agent reports to (the "Reports to" setting in the Settings tab, `--pet` in the copied settings).
- We do not name the app, the domain or badges after Codex pets. Codex appears only in descriptions, such as "compatible with the Codex pet format".
- Pets talking to each other is shown as moving pictures, not text. The screenshot script captures a conversation scene between three friends and puts it in the README GIF.

## Consequences
- Positive: We start with a line competitors cannot echo. What we have to defend (chat, the yard) matches what is structurally expensive to copy.
- Negative: For "people who collect Codex pets", the first line lands a beat late. For them, the first line of the body says "all 10,000 Codex pets, as they are".
- Neutral: Users who only want a status indicator will find other apps lighter and broader. We do not target them.

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Keep "Codex pets, now outside Codex too" | More than ten apps could say the same thing. We would be hanging the price of entry out as our sign |
| Switch to the pixel-office agent dashboard angle | The office group is session-centered and moving toward command features. PlayPets friends are permanent companions and do not send prompts. Borrowing the name would set the wrong expectations |
| Compete on the number of supported agents | Clawd on Desk supports more than 20. Hard to win and worth little |
