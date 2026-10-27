# Decision: Lead with "a yard where your pets talk to each other", and treat Codex pet compatibility and hook reactions as the price of entry

## Context
Before launch (2026-10-05), we looked at open-source desktop pet apps that react to coding agents, and at pixel-office style agent dashboards. Many pet apps already let people use the Codex pet format without Codex, and they generally receive agent status through hooks, so those two features are common ground rather than something that sets PlayPets apart. What we did not find elsewhere in that survey was the combination PlayPets has: a subscription CLI or Ollama connected to each pet for chat, pets talking to each other in turn through an LLM, and a yard where weather and time pass alongside a desktop mode. Until then the first line was "Codex pets, now outside Codex too" ("Codex 펫, 이제 Codex 밖에서도").

## Decision
- The first line is "A yard where your pets talk to each other" (Korean: "서로 이야기하는 펫들의 놀이터"). The site's first screen, the README, the share card and launch posts all start with this line.
- The three things we lead with are ① each friend chats with its own AI, ② friends talk to each other in turn, ③ the yard and the desktop. Codex pet format compatibility, multiple pets and hook reactions go after, stated only as facts. The comparison table says agent reactions are the same as in other apps.
- We do not use the word "office". Instead we call them "friends at work", and add a way to pick the friend each agent reports to (the "Reports to" setting in the Settings tab, `--pet` in the copied settings).
- We do not name the app, the domain or badges after Codex pets. Codex appears only in descriptions, such as "compatible with the Codex pet format".
- Pets talking to each other is shown as moving pictures, not text. The screenshot script captures a conversation scene between three friends and puts it in the README GIF.

## Consequences
- Positive: The first line describes what PlayPets does that a status indicator does not. What it leads with (chat, the yard) is also the part that takes the most work to build.
- Negative: For "people who collect Codex pets", the first line lands a beat late. For them, the first line of the body says "all 10,000 Codex pets, as they are".
- Neutral: Users who only want a status indicator will find other apps lighter and broader. We do not target them.

## Alternatives considered
| Alternative | Why rejected |
|---|---|
| Keep "Codex pets, now outside Codex too" | Many apps could say the same thing. It would put the common ground first instead of what PlayPets adds |
| Switch to the pixel-office agent dashboard angle | The office group is session-centered and moving toward command features. PlayPets friends are permanent companions and do not send prompts. Borrowing the name would set the wrong expectations |
| Compete on the number of supported agents | Some apps already support more than 20 agents. A longer list adds little for the person using the app |

## Follow-up (2026-10-28)
- The first line now leads with Codex pets: "Your Codex pets, together in one yard" on the site, "Your Codex pets, together on your desktop" in the README and page titles.
- Why: many apps play Codex pets, so the word alone does not set PlayPets apart, but it is what people search for and what answer engines match. Naming the format first and the difference right after reaches Codex pet collectors without hiding what PlayPets adds.
- The difference is stated as checkable facts: the ChatGPT desktop app shows the one pet you pick ([OpenAI's guide](https://learn.chatgpt.com/docs/pets); a request for several pets, [openai/codex#35577](https://github.com/openai/codex/issues/35577), is open), while PlayPets plays up to 12 that talk to each other and react to several coding agents.
- PlayPets is shown as company for the ChatGPT app's pet, not a replacement: keep one pet there and bring the whole group, other coding agents included, to PlayPets.
- "More motions" is said only as what is true: pet files keep Codex's nine actions and sixteen look directions; the four starter pets add digging, planting, fishing and seasonal outfits.
- Still true: the app, the domain and badges are not named after Codex pets. The landing says once that Codex is OpenAI's trademark and PlayPets is independent; the README keeps its trademark line.

## Follow-up: OpenAI's own names (2026-10-28)

- OpenAI's guide calls the feature Pets and a made one a custom pet; it never says "Codex pet". The site keeps "Codex pet" as the name people search for and says once, in the FAQ, what it means.
- The Codex column of the features table repeats only what that guide says: a sprite sheet made with the hatch-pet skill or uploaded, the Running, Needs input, Ready and Blocked states, starting a chat, and following ChatGPT and Codex threads.
- The guide's custom sheet is 1536 × 1872 with no look directions, so the sixteen look directions are claimed only for sheets that have them.
- ChatGPT is named with Codex wherever the trademark line appears on the site and in the README.
