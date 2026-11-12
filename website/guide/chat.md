---
description: The kinds of AI a friend can chat through, how to connect one, giving a friend a personality, and chatting with several friends at once
---

# Chat with a friend

Friends play without an AI; to chat, they need one connected. Until then, the chat says "Ready to play! Connect an AI whenever you want to chat." and shows a **Connect an AI** button.

::: tip At a glance
| To | Do this | More |
|---|---|---|
| Start chatting | **Connect an AI** in the chat, or **Connect now** on the yard's starting card | [Making a connection](#making-a-connection) |
| Chat offline, with no hosted fees | Pick a downloaded local Ollama model | [Kinds of AI connections](#kinds-of-ai-connections) |
| Change how a friend talks | Write its personality, or tell it in the chat | [Setting a personality](#personality) |
| Choose who a friend is to you | The relationship chip beside its name | [Setting a relationship](#setting-a-relationship) |
| Talk with several friends | **Bring friends in** under the message box | [Chatting together](#together) |
| Hear about a coding agent's work | Ask "what were you doing?" | ["What were you doing?"](#agent-work) |
:::

<Shot name="friend-chat" caption="Chat with a friend (click its name tag). The AI and the friends who join in are at the bottom of the message box." />

## Kinds of AI connections <Since v="0.1.0" />

| Kind | How it chats | Cost and data |
|---|---|---|
| Claude Code | Uses the Claude Code signed in on this computer | Subscription sign-in uses your plan allowance; API-key sign-in uses API billing |
| Codex CLI | Uses the Codex CLI signed in on this computer | ChatGPT sign-in uses your plan allowance; API-key sign-in uses API billing |
| Ollama | Uses a model through Ollama at `http://127.0.0.1:11434` | Local models keep conversations on this computer without hosted inference fees; cloud models use their service's terms |
| OpenAI API | Connects to OpenAI with an API key | Conversations are sent to OpenAI, and API fees may apply |
| Grok API | Connects to Grok with an xAI API key | Conversations are sent to xAI, and API fees may apply |
| OpenAI-compatible server | You enter the server address yourself, and an API key if the server asks for one | Conversations are sent to that server, and fees may apply |

- The connection window shows each kind as a card that says what it needs.
- Claude Code, Codex CLI or Ollama found on this computer: its card is marked **Installed** and already picked. None found: nothing is picked, and the fields appear once you choose a card.
- API keys stay only in this computer's secure storage (macOS Keychain, Windows Credential Manager, Linux Secret Service), never in the settings file.
- Subscription sign-in has no separate API bill for CLI chat. It uses the same allowance as your other CLI work, plan limits apply, and optional purchased credits can cost extra.
- To chat offline, choose a downloaded local Ollama model. An Ollama cloud model still sends the conversation to its service.

## Making a connection <Since v="0.1.0" />

1. Open the **Friend** panel (**Friends & settings → Friends & chat**) and pick the friend. With several friends, the name turns into a list.
2. Click **Connect an AI** in the chat, or choose **＋ Connect a new AI…** from the AI list at the bottom left of the message box.
3. Pick a card under **Kind of AI**. Depending on the kind, enter the server address or API key.
4. Pick or type the **Model name**.
   - Click the field to list the models that AI offers. For a kind that needs a key or an address, enter it first.
   - Claude Code and Codex CLI: leave it empty for the default model. A short name like `sonnet` always gets the latest version.
   - Ollama and API connections need a model name.
5. Click **Save and connect**. If other friends still have no AI, the "Also use this AI for other friends without one" switch is on, so everyone can talk at once.

| Other way in | When | What happens |
|---|---|---|
| Write first | A friend has no AI yet | Press send: the connection window opens, and your message goes out once it's connected |
| **Connect now** | Claude Code or Codex CLI is on this computer the first time you start PlayPets | The yard's starting card names it. One press attaches it to every friend, with no key. With two or more friends, they start talking among themselves right after |
| **Sign in with browser** | Claude Code or Codex CLI is installed but not signed in | A **Sign in to Claude Code** card shows above the message box. Finish signing in on the page that opens and PlayPets connects by itself. If Claude's page shows a code, paste it into the card. No terminal needed; the message box opens once you're signed in |

A connection isn't tied to one friend. Other friends can use one you made, or each can pick its own from its AI list.

| To edit or delete a connection | What it does |
|---|---|
| **⋯** menu by the friend's name → **AI connection settings** | Opens that friend's connection; one opened here goes to that friend |
| **Friends & settings → Settings → Friends & AI** → **Edit** | Lists every connection, with **Connect an AI** for a new one. The form opens in place, and editing there moves no friend to the connection |

- Deleting a connection asks first and deletes its saved key too. Friends who chatted through it go on playing without an AI.

## Chatting <Since v="0.1.0" /> {#chatting}

- Type in the field at the bottom and press Enter. Shift+Enter makes a new line.
- Before your first talk with a friend that has an AI, it offers a few first lines, such as "What did you do today?". Pick one to send it in one click.
- Each of the friend's turns opens with its picture, as in a messenger. While you wait, a "Thinking" bubble shows, and the ■ button stops it.
- The answer also floats as a speech bubble above the friend in the yard.
- **Clear chat** in the **⋯** menu by the friend's name deletes the whole conversation with this friend. Name and personality stay.
- Chat history lives only in memory: it's gone when you quit the app and is never saved to a file.
- The log keeps up to the last 500 messages with each friend. When it answers, the friend recalls the latest 24. A friend on Claude Code also remembers the rest while its session stays open.

## Setting a personality <Since v="0.1.0" /> {#personality}

A personality is the tone and attitude your friend answers with.

| Way | How |
|---|---|
| **Write it in Friend settings** | Something like "Acts tough but melts at a compliment. Keeps answers short." is enough. Applies from the next chat once saved |
| **Say it in the chat** | Say something like "be more casual from now on". Your friend saves it as the personality, a "Saved your friend's personality" notice appears, and it shows in Friend settings |

## Setting a relationship <Since v="0.1.0" />

**Relationship** in Friend settings is what this friend is to you: Friend (the default), Partner, Dependable mentor or Playful younger sibling. Each card says the voice it brings.

- To change it in one click, press the relationship chip beside the friend's name in the Friend panel. The same cards open.
- It shapes how your friend talks to you, what it calls you and how it asks about your day. Friends chatting together know each other's relationship.
- A partner, a mentor and a younger sibling have voices of their own even without an AI: when they welcome you back, grow closer or tell you what you mean to them.
- Write "honey" or your name in **What it calls you**, and your friend calls you that. The example in the box changes with the relationship.
- Many Codex pets are human-shaped, which suits a partner or a mentor. What's said within the relationship follows the policy of the AI you connected, not the app.

## Chatting together <Since v="0.1.0" /> {#together}

Once two or more friends have an AI, **Bring friends in** appears at the bottom of the message box.

1. Click it, then click the friends to chat with. Up to 3.
2. Send a message. The current friend answers first, then the picked friends one after another, each with its own AI and personality.
3. To let them carry on without a new message, press **Let them chat** in **Play → Group games**. Friends with an AI talk for a round about the time and the weather, as speech bubbles in the yard.

- The small chip under a friend's name shows which coding agents report to it (Reports from, Claude Code).

## "What were you doing?" <Since v="0.1.0" /> {#agent-work}

- With [Coding agent hooks](./agents.md) set up, your friend remembers what the agent did recently.
- Ask "what were you doing?" in the chat, and it tells you about that work in its own words.
- The hooks work separately from the AI connection your friend chats through.
